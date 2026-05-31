/**
 * Patient CV body framing evaluator — distance and landmark visibility only.
 * Not movement quality. Not persisted.
 */

import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";
import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";

export type BodyFramingState =
  | "checking"
  | "good_distance"
  | "move_back"
  | "move_closer"
  | "adjust_camera_angle"
  | "low_visibility";

export type BodyFramingProfile = {
  id: BodyFramingProfileId;
  minHipVisibility: number;
  minShoulderVisibility: number;
  requireNose: boolean;
  minNoseVisibility?: number;
  requireKnee: boolean;
  minKneeVisibility: number;
  /** Normalized shoulder–hip vertical span. */
  torsoSpanMin: number;
  torsoSpanMax: number;
  /** Normalized top-to-bottom span of key body landmarks. */
  bboxHeightMin: number;
  bboxHeightMax: number;
  /** Keep landmarks inside [margin, 1 - margin]. */
  frameMargin: number;
};

export type BodyFramingEvaluateInput = {
  checking: boolean;
  trackingQuality: "good" | "fair" | "poor" | null;
};

export const FRAMING_OVERLAY_COLORS = {
  good: "#1D9E75",
  amber: "#F59E0B",
} as const;

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;
const NOSE = 0;

function landmarkVis(landmark: PoseLandmark | undefined): number {
  return landmark?.visibility ?? 0;
}

function inFrame(x: number, y: number, margin: number): boolean {
  return x >= margin && x <= 1 - margin && y >= margin && y <= 1 - margin;
}

function torsoSpan(landmarks: PoseLandmark[]): number | null {
  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const lh = landmarks[L_HIP];
  const rh = landmarks[R_HIP];
  if (!ls || !rs || !lh || !rh) return null;
  return Math.abs((lh.y + rh.y) / 2 - (ls.y + rs.y) / 2);
}

function bodyBBoxHeight(landmarks: PoseLandmark[], profile: BodyFramingProfile): number | null {
  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const nose = landmarks[NOSE];
  const lk = landmarks[L_KNEE];
  const rk = landmarks[R_KNEE];
  const la = landmarks[L_ANKLE];
  const ra = landmarks[R_ANKLE];

  if (!ls || !rs) return null;

  const topY =
    profile.requireNose && nose && landmarkVis(nose) >= (profile.minNoseVisibility ?? 0.25)
      ? nose.y
      : (ls.y + rs.y) / 2;

  const bottomYs = [lk?.y, rk?.y, la?.y, ra?.y].filter((y): y is number => y !== undefined);
  if (bottomYs.length === 0) return null;

  const bottomY = Math.max(...bottomYs);
  return bottomY - topY;
}

function clipState(
  landmarks: PoseLandmark[],
  margin: number,
): "move_back" | "adjust_camera_angle" | null {
  const points = [
    landmarks[L_SHOULDER],
    landmarks[R_SHOULDER],
    landmarks[L_HIP],
    landmarks[R_HIP],
    landmarks[NOSE],
    landmarks[L_KNEE],
    landmarks[R_KNEE],
  ].filter(Boolean) as PoseLandmark[];

  for (const p of points) {
    if (!inFrame(p.x, p.y, margin)) {
      if (p.y < margin || p.y > 1 - margin) return "move_back";
      return "adjust_camera_angle";
    }
  }
  return null;
}

export function evaluateBodyFraming(
  landmarks: PoseLandmark[],
  profile: BodyFramingProfile,
  input: BodyFramingEvaluateInput,
): BodyFramingState {
  if (input.checking) return "checking";

  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const lh = landmarks[L_HIP];
  const rh = landmarks[R_HIP];
  const nose = landmarks[NOSE];
  const lk = landmarks[L_KNEE];
  const rk = landmarks[R_KNEE];

  const clipped = clipState(landmarks, profile.frameMargin);
  if (clipped) return clipped;

  const hipVisL = landmarkVis(lh);
  const hipVisR = landmarkVis(rh);
  const shoulderVisL = landmarkVis(ls);
  const shoulderVisR = landmarkVis(rs);

  if (hipVisL < profile.minHipVisibility || hipVisR < profile.minHipVisibility) {
    if (input.trackingQuality === "poor") return "low_visibility";
    if (Math.abs(hipVisL - hipVisR) > 0.35) return "adjust_camera_angle";
    return "low_visibility";
  }

  if (
    shoulderVisL < profile.minShoulderVisibility ||
    shoulderVisR < profile.minShoulderVisibility
  ) {
    if (Math.abs(shoulderVisL - shoulderVisR) > 0.35) return "adjust_camera_angle";
    return "low_visibility";
  }

  if (profile.requireNose) {
    const noseVis = landmarkVis(nose);
    if (noseVis < (profile.minNoseVisibility ?? 0.25)) return "low_visibility";
    if (nose && nose.y < profile.frameMargin) return "move_back";
  }

  if (profile.requireKnee) {
    const kneeVis = Math.max(landmarkVis(lk), landmarkVis(rk));
    if (kneeVis < profile.minKneeVisibility) return "low_visibility";
  }

  const span = torsoSpan(landmarks);
  if (span !== null) {
    if (span > profile.torsoSpanMax) return "move_back";
    if (span < profile.torsoSpanMin) return "move_closer";
  }

  const bboxH = bodyBBoxHeight(landmarks, profile);
  if (bboxH !== null) {
    if (bboxH > profile.bboxHeightMax) return "move_back";
    if (bboxH < profile.bboxHeightMin) return "move_closer";
  }

  if (
    shoulderVisL < profile.minShoulderVisibility * 0.75 ||
    shoulderVisR < profile.minShoulderVisibility * 0.75
  ) {
    return "adjust_camera_angle";
  }

  return "good_distance";
}

/** Dashed target frame — green when good distance, amber otherwise. */
export function drawBodyFramingOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BodyFramingState,
): void {
  const inset = 0.12;
  const x = width * inset;
  const y = height * inset;
  const w = width * (1 - 2 * inset);
  const h = height * (1 - 2 * inset);
  const color =
    state === "good_distance" ? FRAMING_OVERLAY_COLORS.good : FRAMING_OVERLAY_COLORS.amber;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
