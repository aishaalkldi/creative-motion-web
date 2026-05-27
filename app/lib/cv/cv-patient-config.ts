/**
 * Sprint CV-Y1 — patient-facing CV exercise allowlist (foundation).
 * Sprint CV-Y1B-Fix — patient Sit-to-Stand detector tuning (baseline rep counting).
 */

import { DEFAULT_STS_CONFIG, type SitToStandCvConfig } from "@/app/lib/cv/bio-0-contracts";

export const CV_Y1_ENABLED_EXERCISE_IDS = ["sit-to-stand"] as const;

export type CvY1ExerciseId = (typeof CV_Y1_ENABLED_EXERCISE_IDS)[number];

export function isCvEnabledExercise(exerciseId: string | undefined | null): boolean {
  if (!exerciseId?.trim()) return false;
  const normalized = exerciseId.trim().toLowerCase();
  return (CV_Y1_ENABLED_EXERCISE_IDS as readonly string[]).includes(normalized);
}

export const CV_PATIENT_PROTOTYPE_VERSION = "y1";

export const CV_MIN_SAVE_DURATION_S = 3;

/** Patient portal only — relative seated hip baseline; CV Lab keeps DEFAULT_STS_CONFIG. */
export const PATIENT_STS_CONFIG: SitToStandCvConfig = {
  ...DEFAULT_STS_CONFIG,
  repCountingMode: "baseline",
  baselineDurationMs: 2_000,
  baselineStandDelta: 0.09,
  baselineResetDelta: 0.04,
  minMsBetweenReps: 900,
  fallbackSeatedHipY: 0.55,
};
