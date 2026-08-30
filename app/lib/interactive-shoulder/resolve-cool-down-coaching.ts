import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

const COOL_DOWN_COACHING: Record<
  PatientExerciseLanguage,
  { start: string; middle: string; almostDone: string }
> = {
  en: {
    start: "Slow down your movement and relax your shoulder.",
    middle: "Move gently and within a comfortable range.",
    almostDone: "Almost done.",
  },
  ar: {
    start: "خفّف سرعة الحركة وأرخِ كتفك.",
    middle: "تحرّك بهدوء وضمن مدى مريح.",
    almostDone: "أوشكت على الانتهاء.",
  },
};

export function resolveCoolDownCoachingMessage(
  language: PatientExerciseLanguage,
  remainingSeconds: number | null,
): string {
  const copy = COOL_DOWN_COACHING[language];
  if (remainingSeconds !== null && remainingSeconds <= 5) {
    return copy.almostDone;
  }
  if (remainingSeconds !== null && remainingSeconds <= 30) {
    return copy.middle;
  }
  return copy.start;
}

export function isCoolDownAlmostDonePhase(remainingSeconds: number | null): boolean {
  return remainingSeconds !== null && remainingSeconds <= 5;
}
