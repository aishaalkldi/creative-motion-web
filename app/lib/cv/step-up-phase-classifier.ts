/**
 * Step Up phase classification from detector snapshots (rise polarity on hip Y).
 * Report-layer only — no detector or landmark persistence changes.
 */

import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type StepUpMovementPhase =
  | "standing"
  | "step_ascent"
  | "top_position"
  | "step_descent"
  | "rest"
  | "unknown";

/** Consecutive pose-lost ticks before labeling unknown. */
export const STEP_UP_POSE_LOST_UNKNOWN_MIN_TICKS = 8;

export type StepUpPhaseClassifierState = {
  prevStandPhase: "up" | "down" | null;
  prevRepCount: number;
  poseLostTicks: number;
  lastStablePhase: StepUpMovementPhase;
};

export function createStepUpPhaseClassifierState(): StepUpPhaseClassifierState {
  return {
    prevStandPhase: null,
    prevRepCount: 0,
    poseLostTicks: 0,
    lastStablePhase: "standing",
  };
}

export function resetStepUpPhaseClassifierState(
  state: StepUpPhaseClassifierState,
): void {
  state.prevStandPhase = null;
  state.prevRepCount = 0;
  state.poseLostTicks = 0;
  state.lastStablePhase = "standing";
}

function resolvePoseLostPhase(
  state: StepUpPhaseClassifierState,
): StepUpMovementPhase {
  state.poseLostTicks += 1;
  if (state.poseLostTicks >= STEP_UP_POSE_LOST_UNKNOWN_MIN_TICKS) {
    return "unknown";
  }
  return state.lastStablePhase;
}

export function resolveStepUpRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
  state?: StepUpPhaseClassifierState,
): StepUpMovementPhase | null {
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
 * Classify step-up phase from standPhase edges (rise polarity on hip Y).
 * up at baseline = standing; down at peak = top_position; edges = step_ascent / step_descent.
 */
export function classifyStepUpMovementPhase(
  snap: SitToStandDetectorSnapshot,
  state: StepUpPhaseClassifierState,
): StepUpMovementPhase {
  const early = resolveStepUpRestOrUnknownPhase(snap, state);
  if (early) {
    state.prevStandPhase = snap.standPhase ?? state.prevStandPhase;
    state.prevRepCount = snap.repCount;
    if (early !== "unknown") state.lastStablePhase = early;
    return early;
  }

  const standPhase = snap.standPhase ?? "up";
  const prevStand = state.prevStandPhase;

  let phase: StepUpMovementPhase;

  if (standPhase === "up") {
    phase = prevStand === "down" ? "step_descent" : "standing";
  } else if (prevStand === "up") {
    phase = "step_ascent";
  } else {
    phase = "top_position";
  }

  state.prevStandPhase = standPhase;
  state.prevRepCount = snap.repCount;
  state.lastStablePhase = phase;

  return phase;
}
