"use client";

import { formatCvDuration, formatCvRecordedAt } from "@/app/lib/cv/cv-metrics-display";
import { formatPrescribedSideForReview } from "@/app/lib/clinical/clinical-prescribed-side-plan-draft";
import type {
  InteractiveShoulderOutcomeBlockReport,
  InteractiveShoulderOutcomeReportEntry,
} from "@/app/lib/progress/progress-outcomes-bundle";
import {
  INTERACTIVE_SHOULDER_OUTCOMES_DISCLAIMER,
  INTERACTIVE_SHOULDER_OUTCOMES_REVIEW_NOTE,
  describeRecordedBlockResults,
} from "@/app/lib/progress/progress-outcomes-bundle";
import type {
  MovementBlockCompletionReason,
  InterpretedObservations,
} from "@/app/lib/session-orchestrator/types";

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

const FATIGUE_TREND_LABELS: Record<InterpretedObservations["fatigueTrend"], string> = {
  stable: "Stable",
  declining: "Declining",
  unknown: "Unknown",
};

function formatCompletionReason(reason: MovementBlockCompletionReason | null): string {
  if (reason === null) return "Not recorded";
  return COMPLETION_REASON_LABELS[reason] ?? "Not recorded";
}

function formatBlockLabel(blockId: string): string {
  const spaced = blockId.replace(/[-_]+/g, " ").trim();
  if (!spaced) return blockId;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNumberOrDash(value: number | null): string {
  return value != null ? String(value) : "—";
}

function formatSecondsOrDash(value: number | null): string {
  return value != null ? `${value}s` : "—";
}

function formatListOrDash(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "None recorded";
}

function formatMsListOrDash(values: readonly number[]): string {
  return values.length > 0 ? values.map((v) => `${Math.round(v)}ms`).join(", ") : "—";
}

function formatDegreesListOrDash(values: readonly number[]): string {
  return values.length > 0 ? values.map((v) => `${v}°`).join(", ") : "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-white/85">{value}</p>
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
  return (
    <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220]/50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#F9FAFB]">
          Block {index + 1} — {formatBlockLabel(block.blockId)}
        </p>
        <p className="text-[10px] text-white/35">
          {formatCompletionReason(block.completionReason)} · {formatSecondsOrDash(block.durationSeconds)}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5DCAA5]">
            Movement performance — measured
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Valid repetitions" value={formatNumberOrDash(block.measured.validRepetitions)} />
            <Stat label="Invalid repetitions" value={formatNumberOrDash(block.measured.invalidRepetitions)} />
            <Stat label="Range of motion" value={formatDegreesListOrDash(block.measured.rangeValuesDegrees)} />
            <Stat label="Hold duration" value={formatSecondsOrDash(block.measured.holdDurationSeconds)} />
            <Stat
              label="Movement speed"
              value={block.measured.movementSpeed != null ? String(block.measured.movementSpeed) : "—"}
            />
            <Stat
              label="Return control"
              value={block.measured.returnControl != null ? String(block.measured.returnControl) : "—"}
            />
            <Stat
              label="Tracking confidence"
              value={block.measured.trackingConfidence != null ? String(block.measured.trackingConfidence) : "—"}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5DCAA5]">
            Interactive task performance — interaction
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Targets contacted" value={formatNumberOrDash(block.interaction.targetsContacted)} />
            <Stat label="Patterns completed" value={formatNumberOrDash(block.interaction.patternsCompleted)} />
            <Stat label="Response timing" value={formatMsListOrDash(block.interaction.timingSamplesMs)} />
            <Stat
              label="Response consistency"
              value={
                block.interaction.responseConsistency != null
                  ? String(block.interaction.responseConsistency)
                  : "—"
              }
            />
            <Stat
              label="Participation time"
              value={formatSecondsOrDash(block.interaction.participationDurationSeconds)}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300/90">
            Movement observations — for therapist review
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Compensation events" value={formatNumberOrDash(block.interpreted.compensationEvents)} />
            <Stat label="Fatigue trend" value={FATIGUE_TREND_LABELS[block.interpreted.fatigueTrend]} />
            <Stat label="Reduced control observed" value={block.interpreted.reducedControl ? "Yes" : "No"} />
          </div>
          <div className="mt-2 space-y-1.5 text-[11px] text-white/55">
            <p>Asymmetry observations: {formatListOrDash(block.interpreted.asymmetryObservations)}</p>
            <p>Tracking limitations: {formatListOrDash(block.interpreted.trackingLimitations)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomeEntryCard({ entry }: { entry: InteractiveShoulderOutcomeReportEntry }) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[#F9FAFB]">{formatCvRecordedAt(entry.createdAt)}</p>
          <p className="mt-0.5 text-[10px] text-[#6B7280]">
            Side: {formatPrescribedSideForReview(entry.prescribedSide)}
          </p>
        </div>
        <span className="inline-flex items-center rounded-[5px] border border-[#1D9E75]/35 bg-[#1D9E75]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5DCAA5]">
          Completed
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Elapsed time" value={formatCvDuration(entry.totalElapsedSeconds)} />
        <Stat label="Block data" value={describeRecordedBlockResults(entry)} />
      </div>

      {!entry.recognizedSchemaVersion ? (
        <p className="mb-4 text-[10px] text-amber-300/80">
          This session was recorded with a data version this view does not fully recognize. Some fields
          may be unavailable.
        </p>
      ) : null}

      {entry.blocks.length > 0 ? (
        <div className="space-y-3">
          {entry.blocks.map((block, index) => (
            <BlockReportCard key={`${entry.id}-${block.blockId}-${index}`} block={block} index={index} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/45">No block-level movement data recorded for this session.</p>
      )}

      <p className="mt-3 text-[9px] text-white/25">Schema {entry.schemaVersion || "not recorded"}</p>
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
