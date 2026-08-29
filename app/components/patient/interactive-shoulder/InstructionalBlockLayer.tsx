"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import {
  isCoolDownBlock,
  isWarmUpBlock,
  resolveBlockDisplayCopy,
} from "@/app/lib/interactive-shoulder/resolve-block-display-copy";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";

type InstructionalBlockLayerProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  snapshot: SessionOrchestratorSnapshot;
  presentationProgress: number | null;
  onPause: () => void;
  onResume: () => void;
  controlsLocked?: boolean;
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
  controlsLocked = false,
}: InstructionalBlockLayerProps) {
  const ui = interactiveShoulderUi(language);
  const block = snapshot.currentBlock;
  const remaining = formatRemainingSeconds(snapshot);
  const blockProgressPercent =
    presentationProgress != null
      ? Math.round(presentationProgress * 100)
      : Math.round(snapshot.blockProgress * 100);
  const sessionProgressPercent = Math.round(snapshot.sessionProgress * 100);
  const pausedOrHold = snapshot.isPaused || snapshot.safetyStatus === "hold";
  const copy = resolveBlockDisplayCopy(
    language,
    block?.blockId,
    block?.title ?? ui.movementBlockLabel,
    block?.instructions ?? ui.blockInstructions,
  );
  const isWarmUp = isWarmUpBlock(block?.blockId);
  const isCoolDown = isCoolDownBlock(block?.blockId);
  const accentClass = isCoolDown
    ? "from-[#5B8DEF] to-[#8CB4FF]"
    : isWarmUp
      ? "from-[#1D9E75] to-[#5DCAA5]"
      : "from-[#1D9E75] to-[#5DCAA5]";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-2 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`min-w-0 flex-1 rounded-[12px] border border-[#1E2D42]/70 bg-[#0F1825]/92 px-3 py-3 text-white backdrop-blur-sm sm:px-4 sm:py-3.5 ${arClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5DCAA5]">
              {copy.phaseLabel}
            </span>
            <span className="text-[10px] font-medium text-white/45">
              {ui.sessionProgressLabel} {ui.blockProgressPercent(sessionProgressPercent)}
            </span>
          </div>

          <p className="mt-3 text-[15px] font-semibold leading-snug text-white sm:text-[16px]">
            {copy.title}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/80 sm:text-[13px]">
            {copy.instructions}
          </p>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/45">{ui.currentBlockLabel}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-white" dir="ltr">
                {remaining !== null
                  ? ui.timeRemainingSeconds(remaining)
                  : ui.blockProgressPercent(blockProgressPercent)}
              </p>
            </div>
            <div className="min-w-[120px] flex-1">
              <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
                <span>{ui.blockLabel}</span>
                <span dir="ltr">{ui.blockProgressPercent(blockProgressPercent)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${accentClass} transition-[width] duration-300`}
                  style={{ width: `${Math.min(100, Math.max(0, blockProgressPercent))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
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

        {controlsLocked ? null : (
          <button
            type="button"
            className="pointer-events-auto shrink-0 rounded-[10px] border border-white/20 bg-[#0F1825]/92 px-3 py-2 text-[12px] font-semibold text-white/90 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5DCAA5]"
            onClick={pausedOrHold ? onResume : onPause}
            aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
          >
            {pausedOrHold ? ui.resume : ui.pause}
          </button>
        )}
      </div>

      {isCoolDown ? (
        <div className={`rounded-[10px] border border-white/10 bg-[#0F1825]/70 px-3 py-2 text-center text-[11px] text-white/70 ${arClass}`}>
          {copy.instructions}
        </div>
      ) : null}
    </div>
  );
}
