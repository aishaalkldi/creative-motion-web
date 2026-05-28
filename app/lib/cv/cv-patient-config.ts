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

/**
 * Patient portal only — relative seated hip baseline; CV Lab keeps DEFAULT_STS_CONFIG.
 * First baselineDurationMs: seated calibration (no reps). Patient should start seated.
 * Reps count on hip rise vs seated baseline; deltas scale by shoulder–hip span when visible.
 */
export const PATIENT_STS_CONFIG: SitToStandCvConfig = {
  ...DEFAULT_STS_CONFIG,
  repCountingMode: "baseline",
  baselineDurationMs: 3_000,
  /** Fixed fallback when shoulders are occluded (no pixel thresholds — normalized 0–1). */
  baselineStandDelta: 0.06,
  baselineResetDelta: 0.03,
  minMsBetweenReps: 800,
  fallbackSeatedHipY: 0.55,
  /** Scale stand/reset by shoulder–hip span so far vs close framing counts similarly. */
  baselineScaleByTorso: true,
  /** Hip rise threshold = ratio×torsoSpan, capped at baselineStandDelta (see resolveBaselineDeltas). */
  baselineStandDeltaRatio: 0.18,
  baselineResetDeltaRatio: 0.08,
  baselineStandDeltaMin: 0.03,
  baselineResetDeltaMin: 0.015,
  readinessEnabled: true,
  readinessCheckMs: 2_000,
  minHipVisibility: 0.35,
};
