/**
 * Sprint CV-Y1 — patient-facing CV exercise allowlist (foundation).
 * Sprint CV-Y1B-Fix — patient Sit-to-Stand detector tuning (baseline rep counting).
 */

import { DEFAULT_STS_CONFIG, type SitToStandCvConfig } from "@/app/lib/cv/bio-0-contracts";
import {
  LAB_HEEL_RAISE_REP_CONFIG,
  type HeelRaiseRepConfig,
} from "@/app/lib/cv/heel-raise-detector";
import {
  LAB_SLS_HOLD_CONFIG,
  type SingleLegStanceHoldConfig,
} from "@/app/lib/cv/single-leg-stance-detector";

/** Patient-portal CV allowlist. Heel-raise detector remains for lab/tests; patient CV disabled until validated (PR51). */
export const CV_Y1_ENABLED_EXERCISE_IDS = [
  "sit-to-stand",
  "mini-squat",
  "single-leg-stance",
] as const;

export type CvY1ExerciseId = (typeof CV_Y1_ENABLED_EXERCISE_IDS)[number];

export function isCvEnabledExercise(exerciseId: string | undefined | null): boolean {
  if (!exerciseId?.trim()) return false;
  const normalized = exerciseId.trim().toLowerCase();
  return (CV_Y1_ENABLED_EXERCISE_IDS as readonly string[]).includes(normalized);
}

export const CV_PATIENT_PROTOTYPE_VERSION = "y1";

export const CV_MIN_SAVE_DURATION_S = 3;

/** MediaPipe shell for patient single-leg stance capture. */
export const PATIENT_SLS_POSE_SHELL = {
  wasmUrl: DEFAULT_STS_CONFIG.wasmUrl,
  modelUrl: DEFAULT_STS_CONFIG.modelUrl,
  canvasWidth: DEFAULT_STS_CONFIG.canvasWidth,
  canvasHeight: DEFAULT_STS_CONFIG.canvasHeight,
  initTimeoutMs: DEFAULT_STS_CONFIG.initTimeoutMs,
  uiFrameUpdateInterval: DEFAULT_STS_CONFIG.uiFrameUpdateInterval,
  landmarkDotColor: DEFAULT_STS_CONFIG.landmarkDotColor,
  lowerBodyLandmarkIndices: DEFAULT_STS_CONFIG.lowerBodyLandmarkIndices,
  prototypeVersion: "cv-y3-single-leg-stance",
  landmarksOverlayOnly: true,
} as const;

/** Patient portal hold FSM tuning — separate from LAB_SLS_HOLD_CONFIG. */
export const PATIENT_SLS_HOLD_CONFIG: SingleLegStanceHoldConfig = {
  ...LAB_SLS_HOLD_CONFIG,
  readinessCheckMs: 2_000,
};

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
  /** MQ-READY-0: mobile-first readiness gate before rep counting (not persisted). */
  readinessEnabled: true,
  readinessCheckMs: 2_000,
  minHipVisibility: 0.35,
  bodyFramingProfileId: "seated-rise",
  landmarksOverlayOnly: true,
  motionTimelineEnabled: true,
};

/**
 * Patient portal only — standing hip baseline; drop polarity rep counting.
 * Separate thresholds from PATIENT_STS_CONFIG (never mutate STS).
 */
export const PATIENT_MINI_SQUAT_CONFIG: SitToStandCvConfig = {
  ...DEFAULT_STS_CONFIG,
  repCountingMode: "baseline",
  baselineDurationMs: 3_000,
  baselineStandDelta: 0.06,
  baselineResetDelta: 0.03,
  minMsBetweenReps: 1_000,
  fallbackSeatedHipY: 0.45,
  baselineScaleByTorso: true,
  baselineStandDeltaRatio: 0.11,
  baselineResetDeltaRatio: 0.055,
  baselineStandDeltaMin: 0.025,
  baselineResetDeltaMin: 0.015,
  readinessEnabled: true,
  readinessCheckMs: 2_000,
  minHipVisibility: 0.35,
  prototypeVersion: "cv-y2-mini-squat",
  bodyFramingProfileId: "standing-sagittal-rep",
  landmarksOverlayOnly: true,
};

/** MediaPipe shell for patient double heel raise capture. */
export const PATIENT_HEEL_RAISE_POSE_SHELL = {
  wasmUrl: DEFAULT_STS_CONFIG.wasmUrl,
  modelUrl: DEFAULT_STS_CONFIG.modelUrl,
  canvasWidth: DEFAULT_STS_CONFIG.canvasWidth,
  canvasHeight: DEFAULT_STS_CONFIG.canvasHeight,
  initTimeoutMs: DEFAULT_STS_CONFIG.initTimeoutMs,
  uiFrameUpdateInterval: DEFAULT_STS_CONFIG.uiFrameUpdateInterval,
  landmarkDotColor: DEFAULT_STS_CONFIG.landmarkDotColor,
  lowerBodyLandmarkIndices: DEFAULT_STS_CONFIG.lowerBodyLandmarkIndices,
  landmarksOverlayOnly: true,
} as const;

/** Patient portal double heel raise rep tuning — separate from LAB_HEEL_RAISE_REP_CONFIG. */
export const PATIENT_HEEL_RAISE_REP_CONFIG: HeelRaiseRepConfig = {
  ...LAB_HEEL_RAISE_REP_CONFIG,
  baselineDurationMs: 3_000,
  minMsBetweenReps: 800,
  minAnkleVisibility: 0.3,
  minSaveDurationS: CV_MIN_SAVE_DURATION_S,
};

/** Readiness gate before rep counting (not persisted). */
export const PATIENT_HEEL_RAISE_READINESS_MS = 2_000;
