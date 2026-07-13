/**
 * Shoulder Abduction Reach shadow mode — shared capture-frame hook.
 *
 * This is the "wire it in" entry point: a single function a live capture
 * component would call once per frame, passing the same raw landmarks it
 * already has. It is deliberately not called from any live component in
 * this sprint — no `PatientCvCapture.tsx`, `AssessmentCvCaptureSession.tsx`,
 * CV Lab, or any other file imports this. It exists so a future PR can wire
 * it in without redesigning the detector, log, or gate.
 *
 * When disabled (the default), this function does one gate check and
 * returns — no detector runs, no state is touched, zero cost.
 */

import type { InputAcquisitionContext } from "@/app/lib/input-acquisition";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
  type ShoulderAbductionReachThresholds,
} from "./shoulder-abduction-reach-contract";
import {
  createShoulderAbductionReachDetectorState,
  updateShoulderAbductionReachDetector,
  type ShoulderAbductionReachDetectorState,
  type ShoulderAbductionReachFrameResult,
} from "./shoulder-abduction-reach-detector";
import { isShoulderAbductionReachShadowEnabled } from "./shoulder-abduction-reach-shadow-gate";
import {
  createShoulderAbductionReachShadowSessionLog,
  recordShoulderAbductionReachShadowFrame,
  type ShoulderAbductionReachShadowPreviousSnapshot,
  type ShoulderAbductionReachShadowSessionLog,
} from "./shoulder-abduction-reach-shadow-log";

export type ShoulderAbductionReachShadowState = {
  detectorState: ShoulderAbductionReachDetectorState;
  log: ShoulderAbductionReachShadowSessionLog;
  previousSnapshot: ShoulderAbductionReachShadowPreviousSnapshot | null;
};

export function createShoulderAbductionReachShadowState(): ShoulderAbductionReachShadowState {
  return {
    detectorState: createShoulderAbductionReachDetectorState(),
    log: createShoulderAbductionReachShadowSessionLog(),
    previousSnapshot: null,
  };
}

/**
 * Run the shoulder detector in shadow mode for one frame, if enabled.
 *
 * `isEnabled` defaults to the real browser gate
 * (`isShoulderAbductionReachShadowEnabled`) and is injectable so this can be
 * exercised in tests without a `window` global — not a behavior difference
 * from what a live caller would get, since a live caller never passes this
 * parameter and always gets the real gate.
 *
 * Returns `null` (no-op) when disabled, or the frame result when enabled.
 * The return value is not consumed by anything this sprint — a future live
 * component could read it for display, or ignore it entirely, since all the
 * observation happens via `state.log` and console output.
 */
export function runShoulderAbductionReachShadowFrame(
  state: ShoulderAbductionReachShadowState,
  landmarks: readonly PoseLandmark[],
  context: InputAcquisitionContext,
  thresholds: ShoulderAbductionReachThresholds = DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
  isEnabled: () => boolean = isShoulderAbductionReachShadowEnabled,
): ShoulderAbductionReachFrameResult | null {
  if (!isEnabled()) {
    return null;
  }

  const result = updateShoulderAbductionReachDetector(state.detectorState, landmarks, context, thresholds);
  state.previousSnapshot = recordShoulderAbductionReachShadowFrame(state.log, result, state.previousSnapshot);
  return result;
}
