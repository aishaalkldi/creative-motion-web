/**
 * Patient CV camera setup wizard — pre-tracking checks only (not clinical scoring).
 * On-device signals from existing pose/framing state; nothing persisted.
 */

import type { BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import type { PatientCvExerciseId } from "@/app/lib/cv/bio-0-contracts";
import type {
  PoseReadiness,
  SitToStandTrackingQuality,
  SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";

export type CameraSetupWizardState =
  | "ready_to_start"
  | "move_back"
  | "move_closer"
  | "improve_lighting"
  | "show_feet_ankles"
  | "adjust_camera_angle";

export type CameraSetupCheckId =
  | "body_visible"
  | "correct_distance"
  | "feet_ankles_visible"
  | "lighting_acceptable";

export type CameraSetupCheck = {
  id: CameraSetupCheckId;
  passed: boolean;
};

export type CameraSetupEvaluateInput = {
  exerciseId: PatientCvExerciseId;
  trackingStatus: SitToStandTrackingStatus;
  poseReadiness: PoseReadiness;
  bodyFramingState: BodyFramingState;
  trackingQuality: SitToStandTrackingQuality | null;
};

export function evaluateCameraSetupChecks(input: CameraSetupEvaluateInput): CameraSetupCheck[] {
  const { trackingStatus, poseReadiness, bodyFramingState, trackingQuality } = input;

  const bodyVisible =
    trackingStatus === "pose-found" &&
    poseReadiness !== "not_ready" &&
    poseReadiness !== "checking";

  const correctDistance = bodyFramingState === "good_distance";

  const feetAnklesVisible =
    trackingStatus === "pose-found" &&
    bodyFramingState !== "adjust_camera_angle" &&
    bodyFramingState !== "low_visibility" &&
    (poseReadiness === "ready" || poseReadiness === "partial");

  const lightingAcceptable =
    trackingStatus === "pose-found" &&
    bodyFramingState !== "low_visibility" &&
    trackingQuality !== "poor";

  return [
    { id: "body_visible", passed: bodyVisible },
    { id: "correct_distance", passed: correctDistance },
    { id: "feet_ankles_visible", passed: feetAnklesVisible },
    { id: "lighting_acceptable", passed: lightingAcceptable },
  ];
}

export function isCameraSetupReady(checks: CameraSetupCheck[]): boolean {
  return checks.every((c) => c.passed);
}

export function resolveCameraSetupWizardState(
  input: CameraSetupEvaluateInput,
): CameraSetupWizardState {
  const checks = evaluateCameraSetupChecks(input);
  if (isCameraSetupReady(checks)) return "ready_to_start";

  const { exerciseId, trackingStatus, bodyFramingState, trackingQuality } = input;

  if (bodyFramingState === "move_back") return "move_back";
  if (bodyFramingState === "move_closer") return "move_closer";

  if (
    trackingStatus === "pose-lost" ||
    bodyFramingState === "low_visibility" ||
    trackingQuality === "poor"
  ) {
    return "improve_lighting";
  }

  if (bodyFramingState === "adjust_camera_angle") {
    return exerciseId === "heel-raise" ? "show_feet_ankles" : "adjust_camera_angle";
  }

  const feetCheck = checks.find((c) => c.id === "feet_ankles_visible");
  if (feetCheck && !feetCheck.passed && exerciseId === "heel-raise") {
    return "show_feet_ankles";
  }

  if (!checks.find((c) => c.id === "body_visible")?.passed) {
    return "improve_lighting";
  }

  return "adjust_camera_angle";
}

export type CameraSetupWizardLabels = {
  ready_to_start: string;
  move_back: string;
  move_closer: string;
  improve_lighting: string;
  show_feet_ankles: string;
  adjust_camera_angle: string;
};

export function cameraSetupWizardStateLabel(
  state: CameraSetupWizardState,
  labels: CameraSetupWizardLabels,
): string {
  return labels[state];
}

export type CameraSetupCheckLabels = {
  body_visible: string;
  correct_distance: string;
  feet_ankles_visible: string;
  lighting_acceptable: string;
};

export function cameraSetupCheckLabel(
  id: CameraSetupCheckId,
  labels: CameraSetupCheckLabels,
): string {
  return labels[id];
}
