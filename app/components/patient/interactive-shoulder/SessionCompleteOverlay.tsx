"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";

type SessionCompleteOverlayProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  blocksCompleted: number;
  repetitionsCompleted: number;
  durationSeconds: number;
  targetsReached: number;
  patternsCompleted: number;
};

export function SessionCompleteOverlay({
  language,
  arClass = "",
  blocksCompleted,
  repetitionsCompleted,
  durationSeconds,
  targetsReached,
  patternsCompleted,
}: SessionCompleteOverlayProps) {
  const ui = interactiveShoulderUi(language);
  const interactionsCompleted = targetsReached + patternsCompleted;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-[#0A0F1A]/80 via-[#0A0F1A]/35 to-transparent p-3 sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`w-full max-w-md rounded-[12px] border border-[#1D9E75]/35 bg-[#0F1825]/95 px-4 py-4 text-white shadow-[0_12px_40px_rgba(10,15,26,0.35)] sm:px-5 sm:py-5 ${arClass}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5DCAA5]">
          {ui.sessionCompleteTitle}
        </p>
        <p className="mt-2 text-[14px] font-semibold text-white">{ui.sessionCompleteHeadline}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/70">{ui.sessionCompleteEncouragement}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2">
            <dt className="text-white/50">{ui.blocksCompletedLabel}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-white" dir="ltr">
              {blocksCompleted}
            </dd>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2">
            <dt className="text-white/50">{ui.repetitionsCompletedLabel}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-white" dir="ltr">
              {repetitionsCompleted}
            </dd>
          </div>
          {interactionsCompleted > 0 ? (
            <div className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2">
              <dt className="text-white/50">{ui.interactionsCompletedLabel}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-white" dir="ltr">
                {interactionsCompleted}
              </dd>
            </div>
          ) : null}
          <div className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2">
            <dt className="text-white/50">{ui.durationLabel}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-white" dir="ltr">
              {ui.durationSeconds(durationSeconds)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[10px] leading-relaxed text-white/45">{ui.sessionCompleteReviewNote}</p>
      </div>
    </div>
  );
}
