/**
 * Mini Squat phase classification from detector snapshots (drop polarity).
 * Report-layer only — no detector or landmark persistence changes.
 */

import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type MiniSquatMovementPhase =
  | "standing"
  | "lowering"
  | "bottom"
  | "rising"
  | "rest"
  | "unknown";

/** Consecutive pose-lost ticks before labeling unknown. */
export const MINI_SQUAT_POSE_LOST_UNKNOWN_MIN_TICKS = 8;

export type MiniSquatPhaseClassifierState = {
  prevStandPhase: "up" | "down" | null;
  prevRepCount: number;
  poseLostTicks: number;
  lastStablePhase: MiniSquatMovementPhase;
};

export function createMiniSquatPhaseClassifierState(): MiniSquatPhaseClassifierState {
  return {
    prevStandPhase: null,
    prevRepCount: 0,
    poseLostTicks: 0,
    lastStablePhase: "standing",
  };
}

export function resetMiniSquatPhaseClassifierState(
  state: MiniSquatPhaseClassifierState,
): void {
  state.prevStandPhase = null;
  state.prevRepCount = 0;
  state.poseLostTicks = 0;
  state.lastStablePhase = "standing";
}

function resolvePoseLostPhase(
  state: MiniSquatPhaseClassifierState,
): MiniSquatMovementPhase {
  state.poseLostTicks += 1;
  if (state.poseLostTicks >= MINI_SQUAT_POSE_LOST_UNKNOWN_MIN_TICKS) {
    return "unknown";
  }
  return state.lastStablePhase;
}

export function resolveMiniSquatRestOrUnknownPhase(
  snap: SitToStandDetectorSnapshot,
  state?: MiniSquatPhaseClassifierState,
): MiniSquatMovementPhase | null {
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
 * Classify mini squat phase from standPhase edges (drop polarity).
 * down at baseline = standing; up at peak = bottom; edges = lowering / rising.
 */
export function classifyMiniSquatMovementPhase(
  snap: SitToStandDetectorSnapshot,
  state: MiniSquatPhaseClassifierState,
): MiniSquatMovementPhase {
  const early = resolveMiniSquatRestOrUnknownPhase(snap, state);
  if (early) {
    state.prevStandPhase = snap.standPhase ?? state.prevStandPhase;
    state.prevRepCount = snap.repCount;
    if (early !== "unknown") state.lastStablePhase = early;
    return early;
  }

  const standPhase = snap.standPhase ?? "down";
  const prevStand = state.prevStandPhase;

  let phase: MiniSquatMovementPhase;

  if (standPhase === "down") {
    phase = prevStand === "up" ? "rising" : "standing";
  } else if (prevStand === "down") {
    phase = "lowering";
  } else {
    phase = "bottom";
  }

  state.prevStandPhase = standPhase;
  state.prevRepCount = snap.repCount;
  state.lastStablePhase = phase;

  return phase;
}
