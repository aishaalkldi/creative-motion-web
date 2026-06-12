/**
 * STS phase classification from existing detector snapshots (no landmarks/video).
 * Uses standPhase transitions at 1 Hz timeline sampling to infer rising/returning.
 */

import type { MotionSnapshot } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import { stsCapturePhaseToMovementPhase } from "@/app/lib/cv/sts-biomechanical-capture-fsm";

/** Consecutive pose-lost ticks before labeling unknown (brief drops stay on last stable phase). */
export const STS_POSE_LOST_UNKNOWN_MIN_TICKS = 8;

export type StsPhaseClassifierState = {
  prevStandPhase: "up" | "down" | null;
  prevRepCount: number;
  poseLostTicks: number;
  lastStablePhase: MotionSnapshot["movementPhase"];
};

export function createStsPhaseClassifierState(): StsPhaseClassifierState {
  return {
    prevStandPhase: null,
    prevRepCount: 0,
    poseLostTicks: 0,
    lastStablePhase: "seated",
  };
}

export function resetStsPhaseClassifierState(state: StsPhaseClassifierState): void {
  state.prevStandPhase = null;
  state.prevRepCount = 0;
  state.poseLostTicks = 0;
  state.lastStablePhase = "seated";
}

/** Rest/unknown phases take precedence over stand-phase inference. */
function resolvePoseLostPhase(state: StsPhaseClassifierState): MotionSnapshot["movementPhase"] {
  state.poseLostTicks += 1;
  if (state.poseLostTicks >= STS_POSE_LOST_UNKNOWN_MIN_TICKS) {
    return "unknown";
  }
  return state.lastStablePhase;
}

export function resolveStsRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
  state?: StsPhaseClassifierState,
): MotionSnapshot["movementPhase"] | null {
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
 * Classify observed movement phase from standPhase edge transitions.
 * Mutates classifier state for the next tick.
 */
export function classifyStsMovementPhase(
  snap: SitToStandDetectorSnapshot,
  state: StsPhaseClassifierState,
): MotionSnapshot["movementPhase"] {
  if (snap.capturePhase) {
    const phase = stsCapturePhaseToMovementPhase(snap.capturePhase);
    state.prevStandPhase = snap.standPhase ?? state.prevStandPhase;
    state.prevRepCount = snap.repCount;
    if (phase !== "unknown") state.lastStablePhase = phase;
    return phase;
  }

  const early = resolveStsRestOrUnknownPhase(snap, state);
  if (early) {
    state.prevStandPhase = snap.standPhase ?? state.prevStandPhase;
    state.prevRepCount = snap.repCount;
    if (early !== "unknown") state.lastStablePhase = early;
    return early;
  }

  const standPhase = snap.standPhase ?? "down";
  const prevStand = state.prevStandPhase;

  let phase: MotionSnapshot["movementPhase"];

  if (standPhase === "up") {
    phase = prevStand === "down" ? "rising" : "standing";
  } else if (prevStand === "up") {
    phase = "returning";
  } else {
    phase = "seated";
  }

  state.prevStandPhase = standPhase;
  state.prevRepCount = snap.repCount;
  state.lastStablePhase = phase;

  return phase;
}
