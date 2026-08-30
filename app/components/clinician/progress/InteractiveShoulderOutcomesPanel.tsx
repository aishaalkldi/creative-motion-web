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
import {
  COMPENSATION_SIGNAL_CAVEAT,
  COMPENSATION_SIGNAL_LABEL,
  DETECTED_REACH_RETURN_CYCLES_HELPER,
  DETECTED_REACH_RETURN_CYCLES_LABEL,
  TARGET_INTERACTIONS_HELPER,
  TARGET_INTERACTIONS_LABEL,
  VALID_REPETITIONS_LABEL,
  isRepetitionDosedBlock,
  peakRomDegrees,
  shouldShowDetectedReachReturnCycles,
} from "@/app/lib/progress/interactive-shoulder-outcome-clinician-display";
import {
  AVG_TARGET_RESPONSE_TIME_LABEL,
  D1_PATH_TRACES_COMPLETED_HELPER,
  D1_PATH_TRACES_COMPLETED_LABEL,
  MOTION_PROFILE_HEADING,
  PEAK_HIP_SHOULDER_ELBOW_ANGLE_HELPER,
  PEAK_HIP_SHOULDER_ELBOW_ANGLE_LABEL,
  RECORDED_SESSION_OBSERVATION_HEADING,
  averageTargetResponseTimeMs,
  buildBlockMotionProfile,
  buildRecordedSessionObservation,
  buildSessionMotionSnapshot,
  formatMovementAngleDegrees,
  formatTargetResponseTimeSeconds,
  hasMotionAnalysisContent,
  isActiveExerciseBlock,
} from "@/app/lib/progress/interactive-shoulder-motion-analysis";

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

function formatBlockTitle(block: InteractiveShoulderOutcomeBlockReport): string {
  return block.title ?? CATEGORY_FALLBACK_LABELS[block.displayCategory];
}

function formatNumberOrDash(value: number | null): string {
  return value != null ? String(value) : "—";
}

function formatSecondsOrDash(value: number | null): string {
  return value != null ? `${value}s` : "—";
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5DCAA5]/85">{children}</p>
  );
}

function Stat({
  label,
  value,
  helper,
  subdued = false,
}: {
  label: string;
  value: string;
  helper?: string;
  subdued?: boolean;
}) {
  return (
    <div
      className={`rounded-[6px] border border-[#1E2D42] px-3 py-2 ${
        subdued ? "bg-[#0B1220]/40" : "bg-[#0B1220]"
      }`}
    >
      <p className={`text-[9px] uppercase tracking-wider ${subdued ? "text-white/28" : "text-white/35"}`}>
        {label}
      </p>
      <p className={`mt-0.5 text-[12px] font-medium ${subdued ? "text-white/55" : "text-white/85"}`}>
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-[9px] leading-relaxed text-white/35">{helper}</p>
      ) : null}
    </div>
  );
}

function SnapshotMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-[#F9FAFB]">{value}</p>
      {helper ? (
        <p className="mt-2 text-[9px] leading-relaxed text-white/35">{helper}</p>
      ) : null}
    </div>
  );
}

