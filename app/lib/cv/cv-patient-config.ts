/**
 * Sprint CV-Y1 — patient-facing CV exercise allowlist (foundation).
 */

export const CV_Y1_ENABLED_EXERCISE_IDS = ["sit-to-stand"] as const;

export type CvY1ExerciseId = (typeof CV_Y1_ENABLED_EXERCISE_IDS)[number];

export function isCvEnabledExercise(exerciseId: string | undefined | null): boolean {
  if (!exerciseId?.trim()) return false;
  const normalized = exerciseId.trim().toLowerCase();
  return (CV_Y1_ENABLED_EXERCISE_IDS as readonly string[]).includes(normalized);
}

export const CV_PATIENT_PROTOTYPE_VERSION = "y1";

export const CV_MIN_SAVE_DURATION_S = 3;
