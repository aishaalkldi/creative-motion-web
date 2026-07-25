"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import type { ShoulderInteractionMetrics } from "@/app/lib/interactive-shoulder/types";
import type { PatternInteractionMetrics } from "@/app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle";
import type { FeedbackInteractionMode } from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry";
import {
  interactiveShoulderUi,
  resolveInteractiveShoulderEncouragement,
  resolveInteractiveShoulderExperienceTitle,
  resolveInteractiveShoulderLiveMessage,
} from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";

type ShoulderSessionHudProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  snapshot: SessionOrchestratorSnapshot;
  feedbackMode: FeedbackInteractionMode;
  targetInteraction: ShoulderInteractionMetrics;
  patternInteraction: PatternInteractionMetrics;
  measuredReps: number;
  onPause: () => void;
  onResume: () => void;
  showBlockSummary: boolean;
  blockSummaryTargetsReached: number;
  blockSummaryPatternsCompleted: number;
  blockSummaryMeasuredReps: number;
  blockSummaryDurationSeconds: number;
  targetHitAnnouncement?: string | null;
};

/** Row-label prefixes derived from existing composite UI helpers (label + value). */
function metricLabelPrefixFromComposite(formatted: string): string {
  const colonIdx = formatted.lastIndexOf(":");
  if (colonIdx >= 0) return formatted.slice(0, colonIdx + 1).trim();
  return formatted;
}

function formatRemainingSeconds(snapshot: SessionOrchestratorSnapshot): number | null {
  const block = snapshot.currentBlock;
  if (!block?.targetDurationSeconds) return null;
  const remaining = Math.max(0, block.targetDurationSeconds - snapshot.blockElapsedSeconds);
  return Math.ceil(remaining);
}

function formatClinicalClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ClinicalMetricRow({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-white/55">{label}</dt>
      <dd className="min-w-0 truncate font-medium tabular-nums text-white/95" dir={dir}>
        {value}
      </dd>
    </div>
  );
}

export function ShoulderSessionHud({
  language,
  arClass = "",
  snapshot,
  feedbackMode,
  targetInteraction,
  patternInteraction,
  measuredReps,
  onPause,
  onResume,
  showBlockSummary,
  blockSummaryTargetsReached,
  blockSummaryPatternsCompleted,
  blockSummaryMeasuredReps,
  blockSummaryDurationSeconds,
  targetHitAnnouncement = null,
}: ShoulderSessionHudProps) {
  const ui = interactiveShoulderUi(language);
  const progressLabel = `${ui.sessionProgressLabel}:`;
  const interactionTargetsLabel = metricLabelPrefixFromComposite(ui.interactionTargetsLabel(0, 0));
  const completedPathsLabel = metricLabelPrefixFromComposite(ui.interactionPatternsLabel(0, 0));
  const measuredRepsLabel = metricLabelPrefixFromComposite(ui.measuredRepsLabel(0));
  const isPatternMode = feedbackMode === "motion-pattern";
  const experienceTitle = resolveInteractiveShoulderExperienceTitle(language, feedbackMode);
  const remaining = formatRemainingSeconds(snapshot);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const liveMessage = resolveInteractiveShoulderLiveMessage(language, snapshot);
  const encouragement = resolveInteractiveShoulderEncouragement(language, snapshot);
  const primaryLiveAnnouncement = targetHitAnnouncement ?? liveMessage;
  const bottomInstruction =
    primaryLiveAnnouncement ?? (snapshot.safetyStatus === "normal" ? encouragement : null);
  const progressPercent = Math.round(snapshot.blockProgress * 100);
  const interactionMetricLabel = isPatternMode ? completedPathsLabel : interactionTargetsLabel;
  const interactionMetricValue = isPatternMode
    ? `${patternInteraction.patternsCompleted}/${patternInteraction.patternsShown}`
    : `${targetInteraction.targetsReached}/${targetInteraction.targetsShown}`;

  if (showBlockSummary) {
    return (
      <div className="absolute inset-0 z-30 flex items-end px-3 pb-3 pt-12 sm:px-4 sm:pb-4">
        <div
          className={`w-full rounded-md border border-white/20 bg-black/35 px-3 py-3 text-white backdrop-blur-[2px] sm:px-4 sm:py-3.5 ${arClass}`}
          role="status"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold text-white/90">{ui.blockCompleteTitle}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/80 sm:text-[12px]">
            {isPatternMode
              ? ui.blockCompleteDetailedSummaryPatterns(
                  blockSummaryPatternsCompleted,
                  blockSummaryMeasuredReps,
                  blockSummaryDurationSeconds,
                )
              : ui.blockCompleteDetailedSummary(
                  blockSummaryTargetsReached,
                  blockSummaryMeasuredReps,
                  blockSummaryDurationSeconds,
                )}
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-white/55 sm:text-[11px]">
            {isPatternMode ? ui.patternMetricsSeparationNote : ui.metricsSeparationNote}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-2 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`min-w-0 flex-1 rounded-md border border-white/20 bg-black/30 px-2.5 py-2 text-[10px] leading-snug backdrop-blur-[2px] sm:px-3 sm:py-2.5 sm:text-[11px] ${arClass}`}
        >
          <dl className="space-y-0.5">
            <ClinicalMetricRow label={ui.clinicalHudExerciseLabel} value={experienceTitle} />
            {remaining !== null ? (
              <ClinicalMetricRow
                label={ui.clinicalHudTimeRemainingLabel}
                value={formatClinicalClock(remaining)}
                dir="ltr"
              />
            ) : null}
            <ClinicalMetricRow
              label={progressLabel}
              value={ui.blockProgressPercent(progressPercent)}
              dir="ltr"
            />
            <ClinicalMetricRow
              label={interactionMetricLabel}
              value={interactionMetricValue}
              dir="ltr"
            />
            <ClinicalMetricRow
              label={measuredRepsLabel}
              value={String(measuredReps)}
              dir="ltr"
            />
          </dl>
        </div>
        <button
          type="button"
          className="pointer-events-auto shrink-0 rounded-md border border-white/25 bg-black/35 px-2.5 py-2 text-[10px] font-semibold leading-tight text-white/90 backdrop-blur-[2px] sm:px-3 sm:text-[11px]"
          onClick={pausedOrHold ? onResume : onPause}
          aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
        >
          {pausedOrHold ? ui.resume : ui.pause}
        </button>
      </div>

      {bottomInstruction ? (
        <div
          className={`rounded-md border border-white/15 bg-black/30 px-2.5 py-2 text-center text-[10px] leading-snug text-white/85 backdrop-blur-[2px] sm:px-3 sm:text-[11px] ${arClass}`}
          role="status"
          aria-live="polite"
        >
          {bottomInstruction}
        </div>
      ) : null}
    </div>
  );
}
