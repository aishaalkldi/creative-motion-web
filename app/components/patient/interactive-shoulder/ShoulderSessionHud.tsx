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
  interaction,
  measuredReps,
  onPause,
  onResume,
  showBlockSummary,
  blockSummaryTargetsReached,
  blockSummaryMeasuredReps,
  blockSummaryDurationSeconds,
  targetHitAnnouncement = null,
}: ShoulderSessionHudProps) {
  const ui = interactiveShoulderUi(language);
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
            {ui.experienceTitle}
          </p>
          <p className="mt-1 text-base font-bold text-[#5DCAA5]">{ui.blockCompleteTitle}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-white/85">
            {ui.blockCompleteDetailedSummary(
              blockSummaryTargetsReached,
              blockSummaryMeasuredReps,
              blockSummaryDurationSeconds,
            )}
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-white/60">{ui.metricsSeparationNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`min-w-0 flex-1 rounded-[10px] border border-[#1E2D42]/70 bg-[#0F1825]/88 px-3 py-2.5 text-white backdrop-blur-sm ${arClass}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#5DCAA5]/80">
              {ui.experienceTitle}
            </p>
            <p className="text-[10px] text-white/45">{ui.movementBlockLabel}</p>
          </div>
          <p className="mt-1 text-sm font-bold">
            {remaining !== null
              ? ui.timeRemainingSeconds(remaining)
              : ui.blockProgressPercent(progressPercent)}
          </p>
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
              <span>{ui.sessionProgressLabel}</span>
              <span>{ui.blockProgressPercent(progressPercent)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5] transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-[#5DCAA5]/90">
              {ui.interactionTargetsLabel(interaction.targetsReached, interaction.targetsShown)}
            </p>
            <p className="text-[11px] text-white/70">{ui.measuredRepsLabel(measuredReps)}</p>
          </div>
        </div>
        <button
          type="button"
          className="pointer-events-auto shrink-0 rounded-[10px] border border-[#1E2D42] bg-[#0F1825]/92 px-3 py-2 text-[12px] font-semibold text-white/90"
          onClick={pausedOrHold ? onResume : onPause}
          aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
        >
          {pausedOrHold ? ui.resume : ui.pause}
        </button>
      </div>

      {primaryLiveAnnouncement ? (
        <div
          className={`rounded-[10px] border border-amber-400/30 bg-[#0F1825]/92 px-3 py-2.5 text-center text-[12px] font-medium text-amber-100 backdrop-blur-sm ${arClass}`}
          role="status"
          aria-live="polite"
        >
          {primaryLiveAnnouncement}
        </div>
      ) : null}

      {encouragement && snapshot.safetyStatus === "normal" ? (
        <div
          className={`rounded-[10px] border border-[#1D9E75]/25 bg-[#0F1825]/82 px-3 py-2 text-center text-[12px] text-[#5DCAA5] backdrop-blur-sm ${arClass}`}
          role={encouragementIsLive ? "status" : undefined}
          aria-live={encouragementIsLive ? "polite" : undefined}
        >
          {encouragement}
        </div>
      ) : null}
    </div>
  );
}
