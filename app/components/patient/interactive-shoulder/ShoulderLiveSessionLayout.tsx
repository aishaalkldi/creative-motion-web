"use client";

import type { ReactNode } from "react";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import { SoundToggleButton } from "./SoundToggleButton";

export type ShoulderLivePhaseAccent = "warmup" | "cooldown" | "exercise";

type ShoulderLiveSessionLayoutProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  phaseLabel: string;
  phaseAccent?: ShoulderLivePhaseAccent;
  title: string;
  timer?: string | null;
  blockProgressPercent: number;
  sessionProgressPercent: number;
  metrics?: ReactNode;
  guidanceMessage?: string | null;
  pausedOrHold: boolean;
  onPause: () => void;
  onResume: () => void;
  controlsLocked?: boolean;
  soundMuted: boolean;
  onSoundToggle: () => void;
};

function phaseAccentClass(accent: ShoulderLivePhaseAccent): string {
  if (accent === "cooldown") return "border-[#5B8DEF]/40 bg-[#5B8DEF]/12 text-[#A8C7FF]";
  if (accent === "warmup") return "border-[#1D9E75]/35 bg-[#1D9E75]/10 text-[#5DCAA5]";
  return "border-[#1D9E75]/35 bg-[#1D9E75]/10 text-[#5DCAA5]";
}

function progressBarClass(accent: ShoulderLivePhaseAccent): string {
  if (accent === "cooldown") return "bg-gradient-to-r from-[#5B8DEF] to-[#8CB4FF]";
  return "bg-gradient-to-r from-[#1D9E75] to-[#5DCAA5]";
}

export function ShoulderLiveSessionLayout({
  language,
  arClass = "",
  phaseLabel,
  phaseAccent = "exercise",
  title,
  timer = null,
  blockProgressPercent,
  sessionProgressPercent,
  metrics,
  guidanceMessage = null,
  pausedOrHold,
  onPause,
  onResume,
  controlsLocked = false,
  soundMuted,
  onSoundToggle,
}: ShoulderLiveSessionLayoutProps) {
  const ui = interactiveShoulderUi(language);
  const blockPct = Math.min(100, Math.max(0, blockProgressPercent));
  const sessionPct = Math.min(100, Math.max(0, sessionProgressPercent));

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
      <div className="flex items-start justify-end gap-2 p-3 sm:p-4">
        <SoundToggleButton
          language={language}
          muted={soundMuted}
          onToggle={onSoundToggle}
          className="pointer-events-auto !px-2.5 !py-1.5 !text-[10px] sm:!text-[11px]"
        />
        {controlsLocked ? null : (
          <button
            type="button"
            className="pointer-events-auto rounded-[10px] border border-white/20 bg-[#0F1825]/85 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5DCAA5] sm:px-3.5 sm:py-2 sm:text-[12px]"
            onClick={pausedOrHold ? onResume : onPause}
            aria-label={pausedOrHold ? ui.resumeAriaLabel : ui.pauseAriaLabel}
          >
            {pausedOrHold ? ui.resume : ui.pause}
          </button>
        )}
      </div>

      <div className="flex flex-1 justify-end px-3 pb-3 sm:px-4 sm:pb-4">
        <aside
          className={`pointer-events-none w-[min(100%,13.5rem)] rounded-[12px] border border-white/12 bg-[#0A0F1A]/72 px-3 py-3 text-white shadow-[0_8px_32px_rgba(10,15,26,0.28)] backdrop-blur-md sm:w-56 sm:px-4 sm:py-3.5 lg:w-60 xl:w-64 ${arClass}`}
          aria-label={ui.currentBlockLabel}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex max-w-[70%] items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] sm:text-[10px] ${phaseAccentClass(phaseAccent)}`}
            >
              {phaseLabel}
            </span>
            {timer ? (
              <span className="text-base font-bold tabular-nums text-white sm:text-lg" dir="ltr">
                {timer}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-[15px] font-semibold leading-tight text-white sm:text-[16px] lg:text-[17px]">
            {title}
          </p>

          {metrics ? <div className="mt-3 space-y-2">{metrics}</div> : null}

          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[9px] text-white/50 sm:text-[10px]">
                <span>{ui.blockLabel}</span>
                <span dir="ltr">{ui.blockProgressPercent(blockPct)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10 sm:h-2">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${progressBarClass(phaseAccent)}`}
                  style={{ width: `${blockPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[9px] text-white/50 sm:text-[10px]">
                <span>{ui.sessionProgressLabel}</span>
                <span dir="ltr">{ui.blockProgressPercent(sessionPct)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10 sm:h-1.5">
                <div
                  className="h-full rounded-full bg-white/35 transition-[width] duration-300"
                  style={{ width: `${sessionPct}%` }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {guidanceMessage ? (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <p
            className={`mx-auto max-w-3xl rounded-[10px] border border-white/10 bg-[#0A0F1A]/78 px-4 py-2.5 text-center text-[12px] font-medium leading-snug text-white/85 backdrop-blur-sm sm:text-[13px] lg:text-[14px] ${arClass}`}
            role="status"
            aria-live="polite"
          >
            {guidanceMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ShoulderLiveMetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/8 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[10px] uppercase tracking-wide text-white/45 sm:text-[11px]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-white sm:text-base" dir="ltr">
        {value}
      </span>
    </div>
  );
}
