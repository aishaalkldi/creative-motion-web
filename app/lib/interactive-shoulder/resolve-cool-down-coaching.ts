import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

const COOL_DOWN_COACHING: Record<
  PatientExerciseLanguage,
  { start: string; middle: string; almostDone: string }
> = {
  en: {
    start: "Slowly lower your arm to a comfortable resting position.",
    middle: "Relax your shoulder and take a calm breath.",
    almostDone: "Almost done.",
  },
  ar: {
    start: "اخفض ذراعك ببطء إلى وضع مريح.",
    middle: "أرخِ كتفك وخذ نفسًا هادئًا.",
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
