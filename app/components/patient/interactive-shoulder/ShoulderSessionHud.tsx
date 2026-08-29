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
import { resolveBlockDisplayCopy } from "@/app/lib/interactive-shoulder/resolve-block-display-copy";
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

function formatClinicalClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  const blockCopy = resolveBlockDisplayCopy(
    language,
    snapshot.currentBlock?.blockId,
    resolveInteractiveShoulderExperienceTitle(language, feedbackMode),
    snapshot.currentBlock?.instructions ?? ui.blockInstructions,
  );
  const remaining = formatRemainingSeconds(snapshot);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const liveMessage = resolveInteractiveShoulderLiveMessage(language, snapshot);
  const encouragement = resolveInteractiveShoulderEncouragement(language, snapshot);
  const primaryLiveAnnouncement = targetHitAnnouncement ?? liveMessage;
  const bottomInstruction =
    primaryLiveAnnouncement ?? (snapshot.safetyStatus === "normal" ? encouragement : null);
  const blockProgressPercent = Math.round(snapshot.blockProgress * 100);
  const sessionProgressPercent = Math.round(snapshot.sessionProgress * 100);
  const prescribedReps = snapshot.currentBlock?.prescribedRepetitions ?? null;
  const interactionCompleted = isPatternMode
    ? patternInteraction.patternsCompleted
    : targetInteraction.targetsReached;
  const interactionTotal = isPatternMode
    ? patternInteraction.patternsShown
    : targetInteraction.targetsShown;

  if (showBlockSummary) {
    return (
      <div className="absolute inset-0 z-30 flex items-end px-3 pb-3 pt-12 sm:px-4 sm:pb-4">
        <div
          className={`w-full rounded-[12px] border border-white/20 bg-[#0F1825]/92 px-4 py-4 text-white backdrop-blur-sm sm:px-5 sm:py-4 ${arClass}`}
          role="status"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5DCAA5]">
            {ui.blockCompleteTitle}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/85 sm:text-[14px]">
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
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-2 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`min-w-0 flex-1 rounded-[12px] border border-white/15 bg-[#0F1825]/88 px-3 py-3 text-white backdrop-blur-sm sm:px-4 ${arClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5DCAA5]">
              {blockCopy.phaseLabel}
            </span>
            {remaining !== null ? (
              <span className="text-[11px] font-semibold tabular-nums text-white/70" dir="ltr">
                {formatClinicalClock(remaining)}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-[14px] font-semibold leading-snug text-white sm:text-[15px]">
            {blockCopy.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/70 sm:text-[12px]">
            {blockCopy.instructions}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/45">
                {isPatternMode ? ui.interactionPatternsLabel(0, 0).split(":")[0] : ui.interactionTargetsLabel(0, 0).split(":")[0]}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-white" dir="ltr">
                {interactionCompleted}/{interactionTotal || "—"}
              </p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/45">
                {ui.measuredRepsLabel(0).replace(/:.*/, "")}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-white" dir="ltr">
                {ui.repProgressLabel(measuredReps, prescribedReps)}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
                <span>{ui.blockLabel}</span>
                <span dir="ltr">{ui.blockProgressPercent(blockProgressPercent)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, blockProgressPercent))}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
                <span>{ui.sessionProgressLabel}</span>
                <span dir="ltr">{ui.blockProgressPercent(sessionProgressPercent)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/35 transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, sessionProgressPercent))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="pointer-events-auto shrink-0 rounded-[10px] border border-white/20 bg-[#0F1825]/92 px-3 py-2 text-[12px] font-semibold text-white/90 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5DCAA5]"
          onClick={pausedOrHold ? onResume : onPause}
          aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
        >
          {pausedOrHold ? ui.resume : ui.pause}
        </button>
      </div>

      {bottomInstruction ? (
        <div
          className={`rounded-[10px] border border-[#1D9E75]/35 bg-[#0F1825]/88 px-3 py-2.5 text-center text-[11px] font-medium leading-snug text-[#D7F5EA] backdrop-blur-sm sm:text-[12px] ${arClass}`}
          role="status"
          aria-live="polite"
        >
          {bottomInstruction}
        </div>
      ) : null}
    </div>
  );
}
