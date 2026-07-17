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

/**
 * Diagnostic foundation (debug use only): the exact rule that produced a
 * BodyFramingState, matching one-to-one with evaluateBodyFraming's decision
 * points. Purely additive/read-only — does not affect the returned state.
 */
export type BodyFramingDiagnosticReason =
  | "checking"
  | "landmark_clipped"
  | "hip_visibility_below_min"
  | "hip_visibility_asymmetric"
  | "shoulder_visibility_below_min"
  | "shoulder_visibility_asymmetric"
  | "nose_visibility_below_min"
  | "nose_near_top"
  | "knee_visibility_below_min"
  | "torso_span_above_max"
  | "torso_span_below_min"
  | "bbox_height_above_max"
  | "bbox_height_below_min"
  | "shoulder_visibility_marginal"
  | "ok";

export type BodyFramingClipDiagnostic = {
  landmark:
    | "leftShoulder"
    | "rightShoulder"
    | "leftHip"
    | "rightHip"
    | "nose"
    | "leftKnee"
    | "rightKnee";
  x: number;
  y: number;
} | null;

export type BodyFramingDiagnostics = {
  state: BodyFramingState;
  reason: BodyFramingDiagnosticReason;
  torsoSpan: number | null;
  bboxHeight: number | null;
  clip: BodyFramingClipDiagnostic;
  profile: {
    torsoSpanMin: number;
    torsoSpanMax: number;
    bboxHeightMin: number;
    bboxHeightMax: number;
    frameMargin: number;
  };
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

type ClipDiagnostic = {
  state: "move_back" | "adjust_camera_angle";
  landmark: NonNullable<BodyFramingClipDiagnostic>["landmark"];
  x: number;
  y: number;
};

function clipStateDetailed(landmarks: PoseLandmark[], margin: number): ClipDiagnostic | null {
  const points: Array<[NonNullable<BodyFramingClipDiagnostic>["landmark"], PoseLandmark | undefined]> = [
    ["leftShoulder", landmarks[L_SHOULDER]],
    ["rightShoulder", landmarks[R_SHOULDER]],
    ["leftHip", landmarks[L_HIP]],
    ["rightHip", landmarks[R_HIP]],
    ["nose", landmarks[NOSE]],
    ["leftKnee", landmarks[L_KNEE]],
    ["rightKnee", landmarks[R_KNEE]],
  ];

  for (const [name, p] of points) {
    if (!p) continue;
    if (!inFrame(p.x, p.y, margin)) {
      const state = p.y < margin || p.y > 1 - margin ? "move_back" : "adjust_camera_angle";
      return { state, landmark: name, x: p.x, y: p.y };
    }
  }
  return null;
}

/**
 * Same decision path as evaluateBodyFraming, additionally returning the
 * intermediate computed values and the exact rule that produced the final
 * state — for debug-only observability. Never changes the decision itself.
 */
export function evaluateBodyFramingDetailed(
  landmarks: PoseLandmark[],
  profile: BodyFramingProfile,
  input: BodyFramingEvaluateInput,
): BodyFramingDiagnostics {
  const profileSnapshot = {
    torsoSpanMin: profile.torsoSpanMin,
    torsoSpanMax: profile.torsoSpanMax,
    bboxHeightMin: profile.bboxHeightMin,
    bboxHeightMax: profile.bboxHeightMax,
    frameMargin: profile.frameMargin,
  };

  const span = torsoSpan(landmarks);
  const bboxH = bodyBBoxHeight(landmarks, profile);

  const base = {
    torsoSpan: span,
    bboxHeight: bboxH,
    profile: profileSnapshot,
  };

  if (input.checking) {
    return { ...base, state: "checking", reason: "checking", clip: null };
  }

  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const lh = landmarks[L_HIP];
  const rh = landmarks[R_HIP];
  const nose = landmarks[NOSE];
  const lk = landmarks[L_KNEE];
  const rk = landmarks[R_KNEE];

  const clipped = clipStateDetailed(landmarks, profile.frameMargin);
  if (clipped) {
    return {
      ...base,
      state: clipped.state,
      reason: "landmark_clipped",
      clip: { landmark: clipped.landmark, x: clipped.x, y: clipped.y },
    };
  }

  const hipVisL = landmarkVis(lh);
  const hipVisR = landmarkVis(rh);
  const shoulderVisL = landmarkVis(ls);
  const shoulderVisR = landmarkVis(rs);

  if (hipVisL < profile.minHipVisibility || hipVisR < profile.minHipVisibility) {
    if (input.trackingQuality === "poor") {
      return { ...base, state: "low_visibility", reason: "hip_visibility_below_min", clip: null };
    }
    if (Math.abs(hipVisL - hipVisR) > 0.35) {
      return {
        ...base,
        state: "adjust_camera_angle",
        reason: "hip_visibility_asymmetric",
        clip: null,
      };
    }
    return { ...base, state: "low_visibility", reason: "hip_visibility_below_min", clip: null };
  }

  if (
    shoulderVisL < profile.minShoulderVisibility ||
    shoulderVisR < profile.minShoulderVisibility
  ) {
    if (Math.abs(shoulderVisL - shoulderVisR) > 0.35) {
      return {
        ...base,
        state: "adjust_camera_angle",
        reason: "shoulder_visibility_asymmetric",
        clip: null,
      };
    }
    return {
      ...base,
      state: "low_visibility",
      reason: "shoulder_visibility_below_min",
      clip: null,
    };
  }

  if (profile.requireNose) {
    const noseVis = landmarkVis(nose);
    if (noseVis < (profile.minNoseVisibility ?? 0.25)) {
      return {
        ...base,
        state: "low_visibility",
        reason: "nose_visibility_below_min",
        clip: null,
      };
    }
    if (nose && nose.y < profile.frameMargin) {
      return { ...base, state: "move_back", reason: "nose_near_top", clip: null };
    }
  }

  if (profile.requireKnee) {
    const kneeVis = Math.max(landmarkVis(lk), landmarkVis(rk));
    if (kneeVis < profile.minKneeVisibility) {
      return {
        ...base,
        state: "low_visibility",
        reason: "knee_visibility_below_min",
        clip: null,
      };
    }
  }

  if (span !== null) {
    if (span > profile.torsoSpanMax) {
      return { ...base, state: "move_back", reason: "torso_span_above_max", clip: null };
    }
    if (span < profile.torsoSpanMin) {
      return { ...base, state: "move_closer", reason: "torso_span_below_min", clip: null };
    }
  }

  if (bboxH !== null) {
    if (bboxH > profile.bboxHeightMax) {
      return { ...base, state: "move_back", reason: "bbox_height_above_max", clip: null };
    }
    if (bboxH < profile.bboxHeightMin) {
      return { ...base, state: "move_closer", reason: "bbox_height_below_min", clip: null };
    }
  }

  if (
    shoulderVisL < profile.minShoulderVisibility * 0.75 ||
    shoulderVisR < profile.minShoulderVisibility * 0.75
  ) {
    return {
      ...base,
      state: "adjust_camera_angle",
      reason: "shoulder_visibility_marginal",
      clip: null,
    };
  }

  return { ...base, state: "good_distance", reason: "ok", clip: null };
}

export function evaluateBodyFraming(
  landmarks: PoseLandmark[],
  profile: BodyFramingProfile,
  input: BodyFramingEvaluateInput,
): BodyFramingState {
  return evaluateBodyFramingDetailed(landmarks, profile, input).state;
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
