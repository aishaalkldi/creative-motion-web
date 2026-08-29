"use client";

import { formatCvDuration, formatCvRecordedAt } from "@/app/lib/cv/cv-metrics-display";
import { formatPrescribedSideForReview } from "@/app/lib/clinical/clinical-prescribed-side-plan-draft";
import type {
  InteractiveShoulderOutcomeBlockDisplayCategory,
  InteractiveShoulderOutcomeBlockReport,
  InteractiveShoulderOutcomeReportEntry,
} from "@/app/lib/progress/progress-outcomes-bundle";
import {
  INTERACTIVE_SHOULDER_OUTCOMES_DISCLAIMER,
  INTERACTIVE_SHOULDER_OUTCOMES_REVIEW_NOTE,
  describeRecordedBlockResults,
} from "@/app/lib/progress/progress-outcomes-bundle";
import type { MovementBlockCompletionReason } from "@/app/lib/session-orchestrator/types";
import { aggregateInteractiveShoulderSessionMetrics } from "@/app/lib/progress/aggregate-interactive-shoulder-session-metrics";

type InteractiveShoulderOutcomesPanelProps = {
  outcomes: InteractiveShoulderOutcomeReportEntry[];
};

const COMPLETION_REASON_LABELS: Record<MovementBlockCompletionReason, string> = {
  duration: "Duration reached",
  validRepetitions: "Valid repetitions reached",
  holdDuration: "Hold duration reached",
  clinicianDefined: "Clinician-defined criteria reached",
  manualCompletion: "Manually completed",
  blockTimeout: "Block timed out",
  movementInterrupted: "Movement interrupted",
  safetyStop: "Safety stop",
};

/**
 * A block's category fallback label — used only when the persisted row has
 * no `title` (a row recorded before that field existed). Never derived from
 * blockId: a raw catalog identifier (e.g. "stroke-ulrf-v1-session-1-warm-up")
 * must never reach the clinician-facing report.
 */
const CATEGORY_FALLBACK_LABELS: Record<InteractiveShoulderOutcomeBlockDisplayCategory, string> = {
  target: "Target reach block",
  pattern: "Movement pattern block",
  instructional: "Instructional phase",
  unknown: "Session block",
};

function formatCompletionReason(reason: MovementBlockCompletionReason | null): string {
  if (reason === null) return "Not recorded";
  return COMPLETION_REASON_LABELS[reason] ?? "Not recorded";
}

/** The block's own real title when persisted; otherwise a category-derived label — never a formatted blockId. */
function formatBlockTitle(block: InteractiveShoulderOutcomeBlockReport): string {
  return block.title ?? CATEGORY_FALLBACK_LABELS[block.displayCategory];
}

function formatNumberOrDash(value: number | null): string {
  return value != null ? String(value) : "—";
}

function formatSecondsOrDash(value: number | null): string {
  return value != null ? `${value}s` : "—";
}

function formatPercentOrDash(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function averageTimingSampleMs(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const total = samples.reduce((sum, value) => sum + value, 0);
  return Math.round(total / samples.length);
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5DCAA5]/85">{children}</p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-white/85">{value}</p>
    </div>
  );
}

/**
 * Interactive (target/pattern) block card — the one interaction count that
 * actually applies to this category, plus participation time. Never both
 * targets and patterns on the same card, and never the measured/interpreted
 * sections: no field in either currently has a runtime producer trustworthy
 * enough to show at the same visual confidence as these two facts.
 */