function MotionAnalysisSection({ entry }: { entry: InteractiveShoulderOutcomeReportEntry }) {
  if (!hasMotionAnalysisContent(entry)) return null;

  const snapshot = buildSessionMotionSnapshot(entry);
  const observation = buildRecordedSessionObservation(entry);
  const profiles = entry.blocks
    .filter(isActiveExerciseBlock)
    .map((block) => ({ block, lines: buildBlockMotionProfile(block) }))
    .filter((profile) => profile.lines.length > 0);

  return (
    <div className="mb-5 overflow-hidden rounded-[10px] border border-[#1E2D42]/70 bg-[#080E18]">
      <div className="border-b border-[#1E2D42]/60 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F9FAFB]">Motion analysis</p>
        <p className="mt-1 text-[10px] text-white/40">For therapist review</p>
      </div>

      <div className="space-y-5 px-5 py-5">
        {snapshot.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.map((metric) => (
              <SnapshotMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                helper={metric.helper}
              />
            ))}
          </div>
        ) : null}

        {observation ? (
          <div className="space-y-2 border-t border-[#1E2D42]/50 pt-5">
            <SectionHeading>{RECORDED_SESSION_OBSERVATION_HEADING}</SectionHeading>
            <p className="max-w-3xl text-[12px] leading-relaxed text-white/70">{observation}</p>
          </div>
        ) : null}

        {profiles.length > 0 ? (
          <div className="space-y-3 border-t border-[#1E2D42]/50 pt-5">
            <SectionHeading>{MOTION_PROFILE_HEADING}</SectionHeading>
            <div className="space-y-4">
              {profiles.map(({ block, lines }) => (
                <div key={block.blockId} className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#F9FAFB]">{formatBlockTitle(block)}</p>
                  <ul className="mt-2 space-y-1">
                    {lines.map((line) => (
                      <li
                        key={`${block.blockId}-${line.label}`}
                        className={`flex flex-wrap items-baseline gap-x-2 text-[11px] ${
                          line.secondary ? "text-white/40" : "text-white/65"
                        }`}
                      >
                        <span className={line.secondary ? "text-white/30" : "text-white/45"}>
                          {line.label}:
                        </span>
                        <span className={line.secondary ? "font-normal" : "font-medium text-white/80"}>
                          {line.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InteractiveBlockCard({
  block,
  index,
}: {
  block: InteractiveShoulderOutcomeBlockReport;
  index: number;
}) {
  const repDosed = isRepetitionDosedBlock(block);
  const showDetectedCycles = shouldShowDetectedReachReturnCycles(block);
  const avgResponseMs = averageTargetResponseTimeMs(block.interaction.timingSamplesMs);
  const peakAngle = peakRomDegrees(block);

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
        {block.displayCategory === "pattern" ? (
          <Stat
            label={D1_PATH_TRACES_COMPLETED_LABEL}
            value={formatNumberOrDash(block.interaction.patternsCompleted)}
            helper={
              block.interaction.patternsCompleted > 0 ? D1_PATH_TRACES_COMPLETED_HELPER : undefined
            }
          />
        ) : (
          <Stat
            label={TARGET_INTERACTIONS_LABEL}
            value={formatNumberOrDash(block.interaction.targetsContacted)}
            helper={block.interaction.targetsContacted > 0 ? TARGET_INTERACTIONS_HELPER : undefined}
          />
        )}
        <Stat
          label="Participation time"
          value={formatSecondsOrDash(block.interaction.participationDurationSeconds)}
        />
        {avgResponseMs != null ? (
          <Stat
            label={AVG_TARGET_RESPONSE_TIME_LABEL}
            value={formatTargetResponseTimeSeconds(avgResponseMs)}
          />
        ) : null}
        {peakAngle != null ? (
          <Stat
            label={PEAK_HIP_SHOULDER_ELBOW_ANGLE_LABEL}
            value={formatMovementAngleDegrees(peakAngle)}
            helper={PEAK_HIP_SHOULDER_ELBOW_ANGLE_HELPER}
          />
        ) : null}
        {repDosed ? (
          <Stat
            label={VALID_REPETITIONS_LABEL}
            value={formatNumberOrDash(
              block.measured.validRepetitions > 0 ? block.measured.validRepetitions : null,
            )}
          />
        ) : null}
        {block.interpreted.compensationEvents > 0 ? (
          <Stat
            label={COMPENSATION_SIGNAL_LABEL}
            value={formatNumberOrDash(block.interpreted.compensationEvents)}
            helper={COMPENSATION_SIGNAL_CAVEAT}
          />
        ) : null}
      </div>
      {showDetectedCycles ? (
        <div className="mt-3 border-t border-[#1E2D42]/70 pt-3">
          <Stat
            subdued
            label={DETECTED_REACH_RETURN_CYCLES_LABEL}
            value={formatNumberOrDash(block.measured.validRepetitions)}
            helper={DETECTED_REACH_RETURN_CYCLES_HELPER}
          />
        </div>
      ) : null}
    </div>
  );
}

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

function UnknownCategoryBlockCard({
  block,
  index,
}: {
  block: InteractiveShoulderOutcomeBlockReport;
  index: number;
}) {
  const repDosed = isRepetitionDosedBlock(block);
  const showDetectedCycles = shouldShowDetectedReachReturnCycles(block);
  const avgResponseMs = averageTargetResponseTimeMs(block.interaction.timingSamplesMs);
  const peakAngle = peakRomDegrees(block);

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
          <Stat
            label={TARGET_INTERACTIONS_LABEL}
            value={formatNumberOrDash(block.interaction.targetsContacted)}
            helper={TARGET_INTERACTIONS_HELPER}
          />
        ) : null}
        {block.interaction.patternsCompleted > 0 ? (
          <Stat
            label={D1_PATH_TRACES_COMPLETED_LABEL}
            value={formatNumberOrDash(block.interaction.patternsCompleted)}
            helper={D1_PATH_TRACES_COMPLETED_HELPER}
          />
        ) : null}
        <Stat
          label="Participation time"
          value={formatSecondsOrDash(block.interaction.participationDurationSeconds)}
        />
        {avgResponseMs != null ? (
          <Stat
            label={AVG_TARGET_RESPONSE_TIME_LABEL}
            value={formatTargetResponseTimeSeconds(avgResponseMs)}
          />
        ) : null}
        {peakAngle != null ? (
          <Stat
            label={PEAK_HIP_SHOULDER_ELBOW_ANGLE_LABEL}
            value={formatMovementAngleDegrees(peakAngle)}
            helper={PEAK_HIP_SHOULDER_ELBOW_ANGLE_HELPER}
          />
        ) : null}
        {repDosed ? (
          <Stat
            label={VALID_REPETITIONS_LABEL}
            value={formatNumberOrDash(
              block.measured.validRepetitions > 0 ? block.measured.validRepetitions : null,
            )}
          />
        ) : null}
        {block.interpreted.compensationEvents > 0 ? (
          <Stat
            label={COMPENSATION_SIGNAL_LABEL}
            value={formatNumberOrDash(block.interpreted.compensationEvents)}
            helper={COMPENSATION_SIGNAL_CAVEAT}
          />
        ) : null}
      </div>
      {showDetectedCycles ? (
        <div className="mt-3 border-t border-[#1E2D42]/70 pt-3">
          <Stat
            subdued
            label={DETECTED_REACH_RETURN_CYCLES_LABEL}
            value={formatNumberOrDash(block.measured.validRepetitions)}
            helper={DETECTED_REACH_RETURN_CYCLES_HELPER}
          />
        </div>
      ) : null}
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Session duration" value={formatCvDuration(entry.totalElapsedSeconds)} />
          <Stat
            label="Blocks completed"
            value={`${entry.blocksCompleted}/${entry.blocksTotal}`}
          />
          <Stat label="Block data" value={describeRecordedBlockResults(entry)} />
        </div>
      </div>

      {!entry.recognizedSchemaVersion ? (
        <p className="mb-4 text-[10px] text-amber-300/80">
          This session was recorded with a data version this view does not fully recognize. Some fields
          may be unavailable.
        </p>
      ) : null}

      <MotionAnalysisSection entry={entry} />

      {entry.blocks.length > 0 ? (
        <div className="space-y-3">
          <SectionHeading>Detailed block data</SectionHeading>
          {entry.blocks.map((block, index) => (
            <BlockReportCard key={`${entry.id}-${block.blockId}-${index}`} block={block} index={index} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/45">No block-level movement data recorded for this session.</p>
      )}
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
