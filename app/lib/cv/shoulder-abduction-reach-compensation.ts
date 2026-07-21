/**
 * Shoulder Abduction Reach — trunk-lean compensation proxy (v0).
 *
 * A minimal, clearly-labeled proxy: horizontal drift of the same-side
 * hip→shoulder offset away from a resting-phase baseline. This is a
 * technical geometric observation from a single camera view — not a
 * validated clinical compensation measure. Threshold defaults are neutral
 * placeholders and require clinical calibration before any production use
 * (matching the disclaimer pattern already used by
 * `postural-alignment-proxy.ts` elsewhere in this codebase).
 *
 * Deliberately does not attempt bilateral hip/shoulder midpoint tracking —
 * that would be a more complete trunk-lean signal, but the same-side
 * hip→shoulder vector already used by this exercise's own angle
 * computation is the smallest signal that says something real about trunk
 * displacement without introducing new joint dependencies.
 */

import {
  computeRelativeJointOffset,
  type NormalizedMotionFrame,
} from "@/app/lib/motion-intelligence";
import {
  SHOULDER_ABDUCTION_REACH_CORE_JOINTS,
  type ShoulderAbductionReachSide,
} from "@/app/lib/shoulder-rehabilitation";

export type ShoulderAbductionReachCompensationThresholds = {
  /** Horizontal hip->shoulder offset drift (normalized 0-1 units) beyond baseline that flags compensation. PLACEHOLDER — requires clinical calibration. */
  trunkLeanFlagDelta: number;
  /** Hysteresis: drift must fall back below (flagDelta - clearHysteresis) to clear. */
  clearHysteresis: number;
  /** Minimum joint confidence to trust the offset. */
  minConfidence: number;
};

/** PLACEHOLDER defaults — not clinically validated. See module doc comment. */
export const DEFAULT_SHOULDER_ABDUCTION_REACH_COMPENSATION_THRESHOLDS: ShoulderAbductionReachCompensationThresholds =
  {
    trunkLeanFlagDelta: 0.08,
    clearHysteresis: 0.02,
    minConfidence: 0.4,
  };

export type ShoulderAbductionReachCompensationState = {
  /** Resting-phase hip->shoulder deltaX, captured once per session per side. Null until captured. */
  baselineDeltaX: number | null;
  flagged: boolean;
};

export function createShoulderAbductionReachCompensationState(): ShoulderAbductionReachCompensationState {
  return { baselineDeltaX: null, flagged: false };
}

export type ShoulderAbductionReachCompensationStatus =
  | "unavailable"
  | "baseline_captured"
  | "clear"
  | "flagged";

/**
 * Advance the compensation proxy by one frame. Mutates `state` in place,
 * matching the mutate-in-place convention already used by
 * `tickShoulderAbductionReachPhase`. Returns the current status — callers
 * (e.g. the pose-detector wrapper) are responsible for diffing against the
 * previous call's status to emit discrete "detected"/"cleared" events; this
 * function itself is a pure status read, not an event emitter.
 *
 * `isRestingPhase` must be supplied by the caller (from the existing phase
 * state machine) — this module has no knowledge of phase/angle logic,
 * matching `shoulder-abduction-reach-phase.ts`'s existing separation of
 * concerns.
 */
export function updateShoulderAbductionReachCompensation(
  state: ShoulderAbductionReachCompensationState,
  frame: NormalizedMotionFrame,
  side: ShoulderAbductionReachSide,
  isRestingPhase: boolean,
  thresholds: ShoulderAbductionReachCompensationThresholds = DEFAULT_SHOULDER_ABDUCTION_REACH_COMPENSATION_THRESHOLDS,
): ShoulderAbductionReachCompensationStatus {
  const { hip, shoulder } = SHOULDER_ABDUCTION_REACH_CORE_JOINTS[side];
  const offset = computeRelativeJointOffset(frame, hip, shoulder, {
    minVisibility: thresholds.minConfidence,
  });

  if (!offset) {
    return "unavailable";
  }

  if (state.baselineDeltaX === null) {
    if (isRestingPhase) {
      state.baselineDeltaX = offset.deltaX;
      return "baseline_captured";
    }
    return "unavailable";
  }

  const drift = Math.abs(offset.deltaX - state.baselineDeltaX);
  const clearThreshold = Math.max(0, thresholds.trunkLeanFlagDelta - thresholds.clearHysteresis);

  if (state.flagged) {
    if (drift <= clearThreshold) {
      state.flagged = false;
      return "clear";
    }
    return "flagged";
  }

  if (drift >= thresholds.trunkLeanFlagDelta) {
    state.flagged = true;
    return "flagged";
  }

  return "clear";
}
