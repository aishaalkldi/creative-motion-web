/**
 * Functional Reach phase classification from detector snapshots (forward reach extent).
 * Report-layer only — no detector or landmark persistence changes.
 */

import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type FunctionalReachMovementPhase =
  | "standing"
  | "reaching_forward"
  | "peak_reach"
  | "returning"
  | "rest"
  | "unknown";

/** Consecutive pose-lost ticks before labeling unknown. */
export const FUNCTIONAL_REACH_POSE_LOST_UNKNOWN_MIN_TICKS = 8;

export type FunctionalReachPhaseClassifierState = {
  prevShiftPhase: "center" | "out" | null;
  prevRepCount: number;
  poseLostTicks: number;
  lastStablePhase: FunctionalReachMovementPhase;
};

export function createFunctionalReachPhaseClassifierState(): FunctionalReachPhaseClassifierState {
  return {
    prevShiftPhase: null,
    prevRepCount: 0,
    poseLostTicks: 0,
    lastStablePhase: "standing",
  };
}

export function resetFunctionalReachPhaseClassifierState(
  state: FunctionalReachPhaseClassifierState,
): void {
  state.prevShiftPhase = null;
  state.prevRepCount = 0;
  state.poseLostTicks = 0;
  state.lastStablePhase = "standing";
}

function resolvePoseLostPhase(
  state: FunctionalReachPhaseClassifierState,
): FunctionalReachMovementPhase {
  state.poseLostTicks += 1;
  if (state.poseLostTicks >= FUNCTIONAL_REACH_POSE_LOST_UNKNOWN_MIN_TICKS) {
    return "unknown";
  }
  return state.lastStablePhase;
}

export function resolveFunctionalReachRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
  state?: FunctionalReachPhaseClassifierState,
): FunctionalReachMovementPhase | null {
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
 * Classify functional-reach phase from shiftPhase edges (forward reach extent).
 * center at baseline = standing; out at peak = peak_reach; edges = reaching_forward / returning.
 */
export function classifyFunctionalReachMovementPhase(
  snap: SitToStandDetectorSnapshot,
  state: FunctionalReachPhaseClassifierState,
): FunctionalReachMovementPhase {
  const early = resolveFunctionalReachRestOrUnknownPhase(snap, state);
  if (early) {
    state.prevShiftPhase = snap.standPhase === "down" ? "out" : "center";
    state.prevRepCount = snap.repCount;
    if (early !== "unknown") state.lastStablePhase = early;
    return early;
  }

  const shiftPhase: "center" | "out" = snap.standPhase === "down" ? "out" : "center";
  const prevShift = state.prevShiftPhase;

  let phase: FunctionalReachMovementPhase;

  if (shiftPhase === "center") {
    phase = prevShift === "out" ? "returning" : "standing";
  } else if (prevShift === "center") {
    phase = "reaching_forward";
  } else {
    phase = "peak_reach";
  }

  state.prevShiftPhase = shiftPhase;
  state.prevRepCount = snap.repCount;
  state.lastStablePhase = phase;

  return phase;
}
