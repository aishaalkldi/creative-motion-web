"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import type { ShoulderInteractionMetrics } from "@/app/lib/interactive-shoulder/types";
import {
  interactiveShoulderUi,
  resolveInteractiveShoulderEncouragement,
  resolveInteractiveShoulderLiveMessage,
} from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";

type ShoulderSessionHudProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  snapshot: SessionOrchestratorSnapshot;
  interaction: ShoulderInteractionMetrics;
  measuredReps: number;
  onPause: () => void;
  onResume: () => void;
  showBlockSummary: boolean;
  blockSummaryTargetsReached: number;
  blockSummaryMeasuredReps: number;
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
  interaction,
  measuredReps,
  onPause,
  onResume,
  showBlockSummary,
  blockSummaryTargetsReached,
  blockSummaryMeasuredReps,
  targetHitAnnouncement = null,
}: ShoulderSessionHudProps) {
  const ui = interactiveShoulderUi(language);
  const remaining = formatRemainingSeconds(snapshot);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const liveMessage = resolveInteractiveShoulderLiveMessage(language, snapshot);
  const encouragement = resolveInteractiveShoulderEncouragement(language, snapshot);
  const primaryLiveAnnouncement = targetHitAnnouncement ?? liveMessage;
  const encouragementIsLive = Boolean(encouragement) && !primaryLiveAnnouncement;

  if (showBlockSummary) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#0A0F1A]/95 via-[#0A0F1A]/80 to-transparent px-4 pb-4 pt-10">
        <div
          className={`rounded-[10px] border border-[#1D9E75]/30 bg-[#0F1825]/95 p-4 text-white ${arClass}`}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-bold text-[#5DCAA5]">{ui.blockCompleteTitle}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/75">
            {ui.blockCompleteSummary(blockSummaryTargetsReached, blockSummaryMeasuredReps)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`rounded-[8px] border border-[#1E2D42]/60 bg-[#0F1825]/85 px-3 py-2 text-white backdrop-blur-sm ${arClass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            {ui.movementBlockLabel}
          </p>
          <p className="text-sm font-bold">
            {remaining !== null
              ? ui.timeRemainingSeconds(remaining)
              : ui.blockProgressPercent(Math.round(snapshot.blockProgress * 100))}
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            {ui.targetsAndReps(interaction.targetsReached, interaction.targetsShown, measuredReps)}
          </p>
        </div>
        <button
          type="button"
          className="pointer-events-auto rounded-[8px] border border-[#1E2D42] bg-[#0F1825]/90 px-3 py-2 text-[12px] font-semibold text-white/85"
          onClick={pausedOrHold ? onResume : onPause}
          aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
        >
          {pausedOrHold ? ui.resume : ui.pause}
        </button>
      </div>

      {primaryLiveAnnouncement ? (
        <div
          className={`rounded-[8px] border border-amber-400/30 bg-[#0F1825]/90 px-3 py-2 text-center text-[12px] font-medium text-amber-100 backdrop-blur-sm ${arClass}`}
          role="status"
          aria-live="polite"
        >
          {primaryLiveAnnouncement}
        </div>
      ) : null}

      {encouragement && snapshot.safetyStatus === "normal" ? (
        <div
          className={`rounded-[8px] border border-[#1D9E75]/25 bg-[#0F1825]/80 px-3 py-2 text-center text-[12px] text-[#5DCAA5] backdrop-blur-sm ${arClass}`}
          role={encouragementIsLive ? "status" : undefined}
          aria-live={encouragementIsLive ? "polite" : undefined}
        >
          {encouragement}
        </div>
      ) : null}
    </div>
  );
}
