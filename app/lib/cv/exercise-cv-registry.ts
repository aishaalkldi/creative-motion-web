/**
 * Shared exercise → CV tracker registry (v0).
 *
 * Additive only. This registry does not replace the existing hardcoded
 * dispatch in `cv-patient-config.ts` (`resolvePatientCvDetectorKind`) or
 * `PatientCvCapture.tsx`'s exerciseId ternary chain — those keep routing
 * the other seven CV exercises exactly as they do today. This registry is
 * the new, canonical routing mechanism going forward, proven here against
 * exactly one exercise (Shoulder Abduction Reach). Migrating the existing
 * seven onto this pattern is explicitly out of scope for this change.
 *
 * The registry configures which tracker to invoke — it does not implement
 * tracking. `detectorResolver` returns a constructor reference; the caller
 * is responsible for instantiating it and driving its lifecycle, same
 * calling convention every existing `*-pose-detector.ts` class already
 * uses (`new X(callbacks, ...)`).
 */

import { DEFAULT_STS_CONFIG } from "@/app/lib/cv/bio-0-contracts";
import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import {
  ShoulderAbductionReachPoseDetector,
  type ShoulderAbductionReachPoseDetectorCallbacks,
} from "@/app/lib/cv/shoulder-abduction-reach-pose-detector";

export type ExerciseCvSupportedPosition = "seated" | "standing";

/** 'none' | 'shadow' | 'live' — matches the terminology already used by the shoulder-rehabilitation shadow-mode module. */
export type ExerciseCvShadowModeStatus = "none" | "shadow" | "live";

export type ExerciseCvCalibrationProfile = {
  bodyFramingProfileId: BodyFramingProfileId;
  wasmUrl: string;
  modelUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initTimeoutMs: number;
};

export type ExerciseCvRegistryEntry = {
  exerciseId: string;
  trackerKey: string;
  supportedPositions: readonly ExerciseCvSupportedPosition[];
  calibrationProfile: ExerciseCvCalibrationProfile;
  requiredLandmarks: readonly string[];
  /** Returns a constructor reference, not an instance — caller instantiates with `new`. */
  detectorResolver: () => new (
    callbacks: ShoulderAbductionReachPoseDetectorCallbacks,
    primarySide?: "left" | "right",
  ) => ShoulderAbductionReachPoseDetector;
  /**
   * Points at a reusable Feedback Layer / Target Sequence component the
   * Session Environment mounts for the current block — not an
   * exercise-owned overlay. Not implemented until PR3; the key is reserved
   * here so the registry shape doesn't change when it lands.
   */
  feedbackLayerKey: string | null;
  shadowModeStatus: ExerciseCvShadowModeStatus;
};

const SHOULDER_ABDUCTION_REACH_ENTRY: ExerciseCvRegistryEntry = {
  exerciseId: "shoulder-abduction-reach",
  trackerKey: "shoulder-abduction-reach",
  supportedPositions: ["seated", "standing"],
  calibrationProfile: {
    bodyFramingProfileId: "upper-limb-reach",
    wasmUrl: DEFAULT_STS_CONFIG.wasmUrl,
    modelUrl: DEFAULT_STS_CONFIG.modelUrl,
    canvasWidth: DEFAULT_STS_CONFIG.canvasWidth,
    canvasHeight: DEFAULT_STS_CONFIG.canvasHeight,
    initTimeoutMs: DEFAULT_STS_CONFIG.initTimeoutMs,
  },
  requiredLandmarks: ["left_hip", "left_shoulder", "left_elbow", "left_wrist"],
  detectorResolver: () => ShoulderAbductionReachPoseDetector,
  feedbackLayerKey: null,
  shadowModeStatus: "live",
};

const REGISTRY: Record<string, ExerciseCvRegistryEntry> = {
  "shoulder-abduction-reach": SHOULDER_ABDUCTION_REACH_ENTRY,
};

export function getExerciseCvRegistryEntry(exerciseId: string): ExerciseCvRegistryEntry | null {
  return REGISTRY[exerciseId] ?? null;
}

export function isExerciseCvRegistered(exerciseId: string): boolean {
  return exerciseId in REGISTRY;
}

export function listExerciseCvRegistryEntries(): readonly ExerciseCvRegistryEntry[] {
  return Object.values(REGISTRY);
}
