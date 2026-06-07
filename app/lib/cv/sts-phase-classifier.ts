/**
 * STS phase classification from existing detector snapshots (no landmarks/video).
 * Uses standPhase transitions at 1 Hz timeline sampling to infer rising/returning.
 */

import type { MotionSnapshot } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type StsPhaseClassifierState = {
  prevStandPhase: "up" | "down" | null;
  prevRepCount: number;
};

export function createStsPhaseClassifierState(): StsPhaseClassifierState {
  return { prevStandPhase: null, prevRepCount: 0 };
}

export function resetStsPhaseClassifierState(state: StsPhaseClassifierState): void {
  state.prevStandPhase = null;
  state.prevRepCount = 0;
}

/** Rest/unknown phases take precedence over stand-phase inference. */
export function resolveStsRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
): MotionSnapshot["movementPhase"] | null {
  if (snap.trackingStatus === "pose-lost") return "unknown";
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
  const early = resolveStsRestOrUnknownPhase(snap);
  if (early) {
    state.prevStandPhase = snap.standPhase ?? state.prevStandPhase;
    state.prevRepCount = snap.repCount;
    return early;
  }

  const standPhase = snap.standPhase ?? "down";
  const prevStand = state.prevStandPhase;
  const repIncreased = snap.repCount > state.prevRepCount;

  let phase: MotionSnapshot["movementPhase"];

  if (standPhase === "up") {
    if (prevStand === "down") {
      phase = repIncreased ? "standing" : "rising";
    } else {
      phase = "standing";
    }
  } else if (prevStand === "up") {
    phase = "returning";
  } else {
    phase = "seated";
  }

  state.prevStandPhase = standPhase;
  state.prevRepCount = snap.repCount;

  return phase;
}
