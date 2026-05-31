/**
 * Patient CV canvas overlay — landmark dots only (no skeleton lines or scores).
 */

import type { BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import type { PoseReadiness } from "@/app/lib/cv/sit-to-stand-detector";

export type PoseLandmark = {
  x: number;
  y: number;
  visibility?: number;
};

/** BlazePose indices — shoulders optional; hips, knees, ankles always drawn when visible. */
export const PATIENT_POSE_SHOULDER_INDICES = [11, 12] as const;
export const PATIENT_POSE_HIP_INDICES = [23, 24] as const;
export const PATIENT_POSE_KNEE_INDICES = [25, 26] as const;
export const PATIENT_POSE_ANKLE_INDICES = [27, 28] as const;

export const PATIENT_POSE_DOT_INDICES = [
  ...PATIENT_POSE_SHOULDER_INDICES,
  ...PATIENT_POSE_HIP_INDICES,
  ...PATIENT_POSE_KNEE_INDICES,
  ...PATIENT_POSE_ANKLE_INDICES,
] as const;

export type LiveBodySignal = "body_visible" | "adjust_position" | "move_back_lighting";

const READINESS_COLORS = {
  readyGood: "#1D9E75",
  readyPartial: "#F59E0B",
  notReady: "#9CA3AF",
} as const;

export function readinessOverlayColor(poseReadiness: PoseReadiness): string {
  if (poseReadiness === "checking" || poseReadiness === "not_ready") {
    return READINESS_COLORS.notReady;
  }
  if (poseReadiness === "partial") return READINESS_COLORS.readyPartial;
  return READINESS_COLORS.readyGood;
}

export type DrawPoseLandmarkDotsOptions = {
  includeShoulders?: boolean;
  dotRadius?: number;
  minVisibility?: number;
};

/** Draw hips, knees, ankles, and optional shoulders — dots only, no connecting lines. */
export function drawPoseLandmarkDots(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  width: number,
  height: number,
  poseReadiness: PoseReadiness,
  options: DrawPoseLandmarkDotsOptions = {},
): void {
  const { includeShoulders = true, dotRadius = 6, minVisibility = 0.2 } = options;
  const color = readinessOverlayColor(poseReadiness);
  const lowerBody = [
    ...PATIENT_POSE_HIP_INDICES,
    ...PATIENT_POSE_KNEE_INDICES,
    ...PATIENT_POSE_ANKLE_INDICES,
  ];
  const indices = includeShoulders
    ? [...PATIENT_POSE_SHOULDER_INDICES, ...lowerBody]
    : lowerBody;

  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm || (lm.visibility ?? 0) < minVisibility) continue;
    const x = lm.x * width;
    const y = lm.y * height;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function resolveLiveBodySignal(params: {
  trackingStatus: "idle" | "detecting" | "pose-found" | "pose-lost";
  poseReadiness: PoseReadiness;
  bodyFramingState: BodyFramingState;
}): LiveBodySignal {
  const { trackingStatus, poseReadiness, bodyFramingState } = params;

  if (
    trackingStatus === "pose-lost" ||
    bodyFramingState === "low_visibility" ||
    bodyFramingState === "move_back"
  ) {
    return "move_back_lighting";
  }

  if (
    trackingStatus === "pose-found" &&
    poseReadiness === "ready" &&
    bodyFramingState === "good_distance"
  ) {
    return "body_visible";
  }

  return "adjust_position";
}