function InteractiveBlockCard({
  block,
  index,
}: {
  block: InteractiveShoulderOutcomeBlockReport;
  index: number;
}) {
  const primaryStat =
    block.displayCategory === "pattern"
      ? { label: "Patterns completed", value: formatNumberOrDash(block.interaction.patternsCompleted) }
      : { label: "Targets contacted", value: formatNumberOrDash(block.interaction.targetsContacted) };
  const avgReactionMs = averageTimingSampleMs(block.interaction.timingSamplesMs);
  const romDegrees =
    block.measured.rangeValuesDegrees.length > 0
      ? Math.max(...block.measured.rangeValuesDegrees)
      : null;

  return (
    <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220]/50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#F9FAFB]">
          Block {index + 1} — {formatBlockTitle(block)}
        </p>
        <p className="text-[10px] text-white/35">
          {formatCompletionReason(block.completionReason)} · {formatSecondsOrDash(block.durationSeconds)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={primaryStat.label} value={primaryStat.value} />
        <Stat
          label="Valid repetitions"
          value={formatNumberOrDash(block.measured.validRepetitions > 0 ? block.measured.validRepetitions : null)}
        />
        <Stat
          label="Participation time"
          value={formatSecondsOrDash(block.interaction.participationDurationSeconds)}
        />
        {avgReactionMs != null ? (
          <Stat label="Avg reaction time" value={`${avgReactionMs}ms`} />
        ) : null}
        {block.measured.movementSpeed != null ? (
          <Stat label="Movement speed" value={formatNumberOrDash(block.measured.movementSpeed)} />
        ) : null}
        {romDegrees != null ? (
          <Stat label="Peak ROM (deg)" value={formatNumberOrDash(romDegrees)} />
        ) : null}
        {block.interaction.responseConsistency != null ? (
          <Stat
            label="Response consistency"
            value={formatPercentOrDash(block.interaction.responseConsistency)}
          />
        ) : null}
        {block.measured.trackingConfidence != null ? (
          <Stat
            label="Tracking confidence"
            value={formatPercentOrDash(block.measured.trackingConfidence)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Instructional block (Warm-up/Cool-down) — a compact timeline fact, not a
 * movement-performance card. No stat grid: this block never produces a rep,
 * target, or pattern measurement, so a card that looked like the interactive
 * ones above would imply a measurement that was never taken.
 */
function InstructionalBlockRow({
  block,
  index,
}: {
  block: InteractiveShoulderOutcomeBlockReport;
  index: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#1E2D42]/60 bg-[#0B1220]/25 px-4 py-2.5">
      <p className="text-[11px] font-medium text-white/60">
        Block {index + 1} — {formatBlockTitle(block)}
      </p>
      <p className="text-[10px] text-white/35">
        Instructional phase completed · {formatSecondsOrDash(block.durationSeconds)}
      </p>
    </div>
  );
}

/**
 * A row with no recognized blockType (a legacy row persisted before this
 * field existed). Shows whichever interaction counts are actually present
 * rather than guessing a category — never labeled "target" or "pattern"
 * when the record itself doesn't say which one it was.
 */
function UnknownCategoryBlockCard({
  block,
  index,
}: {
  block: InteractiveShoulderOutcomeBlockReport;
  index: number;
}) {
  return (
    <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220]/50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#F9FAFB]">
          Block {index + 1} — {formatBlockTitle(block)}
        </p>
        <p className="text-[10px] text-white/35">
          {formatCompletionReason(block.completionReason)} · {formatSecondsOrDash(block.durationSeconds)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {block.interaction.targetsContacted > 0 ? (
          <Stat label="Targets contacted" value={formatNumberOrDash(block.interaction.targetsContacted)} />
        ) : null}
        {block.interaction.patternsCompleted > 0 ? (
          <Stat label="Patterns completed" value={formatNumberOrDash(block.interaction.patternsCompleted)} />
        ) : null}
        <Stat
          label="Participation time"
          value={formatSecondsOrDash(block.interaction.participationDurationSeconds)}
        />
      </div>
    </div>
  );
}

function BlockReportCard({
  block,
  index,
}: {
  block: InteractiveShoulderOutcomeBlockReport;
  index: number;
}) {
  if (block.displayCategory === "instructional") {
    return <InstructionalBlockRow block={block} index={index} />;
  }
  if (block.displayCategory === "unknown") {
    return <UnknownCategoryBlockCard block={block} index={index} />;
  }
  return <InteractiveBlockCard block={block} index={index} />;
}

function OutcomeEntryCard({ entry }: { entry: InteractiveShoulderOutcomeReportEntry }) {
  const metrics = aggregateInteractiveShoulderSessionMetrics(entry);
  const hasPerformanceMetrics =
    metrics.targetsContacted > 0 ||
    metrics.patternsCompleted > 0 ||
    metrics.averageReactionMs != null ||
    metrics.compensationEvents > 0 ||
    metrics.trackingLimitations.length > 0;

  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[#F9FAFB]">{formatCvRecordedAt(entry.createdAt)}</p>
          <p className="mt-0.5 text-[10px] text-[#6B7280]">
            Treatment side: {formatPrescribedSideForReview(entry.prescribedSide)}
          </p>
        </div>
        <span className="inline-flex items-center rounded-[5px] border border-[#1D9E75]/35 bg-[#1D9E75]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5DCAA5]">
          Completed
        </span>
      </div>

      <div className="mb-5 space-y-3">
        <SectionHeading>Session summary</SectionHeading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Session duration" value={formatCvDuration(entry.totalElapsedSeconds)} />
          <Stat
            label="Blocks completed"
            value={`${entry.blocksCompleted}/${entry.blocksTotal}`}
          />
          <Stat label="Valid repetitions" value={formatNumberOrDash(metrics.validRepetitions > 0 ? metrics.validRepetitions : null)} />
          <Stat label="Block data" value={describeRecordedBlockResults(entry)} />
        </div>
      </div>

      {!entry.recognizedSchemaVersion ? (
        <p className="mb-4 text-[10px] text-amber-300/80">
          This session was recorded with a data version this view does not fully recognize. Some fields
          may be unavailable.
        </p>
      ) : null}

      {entry.blocks.length > 0 ? (
        <div className="space-y-3">
          <SectionHeading>Movement outcomes</SectionHeading>
          {entry.blocks.map((block, index) => (
            <BlockReportCard key={`${entry.id}-${block.blockId}-${index}`} block={block} index={index} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/45">No block-level movement data recorded for this session.</p>
      )}

      {hasPerformanceMetrics ? (
        <div className="mt-5 space-y-3">
          <SectionHeading>Performance / quality</SectionHeading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metrics.targetsContacted > 0 ? (
              <Stat label="Targets contacted" value={formatNumberOrDash(metrics.targetsContacted)} />
            ) : null}
            {metrics.patternsCompleted > 0 ? (
              <Stat label="Patterns completed" value={formatNumberOrDash(metrics.patternsCompleted)} />
            ) : null}
            {metrics.averageReactionMs != null ? (
              <Stat label="Avg reaction time" value={`${metrics.averageReactionMs}ms`} />
            ) : null}
            {metrics.compensationEvents > 0 ? (
              <Stat label="Compensation events" value={formatNumberOrDash(metrics.compensationEvents)} />
            ) : null}
          </div>
          {metrics.trackingLimitations.length > 0 ? (
            <p className="text-[10px] leading-relaxed text-white/45">
              Tracking limitations noted: {metrics.trackingLimitations.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function InteractiveShoulderOutcomesPanel({ outcomes }: InteractiveShoulderOutcomesPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {outcomes.map((entry) => (
          <OutcomeEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
      <div className="rounded-[7px] border border-amber-400/20 bg-amber-400/6 px-3.5 py-2.5">
        <p className="text-[11px] font-medium text-amber-200/90">{INTERACTIVE_SHOULDER_OUTCOMES_REVIEW_NOTE}</p>
        <p className="mt-0.5 text-[10px] text-white/40">{INTERACTIVE_SHOULDER_OUTCOMES_DISCLAIMER}</p>
      </div>
    </div>
  );
}
