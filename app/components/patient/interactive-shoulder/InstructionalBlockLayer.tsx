"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";

type InstructionalBlockLayerProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  snapshot: SessionOrchestratorSnapshot;
  presentationProgress: number | null;
  onPause: () => void;
  onResume: () => void;
};

function formatRemainingSeconds(snapshot: SessionOrchestratorSnapshot): number | null {
  const block = snapshot.currentBlock;
  if (!block?.targetDurationSeconds) return null;
  const remaining = Math.max(0, block.targetDurationSeconds - snapshot.blockElapsedSeconds);
  return Math.ceil(remaining);
}

export function InstructionalBlockLayer({
  language,
  arClass = "",
  snapshot,
  presentationProgress,
  onPause,
  onResume,
}: InstructionalBlockLayerProps) {
  const ui = interactiveShoulderUi(language);
  const block = snapshot.currentBlock;
  const remaining = formatRemainingSeconds(snapshot);
  const progressPercent =
    presentationProgress != null
      ? Math.round(presentationProgress * 100)
      : Math.round(snapshot.blockProgress * 100);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const title = block?.title ?? ui.movementBlockLabel;
  const instructions = block?.instructions ?? ui.blockInstructions;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`min-w-0 flex-1 rounded-[10px] border border-[#1E2D42]/70 bg-[#0F1825]/88 px-3 py-2.5 text-white backdrop-blur-sm ${arClass}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#5DCAA5]/80">
              {title}
            </p>
            <p className="text-[10px] text-white/45">{ui.movementBlockLabel}</p>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-white/85">{instructions}</p>
          <p className="mt-2 text-sm font-bold">
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
    </div>
  );
}
