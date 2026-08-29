"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { interactiveShoulderUi } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";

type SoundToggleButtonProps = {
  language: PatientExerciseLanguage;
  muted: boolean;
  onToggle: () => void;
  className?: string;
};

export function SoundToggleButton({
  language,
  muted,
  onToggle,
  className = "",
}: SoundToggleButtonProps) {
  const ui = interactiveShoulderUi(language);
  return (
    <button
      type="button"
      className={`pointer-events-auto rounded-[10px] border border-white/20 bg-[#0F1825]/88 px-3 py-2 text-[11px] font-semibold text-white/90 backdrop-blur-sm transition hover:border-[#1D9E75]/40 hover:bg-[#0F1825] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5DCAA5] ${className}`}
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? ui.soundUnmuteAria : ui.soundMuteAria}
    >
      {muted ? ui.soundOffLabel : ui.soundOnLabel}
    </button>
  );
}
