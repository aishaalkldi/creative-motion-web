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

function formatRemainingSeconds(snapshot: SessionOrchestratorSnapshot): number | null {
  const block = snapshot.currentBlock;
  if (!block?.targetDurationSeconds) return null;
  const remaining = Math.max(0, block.targetDurationSeconds - snapshot.blockElapsedSeconds);
  return Math.ceil(remaining);
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
  const isPatternMode = feedbackMode === "motion-pattern";
  const experienceTitle = resolveInteractiveShoulderExperienceTitle(language, feedbackMode);
  const remaining = formatRemainingSeconds(snapshot);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const liveMessage = resolveInteractiveShoulderLiveMessage(language, snapshot);
  const encouragement = resolveInteractiveShoulderEncouragement(language, snapshot);
  const primaryLiveAnnouncement = targetHitAnnouncement ?? liveMessage;
  const encouragementIsLive = Boolean(encouragement) && !primaryLiveAnnouncement;
  const progressPercent = Math.round(snapshot.blockProgress * 100);

  if (showBlockSummary) {
    return (
      <div className="absolute inset-0 z-30 flex items-end bg-gradient-to-t from-[#0A0F1A]/95 via-[#0A0F1A]/70 to-[#0A0F1A]/20 px-4 pb-4 pt-16">
        <div
          className={`w-full rounded-[12px] border border-[#1D9E75]/35 bg-[#0F1825]/95 p-5 text-white shadow-[0_12px_40px_rgba(10,15,26,0.45)] ${arClass}`}
          role="status"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5DCAA5]/80">
            {experienceTitle}
          </p>
          <p className="mt-1 text-base font-bold text-[#5DCAA5]">{ui.blockCompleteTitle}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-white/85">
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
          <p className="mt-3 text-[12px] leading-relaxed text-white/60">
            {isPatternMode ? ui.patternMetricsSeparationNote : ui.metricsSeparationNote}
          </p>
        </div>
      </div>
    );
  }

  const interactionSummary = isPatternMode
    ? ui.interactionPatternsLabel(
        patternInteraction.patternsCompleted,
        patternInteraction.patternsShown,
      )
    : ui.interactionTargetsLabel(
        targetInteraction.targetsReached,
        targetInteraction.targetsShown,
      );

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-2">
      <div className="flex items-start justify-between gap-1.5">
        <div
          className={`min-w-0 flex-1 rounded-[8px] border border-[#1E2D42]/60 bg-[#0F1825]/80 px-2.5 py-1.5 text-white backdrop-blur-sm ${arClass}`}
        >
          <p className="truncate text-[11px] font-bold leading-tight text-white">{experienceTitle}</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-tight text-[#5DCAA5]">
            {remaining !== null
              ? ui.timeRemainingSeconds(remaining)
              : ui.blockProgressPercent(progressPercent)}
          </p>
          <div className="mt-1">
            <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] leading-none text-white/45">
              <span>{ui.sessionProgressLabel}</span>
              <span>{ui.blockProgressPercent(progressPercent)}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
          <p className="mt-1 truncate text-[10px] leading-tight text-white/75">
            <span className="text-[#5DCAA5]/90">{interactionSummary}</span>
            <span className="mx-1 text-white/30" aria-hidden>
              ·
            </span>
            <span>{ui.measuredRepsLabel(measuredReps)}</span>
          </p>
        </div>
        <button
          type="button"
          className="pointer-events-auto shrink-0 rounded-[8px] border border-[#1E2D42] bg-[#0F1825]/88 px-2.5 py-1.5 text-[11px] font-semibold leading-tight text-white/90"
          onClick={pausedOrHold ? onResume : onPause}
          aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
        >
          {pausedOrHold ? ui.resume : ui.pause}
        </button>
      </div>

      {primaryLiveAnnouncement ? (
        <div
          className={`rounded-[8px] border border-amber-400/30 bg-[#0F1825]/88 px-2.5 py-2 text-center text-[11px] font-medium leading-snug text-amber-100 backdrop-blur-sm ${arClass}`}
          role="status"
          aria-live="polite"
        >
          {primaryLiveAnnouncement}
        </div>
      ) : null}

      {encouragement && snapshot.safetyStatus === "normal" ? (
        <div
          className={`rounded-[8px] border border-[#1D9E75]/25 bg-[#0F1825]/80 px-2.5 py-1.5 text-center text-[11px] leading-snug text-[#5DCAA5] backdrop-blur-sm ${arClass}`}
          role={encouragementIsLive ? "status" : undefined}
          aria-live={encouragementIsLive ? "polite" : undefined}
        >
          {encouragement}
        </div>
      ) : null}
    </div>
  );
}
