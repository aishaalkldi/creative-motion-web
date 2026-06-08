/**
 * Heel Raise phase classification from detector snapshots (rise polarity).
 * Report-layer only — no detector or landmark persistence changes.
 */

import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type HeelRaiseMovementPhase =
  | "standing"
  | "rising"
  | "peak_raise"
  | "lowering"
  | "rest"
  | "unknown";

/** Consecutive pose-lost ticks before labeling unknown. */
export const HEEL_RAISE_POSE_LOST_UNKNOWN_MIN_TICKS = 8;

export type HeelRaisePhaseClassifierState = {
  prevStandPhase: "up" | "down" | null;
  prevRepCount: number;
  poseLostTicks: number;
  lastStablePhase: HeelRaiseMovementPhase;
};

export function createHeelRaisePhaseClassifierState(): HeelRaisePhaseClassifierState {
  return {
    prevStandPhase: null,
    prevRepCount: 0,
    poseLostTicks: 0,
    lastStablePhase: "standing",
  };
}

export function resetHeelRaisePhaseClassifierState(
  state: HeelRaisePhaseClassifierState,
): void {
  state.prevStandPhase = null;
  state.prevRepCount = 0;
  state.poseLostTicks = 0;
  state.lastStablePhase = "standing";
}

function resolvePoseLostPhase(
  state: HeelRaisePhaseClassifierState,
): HeelRaiseMovementPhase {
  state.poseLostTicks += 1;
  if (state.poseLostTicks >= HEEL_RAISE_POSE_LOST_UNKNOWN_MIN_TICKS) {
    return "unknown";
  }
  return state.lastStablePhase;
}

export function resolveHeelRaiseRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
  state?: HeelRaisePhaseClassifierState,
): HeelRaiseMovementPhase | null {
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
 * Classify heel raise phase from standPhase edges (rise polarity on ankle Y).
 * up at baseline = standing; down at peak = peak_raise; edges = rising / lowering.
 */
export function classifyHeelRaiseMovementPhase(
  snap: SitToStandDetectorSnapshot,
  state: HeelRaisePhaseClassifierState,
): HeelRaiseMovementPhase {
  const early = resolveHeelRaiseRestOrUnknownPhase(snap, state);
  if (early) {
    state.prevStandPhase = snap.standPhase ?? state.prevStandPhase;
    state.prevRepCount = snap.repCount;
    if (early !== "unknown") state.lastStablePhase = early;
    return early;
  }

  const standPhase = snap.standPhase ?? "up";
  const prevStand = state.prevStandPhase;

  let phase: HeelRaiseMovementPhase;

  if (standPhase === "up") {
    phase = prevStand === "down" ? "lowering" : "standing";
  } else if (prevStand === "up") {
    phase = "rising";
  } else {
    phase = "peak_raise";
  }

  state.prevStandPhase = standPhase;
  state.prevRepCount = snap.repCount;
  state.lastStablePhase = phase;

  return phase;
}
