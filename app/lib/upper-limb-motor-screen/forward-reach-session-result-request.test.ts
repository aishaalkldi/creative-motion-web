/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/forward-reach-session-result-request.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildForwardReachSessionResultRequest } from "./forward-reach-session-result-request";
import type { ClinicalStopEvent, UpperLimbMovementAttemptResult, UpperLimbSide } from "./types";

const ASSIGNMENT_ID = "11111111-1111-1111-1111-111111111111";

function makeAttempt(
  testedSide: UpperLimbSide,
  overrides: Partial<UpperLimbMovementAttemptResult> = {},
): UpperLimbMovementAttemptResult {
  return {
    attemptIndex: 0,
    taskId: "forwardReach",
    testedSide,
    startedAtMs: 0,
    completedAtMs: 1000,
    completionState: "completed",
    targetReached: true,
    dwellConfirmed: true,
    returnToStartCompleted: true,
    reachTimeMs: 400,
    returnTimeMs: 400,
    totalMovementTimeMs: 1000,
    normalizedPathLength: 0.3,
    pathEfficiency: 0.9,
    peakShoulderAngleDeg: null,
    peakElbowExtensionDeg: null,
    trunkDisplacementObserved: null,
    withinConfiguredLimitThroughout: null,
    trackingQualitySummary: "good",
    protectivePauseCount: 0,
    protectivePauseDurationMs: 0,
    protectivePauseEvents: [],
    factualNotes: [],
    ...overrides,
  };
}

function makeClinicalStopEvent(overrides: Partial<ClinicalStopEvent> = {}): ClinicalStopEvent {
  return {
    reason: "patient_requested_stop",
    recordedAt: "2026-08-17T00:00:00.000Z",
    recordedBy: "clinician",
    reviewRequired: true,
    ...overrides,
  };
}

describe("buildForwardReachSessionResultRequest", () => {
  it("taskCompletion is the mechanical mapping of the single attempt", () => {
    const attempt = makeAttempt("right", { completionState: "completed" });
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt,
      clinicalStopEvent: null,
    });
    assert.deepEqual(request.taskCompletion, [
      { taskId: "forwardReach", testedSide: "right", completionState: "completed" },
    ]);
  });

  it("attempts contains exactly the one terminal attempt, unmodified", () => {
    const attempt = makeAttempt("left");
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt,
      clinicalStopEvent: null,
    });
    assert.equal(request.attempts.length, 1);
    assert.deepEqual(request.attempts[0], attempt);
  });

  it("overallTrackingQuality equals the single attempt's trackingQualitySummary", () => {
    for (const quality of ["good", "fair", "poor", "unknown"] as const) {
      const attempt = makeAttempt("right", { trackingQualitySummary: quality });
      const request = buildForwardReachSessionResultRequest({
        assignmentId: ASSIGNMENT_ID,
        attempt,
        clinicalStopEvent: null,
      });
      assert.equal(request.overallTrackingQuality, quality);
    }
  });

  it("trunkCompensationObserved is always null, asymmetryNotes is always []", () => {
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt: makeAttempt("right"),
      clinicalStopEvent: null,
    });
    assert.equal(request.trunkCompensationObserved, null);
    assert.deepEqual(request.asymmetryNotes, []);
  });

  it("clinicalStopEvents is [] when no clinical stop occurred", () => {
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt: makeAttempt("right"),
      clinicalStopEvent: null,
    });
    assert.deepEqual(request.clinicalStopEvents, []);
  });

  it("clinicalStopEvents includes the explicitly recorded clinician event when one occurred", () => {
    const event = makeClinicalStopEvent();
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt: makeAttempt("right", { completionState: "stopped" }),
      clinicalStopEvent: event,
    });
    assert.deepEqual(request.clinicalStopEvents, [event]);
  });

  it("longestPauseGapMs delegates to the isolated pause-duration helper", () => {
    const attempt = makeAttempt("right", {
      protectivePauseEvents: [
        {
          reason: { category: "tracking_or_environment", detail: "wrist_landmark_lost" },
          startedAtMs: 100,
          endedAtMs: 500,
          outcome: "resumed",
          readinessConfirmedAt: "2026-08-17T00:00:00.000Z",
          resumedBy: "clinician",
        },
      ],
    });
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt,
      clinicalStopEvent: null,
    });
    assert.equal(request.longestPauseGapMs, 400);
  });

  it("preserves RIGHT tested side through taskCompletion and attempts unchanged", () => {
    const attempt = makeAttempt("right");
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt,
      clinicalStopEvent: null,
    });
    assert.equal(request.taskCompletion[0].testedSide, "right");
    assert.equal(request.attempts[0].testedSide, "right");
  });

  it("preserves LEFT tested side through taskCompletion and attempts unchanged", () => {
    const attempt = makeAttempt("left");
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt,
      clinicalStopEvent: null,
    });
    assert.equal(request.taskCompletion[0].testedSide, "left");
    assert.equal(request.attempts[0].testedSide, "left");
  });

  it("passes assignmentId through unchanged", () => {
    const request = buildForwardReachSessionResultRequest({
      assignmentId: ASSIGNMENT_ID,
      attempt: makeAttempt("right"),
      clinicalStopEvent: null,
    });
    assert.equal(request.assignmentId, ASSIGNMENT_ID);
  });
});
