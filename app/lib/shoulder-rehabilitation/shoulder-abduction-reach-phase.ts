/**
 * Shoulder Abduction Reach — phase and rep tracking (v0).
 *
 * A small, purpose-built threshold-crossing state machine — deliberately
 * not `sagittal-hip-rep-core.ts`'s baseline-calibration FSM (wrong fit: that
 * module calibrates a seated/standing hip-Y baseline, not an arm angle) and
 * not `rep-quality-fsm.ts` (its capture-flag vocabulary —
 * `incomplete_stand`, `incomplete_return` — is sit/stand-specific language
 * that doesn't describe a raise/lower arm movement). This is intentionally
 * simpler than either: threshold crossings only, no baseline calibration.
 *
 * Phase transitions are driven entirely by the angle value already computed
 * in `shoulder-abduction-reach-metrics.ts` — this module has no knowledge
 * of joints, frames, or confidence.
 */

import type {
  ShoulderAbductionReachPhase,
  ShoulderAbductionReachThresholds,
} from "./shoulder-abduction-reach-contract";

export type ShoulderAbductionReachPhaseState = {
  phase: ShoulderAbductionReachPhase;
  repCount: number;
  /**
   * Running peak angle for the in-progress raise, or the most recently
   * finished attempt's peak while at rest (whether or not that attempt
   * reached the peak band and counted as a rep). Null only before the arm
   * has left resting for the first time. Reset when a new raise begins.
   */
  peakAngleDegrees: number | null;
  hasReachedPeakThisRep: boolean;
  consecutiveUnusableFrames: number;
};

export function createShoulderAbductionReachPhaseState(): ShoulderAbductionReachPhaseState {
  return {
    phase: "resting",
    repCount: 0,
    peakAngleDegrees: null,
    hasReachedPeakThisRep: false,
    consecutiveUnusableFrames: 0,
  };
}

export function resetShoulderAbductionReachPhaseState(
  state: ShoulderAbductionReachPhaseState,
): void {
  state.phase = "resting";
  state.repCount = 0;
  state.peakAngleDegrees = null;
  state.hasReachedPeakThisRep = false;
  state.consecutiveUnusableFrames = 0;
}

function updatePeak(state: ShoulderAbductionReachPhaseState, angleDegrees: number): void {
  state.peakAngleDegrees =
    state.peakAngleDegrees === null ? angleDegrees : Math.max(state.peakAngleDegrees, angleDegrees);
}

/**
 * Advance the phase/rep state machine by one frame. Mutates `state` in
 * place — no return value, matching the mutate-in-place convention already
 * used by `recordStsShadowComparison` in the shadow-mode module.
 *
 * `angleDegrees` is null when the current frame's angle could not be
 * computed (missing joints, insufficient confidence, or an invalid frame
 * contract) — treated as a transient "unusable frame", not an immediate
 * phase reset, so brief single-frame dropouts don't falsely end a rep.
 *
 * Known limitation (acceptable for a v0 descriptive detector, not treated
 * as a bug): if tracking is lost for `poseLostUnknownMinTicks` or more
 * consecutive frames while mid-rep (e.g. during "peak_abduction"), the
 * phase moves to "unknown" and then "resting" without passing through
 * "lowering" — that in-progress rep is not counted, even if the arm
 * genuinely completed the movement off-camera. No recovery/backfill logic
 * is implemented for this case.
 */
export function tickShoulderAbductionReachPhase(
  state: ShoulderAbductionReachPhaseState,
  angleDegrees: number | null,
  thresholds: ShoulderAbductionReachThresholds,
): void {
  if (angleDegrees === null) {
    state.consecutiveUnusableFrames += 1;
    if (state.consecutiveUnusableFrames >= thresholds.poseLostUnknownMinTicks) {
      state.phase = "unknown";
    }
    return;
  }

  state.consecutiveUnusableFrames = 0;

  const peakLowerThreshold = thresholds.peakMinAngleDegrees - thresholds.peakLowerHysteresisDegrees;

  switch (state.phase) {
    case "resting":
    case "unknown": {
      if (angleDegrees > thresholds.restingMaxAngleDegrees) {
        // Starting a new raise — reset peak tracking for this attempt.
        state.phase = "raising";
        state.peakAngleDegrees = angleDegrees;
        state.hasReachedPeakThisRep = false;
      } else {
        // Remaining at rest — peakAngleDegrees intentionally untouched here;
        // it retains the most recently finished attempt's peak (or null if
        // no attempt has happened yet) until the next raise begins.
        state.phase = "resting";
      }
      break;
    }
    case "raising": {
      updatePeak(state, angleDegrees);
      if (angleDegrees >= thresholds.peakMinAngleDegrees) {
        state.phase = "peak_abduction";
        state.hasReachedPeakThisRep = true;
      } else if (angleDegrees <= thresholds.restingMaxAngleDegrees) {
        // Arm returned to rest without reaching the peak band — no rep
        // counted, but peakAngleDegrees is left as this attempt's peak so
        // it's still observable, consistent with the field's semantics.
        state.phase = "resting";
      }
      break;
    }
    case "peak_abduction": {
      updatePeak(state, angleDegrees);
      if (angleDegrees < peakLowerThreshold) {
        state.phase = "lowering";
      }
      break;
    }
    case "lowering": {
      updatePeak(state, angleDegrees);
      if (angleDegrees >= thresholds.peakMinAngleDegrees) {
        // Re-raised past the peak band before returning to rest.
        state.phase = "peak_abduction";
      } else if (angleDegrees <= thresholds.restingMaxAngleDegrees) {
        state.phase = "resting";
        if (state.hasReachedPeakThisRep) {
          state.repCount += 1;
        }
        state.hasReachedPeakThisRep = false;
      }
      break;
    }
  }
}
