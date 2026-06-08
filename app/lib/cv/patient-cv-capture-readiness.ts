/**
 * Patient CV pre-capture readiness — setup checks from detector snapshot only.
 * No raw landmarks. No detector changes.
 */

import type { PatientCvExerciseId } from "@/app/lib/cv/bio-0-contracts";
import type { BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import type {
  PoseReadiness,
  SitToStandDetectorSnapshot,
  SitToStandTrackingQuality,
  SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";

export const CAPTURE_SETUP_LIMITED_FLAG = "capture_setup_limited";
export const CAPTURE_READINESS_STABLE_SECONDS = 3;

export type CaptureReadinessCheckId =
  | "body_visible"
  | "lower_joints_visible"
  | "feet_visible"
  | "upper_reach_visible"
  | "correct_distance"
  | "lighting_acceptable"
  | "tracking_stable";

export type CaptureReadinessCheck = {
  id: CaptureReadinessCheckId;
  met: boolean;
  required: boolean;
};

export type CaptureReadinessSnapshot = Pick<
  SitToStandDetectorSnapshot,
  | "trackingStatus"
  | "trackingQuality"
  | "poseReadiness"
  | "bodyFramingState"
  | "previewActive"
>;

export type CaptureReadinessEvaluation = {
  checks: CaptureReadinessCheck[];
  minimumMet: boolean;
  allRequiredMet: boolean;
  stableSeconds: number;
  canStartTracking: boolean;
  primaryGuidance: CaptureSetupGuidance;
};

export type CaptureSetupGuidance =
  | "ready"
  | "move_farther"
  | "step_into_frame"
  | "improve_lighting"
  | "show_feet"
  | "keep_reach_arm_in_frame"
  | "adjust_position";

export type StableTrackingState = {
  stableSinceMs: number | null;
  stableSeconds: number;
};

function isBodyVisible(trackingStatus: SitToStandTrackingStatus): boolean {
  return trackingStatus === "pose-found" || trackingStatus === "detecting";
}

function isLowerJointsVisible(poseReadiness: PoseReadiness): boolean {
  return poseReadiness === "ready" || poseReadiness === "partial";
}

function isFeetVisible(
  poseReadiness: PoseReadiness,
  bodyFramingState: BodyFramingState,
  trackingStatus: SitToStandTrackingStatus,
): boolean {
  if (trackingStatus === "pose-lost" || poseReadiness === "not_ready") return false;
  if (bodyFramingState === "low_visibility") return false;
  return poseReadiness === "ready" || poseReadiness === "partial";
}

function isUpperReachVisible(
  poseReadiness: PoseReadiness,
  trackingQuality: SitToStandTrackingQuality | null,
  trackingStatus: SitToStandTrackingStatus,
): boolean {
  if (trackingStatus === "pose-lost") return false;
  return poseReadiness === "ready" && trackingQuality !== "poor";
}

function isCorrectDistance(bodyFramingState: BodyFramingState): boolean {
  return bodyFramingState === "good_distance";
}

function isLightingAcceptable(
  trackingQuality: SitToStandTrackingQuality | null,
  bodyFramingState: BodyFramingState,
): boolean {
  if (bodyFramingState === "low_visibility") return false;
  return trackingQuality !== "poor";
}

function exerciseRequiresFeet(exerciseId: PatientCvExerciseId): boolean {
  return (
    exerciseId === "heel-raise" ||
    exerciseId === "step-up" ||
    exerciseId === "lateral-step" ||
    exerciseId === "mini-squat" ||
    exerciseId === "single-leg-stance"
  );
}

function exerciseRequiresUpperReach(exerciseId: PatientCvExerciseId): boolean {
  return exerciseId === "functional-reach";
}

function exerciseRequiresDistance(exerciseId: PatientCvExerciseId): boolean {
  return exerciseId === "heel-raise" || exerciseId === "sit-to-stand";
}

export function requiredReadinessChecksForExercise(
  exerciseId: PatientCvExerciseId,
): CaptureReadinessCheckId[] {
  const checks: CaptureReadinessCheckId[] = [
    "body_visible",
    "lower_joints_visible",
    "lighting_acceptable",
    "tracking_stable",
  ];
  if (exerciseRequiresFeet(exerciseId)) checks.splice(2, 0, "feet_visible");
  if (exerciseRequiresUpperReach(exerciseId)) checks.splice(2, 0, "upper_reach_visible");
  if (exerciseRequiresDistance(exerciseId)) checks.splice(2, 0, "correct_distance");
  return checks;
}

export function evaluateCaptureReadinessChecks(
  exerciseId: PatientCvExerciseId,
  snapshot: CaptureReadinessSnapshot,
  stableSeconds: number,
): CaptureReadinessCheck[] {
  const requiredIds = new Set(requiredReadinessChecksForExercise(exerciseId));
  const {
    trackingStatus,
    trackingQuality,
    poseReadiness,
    bodyFramingState,
  } = snapshot;

  const values: Record<CaptureReadinessCheckId, boolean> = {
    body_visible: isBodyVisible(trackingStatus),
    lower_joints_visible: isLowerJointsVisible(poseReadiness),
    feet_visible: isFeetVisible(poseReadiness, bodyFramingState, trackingStatus),
    upper_reach_visible: isUpperReachVisible(
      poseReadiness,
      trackingQuality,
      trackingStatus,
    ),
    correct_distance: isCorrectDistance(bodyFramingState),
    lighting_acceptable: isLightingAcceptable(trackingQuality, bodyFramingState),
    tracking_stable: stableSeconds >= CAPTURE_READINESS_STABLE_SECONDS,
  };

  const allIds: CaptureReadinessCheckId[] = [
    "body_visible",
    "lower_joints_visible",
    "feet_visible",
    "upper_reach_visible",
    "correct_distance",
    "lighting_acceptable",
    "tracking_stable",
  ];

  return allIds.map((id) => ({
    id,
    met: values[id],
    required: requiredIds.has(id),
  }));
}

export function resolveCaptureSetupGuidance(
  exerciseId: PatientCvExerciseId,
  snapshot: CaptureReadinessSnapshot,
): CaptureSetupGuidance {
  const { trackingStatus, poseReadiness, bodyFramingState, trackingQuality } =
    snapshot;

  if (trackingStatus === "pose-lost" || poseReadiness === "not_ready") {
    return "step_into_frame";
  }
  if (bodyFramingState === "move_back") return "move_farther";
  if (bodyFramingState === "move_closer") return "step_into_frame";
  if (
    bodyFramingState === "low_visibility" ||
    trackingQuality === "poor"
  ) {
    return "improve_lighting";
  }
  if (
    exerciseRequiresFeet(exerciseId) &&
    !isFeetVisible(poseReadiness, bodyFramingState, trackingStatus)
  ) {
    return "show_feet";
  }
  if (
    exerciseRequiresUpperReach(exerciseId) &&
    !isUpperReachVisible(poseReadiness, trackingQuality, trackingStatus)
  ) {
    return "keep_reach_arm_in_frame";
  }
  if (
    isBodyVisible(trackingStatus) &&
    isLowerJointsVisible(poseReadiness) &&
    isLightingAcceptable(trackingQuality, bodyFramingState)
  ) {
    return "ready";
  }
  return "adjust_position";
}

export function evaluateCaptureReadiness(
  exerciseId: PatientCvExerciseId,
  snapshot: CaptureReadinessSnapshot,
  stableSeconds: number,
): CaptureReadinessEvaluation {
  const checks = evaluateCaptureReadinessChecks(exerciseId, snapshot, stableSeconds);
  const requiredChecks = checks.filter((c) => c.required);
  const minimumChecks = requiredChecks.filter((c) => c.id !== "tracking_stable");
  const minimumMet = minimumChecks.every((c) => c.met);
  const allRequiredMet = requiredChecks.every((c) => c.met);
  const canStartTracking = allRequiredMet;

  return {
    checks,
    minimumMet,
    allRequiredMet,
    stableSeconds,
    canStartTracking,
    primaryGuidance: resolveCaptureSetupGuidance(exerciseId, snapshot),
  };
}

export function updateStableTrackingState(
  state: StableTrackingState,
  minimumMet: boolean,
  nowMs: number,
): StableTrackingState {
  if (!minimumMet) {
    return { stableSinceMs: null, stableSeconds: 0 };
  }
  const since = state.stableSinceMs ?? nowMs;
  return {
    stableSinceMs: since,
    stableSeconds: Math.max(0, (nowMs - since) / 1000),
  };
}

export function shouldFlagCaptureSetupLimited(
  startedWithOverride: boolean,
  evaluation: CaptureReadinessEvaluation,
): boolean {
  return startedWithOverride || !evaluation.allRequiredMet;
}

export function mergeClinicianFlags(
  base: string[],
  extra?: string[] | null,
): string[] {
  const flags = new Set<string>(base);
  for (const flag of extra ?? []) {
    if (flag.trim()) flags.add(flag);
  }
  return [...flags].sort();
}
