/**
 * Bilingual copy for instructional blocks (Warm-up, Cool-down, and any
 * future presentation-only step). Not wired to any component yet — no
 * Neuro UI exists in this PR. Kept as its own module rather than added to
 * interactive-shoulder-ui.ts so this PR touches zero existing copy.
 */
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

export type InstructionalCopy = {
  /** Generic acknowledgement action label — e.g. a "ready to continue" control. */
  continueLabel: string;
  /** Fallback instruction text when a block doesn't supply its own. */
  defaultInstructions: string;
};

const INSTRUCTIONAL_COPY: Record<PatientExerciseLanguage, InstructionalCopy> = {
  en: {
    continueLabel: "Continue",
    defaultInstructions: "Follow the instructions, then continue when you're ready.",
  },
  ar: {
    continueLabel: "متابعة",
    defaultInstructions: "اتبع التعليمات، ثم تابع عندما تكون جاهزًا.",
  },
};

export function instructionalCopy(language: PatientExerciseLanguage): InstructionalCopy {
  return INSTRUCTIONAL_COPY[language];
}
