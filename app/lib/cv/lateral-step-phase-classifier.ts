/**
 * Lateral Step phase classification from detector snapshots (frontal hip X deviation).
 * Report-layer only — no detector or landmark persistence changes.
 */

import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type LateralStepMovementPhase =
  | "standing"
  | "lateral_shift"
  | "step_out"
  | "return_to_center"
  | "rest"
  | "unknown";

/** Consecutive pose-lost ticks before labeling unknown. */
export const LATERAL_STEP_POSE_LOST_UNKNOWN_MIN_TICKS = 8;

export type LateralStepPhaseClassifierState = {
  prevShiftPhase: "center" | "out" | null;
  prevRepCount: number;
  poseLostTicks: number;
  lastStablePhase: LateralStepMovementPhase;
};

export function createLateralStepPhaseClassifierState(): LateralStepPhaseClassifierState {
  return {
    prevShiftPhase: null,
    prevRepCount: 0,
    poseLostTicks: 0,
    lastStablePhase: "standing",
  };
}

export function resetLateralStepPhaseClassifierState(
  state: LateralStepPhaseClassifierState,
): void {
  state.prevShiftPhase = null;
  state.prevRepCount = 0;
  state.poseLostTicks = 0;
  state.lastStablePhase = "standing";
}

function resolvePoseLostPhase(
  state: LateralStepPhaseClassifierState,
): LateralStepMovementPhase {
  state.poseLostTicks += 1;
  if (state.poseLostTicks >= LATERAL_STEP_POSE_LOST_UNKNOWN_MIN_TICKS) {
    return "unknown";
  }
  return state.lastStablePhase;
}

export function resolveLateralStepRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
  state?: LateralStepPhaseClassifierState,
): LateralStepMovementPhase | null {
  if (snap.trackingStatus === "pose-lost") {
    return state ? resolvePoseLostPhase(state) : "unknown";
  }
  if (state) state.poseLostTicks = 0;
  if (snap.isBaselineCalibrating) return "rest";
  if (snap.poseReadiness === "checking" || snap.poseReadiness === "not_ready") return "rest";
  if (snap.bodyFramingState === "checking") return "rest";
  if (snap.initPhase !== null) return "rest";
  if (snap.trackingStatus === "idle" || snap.trackingStatus === "detecting") return "rest";
  return null;
}

/**
 * Classify lateral-step phase from shiftPhase edges (frontal hip X deviation).
 * center at baseline = standing; out at peak = step_out; edges = lateral_shift / return_to_center.
 */
export function classifyLateralStepMovementPhase(
  snap: SitToStandDetectorSnapshot,
  state: LateralStepPhaseClassifierState,
): LateralStepMovementPhase {
  const early = resolveLateralStepRestOrUnknownPhase(snap, state);
  if (early) {
    state.prevShiftPhase = snap.standPhase === "down" ? "out" : "center";
    state.prevRepCount = snap.repCount;
    if (early !== "unknown") state.lastStablePhase = early;
    return early;
  }

  const shiftPhase: "center" | "out" = snap.standPhase === "down" ? "out" : "center";
  const prevShift = state.prevShiftPhase;

  let phase: LateralStepMovementPhase;

  if (shiftPhase === "center") {
    phase = prevShift === "out" ? "return_to_center" : "standing";
  } else if (prevShift === "center") {
    phase = "lateral_shift";
  } else {
    phase = "step_out";
  }

  state.prevShiftPhase = shiftPhase;
  state.prevRepCount = snap.repCount;
  state.lastStablePhase = phase;

  return phase;
}
