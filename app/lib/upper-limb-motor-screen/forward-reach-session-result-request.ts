/**
 * RASQ Upper-Limb Motor Screen — Forward Reach runtime integration layer.
 *
 * Builds the POST /api/upper-limb-motor-screen/session-results request
 * body from a single terminal UpperLimbMovementAttemptResult (one attempt
 * only, per this first vertical slice) plus an optional clinician-recorded
 * ClinicalStopEvent. Mechanical mapping only — no clinical judgment, no
 * cross-attempt aggregation (there is only ever one attempt here), no
 * recomputation of anything the engine already produced. The existing,
 * unchanged assembleUpperLimbMotorScreenSessionResult is the only place
 * that turns this shape into the persisted domain object.
 */

import { computeLongestForwardReachPauseGapMs } from "./forward-reach-pause-duration";
import type { UpperLimbSessionResultCreateRequest } from "./session-result-request-validation";
import type { ClinicalStopEvent, UpperLimbMovementAttemptResult } from "./types";

export function buildForwardReachSessionResultRequest(input: {
  assignmentId: string;
  attempt: UpperLimbMovementAttemptResult;
  clinicalStopEvent: ClinicalStopEvent | null;
}): UpperLimbSessionResultCreateRequest {
  const { assignmentId, attempt, clinicalStopEvent } = input;

  return {
    assignmentId,
    taskCompletion: [
      {
        taskId: attempt.taskId,
        testedSide: attempt.testedSide,
        completionState: attempt.completionState,
      },
    ],
    attempts: [attempt],
    clinicalStopEvents: clinicalStopEvent ? [clinicalStopEvent] : [],
    overallTrackingQuality: attempt.trackingQualitySummary,
    longestPauseGapMs: computeLongestForwardReachPauseGapMs(attempt),
    trunkCompensationObserved: null,
    asymmetryNotes: [],
  };
}
