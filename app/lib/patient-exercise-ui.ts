import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

type SessionExerciseUi = {
  exerciseOf: string;
  safetyBanner: string;
  whyThisMatters: string;
  stopIf: string;
  therapistNote: string;
  doseFallback: string;
  asPrescribed: string;
};

const SESSION_EXERCISE_UI: Record<PatientExerciseLanguage, SessionExerciseUi> = {
  en: {
    exerciseOf: "Exercise {current} of {total}",
    safetyBanner:
      "Move slowly and stop if you feel sharp pain, dizziness, or unusual symptoms.",
    whyThisMatters: "Why this matters:",
    stopIf: "Stop if:",
    therapistNote: "Note from your therapist:",
    doseFallback: "As prescribed by your therapist",
    asPrescribed: "As prescribed by your therapist",
  },
  ar: {
    exerciseOf: "التمرين {current} من {total}",
    safetyBanner:
      "تحرّك ببطء وتوقّف إذا شعرت بألم حاد أو دوخة أو أعراض غير معتادة.",
    whyThisMatters: "لماذا هذا مهم:",
    stopIf: "توقّف إذا:",
    therapistNote: "ملاحظة من معالجك:",
    doseFallback: "حسب ما وصفه معالجك",
    asPrescribed: "حسب ما وصفه معالجك",
  },
};

export function sessionExerciseUi(lang: PatientExerciseLanguage): SessionExerciseUi {
  return SESSION_EXERCISE_UI[lang];
}

export function formatExerciseProgress(
  lang: PatientExerciseLanguage,
  current: number,
  total: number,
): string {
  return sessionExerciseUi(lang).exerciseOf
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}
