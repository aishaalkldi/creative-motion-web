/**
 * Upper-Limb Motor Screen — session-result assembler.
 *
 * Policy-neutral: assembles UpperLimbMotorScreenSessionResult from explicit
 * caller-supplied inputs plus three mechanically-safe derivations from
 * attempts (protectivePauseCount, protectivePauseDurationMsTotal,
 * flattened protectivePauseEvents). It never rejects duplicate
 * (taskId, testedSide) attempts, never requires non-empty attempts, never
 * reconciles taskCompletion against attempts, and never defines
 * longestPauseGapMs — all deliberately unresolved policy, carried forward
 * as opaque explicit input. See session-result-assembler.ts for the full
 * invariant list.
 *
 * Run (approved harness):
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/session-result-assembler.test.ts"
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleUpperLimbMotorScreenSessionResult } from "./session-result-assembler";
import type {
  AssembleUpperLimbMotorScreenSessionResultInput,
} from "./session-result-assembler";
import type {
  ClinicalStopEvent,
  ProtectivePauseEvent,
  UpperLimbMovementAttemptResult,
  UpperLimbTaskCompletionSummary,
} from "./types";

function makePauseEvent(
  overrides: Partial<ProtectivePauseEvent> = {},
): ProtectivePauseEvent {
  return {
    reason: { category: "tracking_or_environment", detail: "wrist_landmark_lost" },
    startedAtMs: 100,
    endedAtMs: 400,
    outcome: "resumed",
    readinessConfirmedAt: "2026-08-17T00:00:00.000Z",
    resumedBy: "clinician",
    ...overrides,
  };
}

function makeAttempt(
  overrides: Partial<UpperLimbMovementAttemptResult> = {},
): UpperLimbMovementAttemptResult {
  return {
    attemptIndex: 0,
    taskId: "lateralReach",
    testedSide: "right",
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
    trackingQualitySummary: "unknown",
    protectivePauseCount: 0,
    protectivePauseDurationMs: 0,
    protectivePauseEvents: [],
    factualNotes: [],
    ...overrides,
  };
}

function makeClinicalStopEvent(
  overrides: Partial<ClinicalStopEvent> = {},
): ClinicalStopEvent {
  return {
    reason: "patient_requested_stop",
    recordedAt: "2026-08-17T00:00:00.000Z",
    recordedBy: "patient",
    reviewRequired: true,
    ...overrides,
  };
}

function makeTaskCompletion(
  overrides: Partial<UpperLimbTaskCompletionSummary> = {},
): UpperLimbTaskCompletionSummary {
  return {
    taskId: "lateralReach",
    testedSide: "right",
    completionState: "completed",
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<AssembleUpperLimbMotorScreenSessionResultInput> = {},
): AssembleUpperLimbMotorScreenSessionResultInput {
  return {
    id: "session-result-1",
    assignmentId: "assignment-1",
    status: "computed",
    taskCompletion: [makeTaskCompletion()],
    attempts: [makeAttempt()],
    clinicalStopEvents: [],
    overallTrackingQuality: "unknown",
    longestPauseGapMs: 0,
    trunkCompensationObserved: null,
    asymmetryNotes: [],
    ...overrides,
  };
}

describe("assembleUpperLimbMotorScreenSessionResult — mechanical derivation", () => {
  it("sums protectivePauseCount and protectivePauseDurationMsTotal from a single attempt", () => {
    const attempt = makeAttempt({
      protectivePauseCount: 2,
      protectivePauseDurationMs: 700,
      protectivePauseEvents: [makePauseEvent()],
    });
    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ attempts: [attempt] }),
    );

    assert.equal(result.technicalTrackingQuality.protectivePauseCount, 2);
    assert.equal(result.technicalTrackingQuality.protectivePauseDurationMsTotal, 700);
    assert.equal(result.interruptions.protectivePauseEvents.length, 1);
  });

  it("sums across multiple attempts, including duplicate (taskId, testedSide) — no rejection", () => {
    const attemptA = makeAttempt({
      attemptIndex: 0,
      protectivePauseCount: 1,
      protectivePauseDurationMs: 100,
    });
    const attemptB = makeAttempt({
      attemptIndex: 1,
      // Same taskId/testedSide as attemptA on purpose.
      protectivePauseCount: 3,
      protectivePauseDurationMs: 250,
    });

    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ attempts: [attemptA, attemptB] }),
    );

    assert.equal(result.attempts.length, 2);
    assert.equal(result.technicalTrackingQuality.protectivePauseCount, 4);
    assert.equal(result.technicalTrackingQuality.protectivePauseDurationMsTotal, 350);
  });

  it("accepts an empty attempts array — no rejection, sums default to zero", () => {
    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ attempts: [] }),
    );

    assert.deepEqual(result.attempts, []);
    assert.equal(result.technicalTrackingQuality.protectivePauseCount, 0);
    assert.equal(result.technicalTrackingQuality.protectivePauseDurationMsTotal, 0);
    assert.deepEqual(result.interruptions.protectivePauseEvents, []);
  });

  it("flattens protectivePauseEvents preserving attempt order and per-attempt event order", () => {
    const eventA1 = makePauseEvent({ startedAtMs: 10, endedAtMs: 20 });
    const eventA2 = makePauseEvent({ startedAtMs: 30, endedAtMs: 40 });
    const eventB1 = makePauseEvent({ startedAtMs: 50, endedAtMs: 60 });

    const attemptA = makeAttempt({ attemptIndex: 0, protectivePauseEvents: [eventA1, eventA2] });
    const attemptB = makeAttempt({ attemptIndex: 1, protectivePauseEvents: [eventB1] });

    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ attempts: [attemptA, attemptB] }),
    );

    const startedAtMsSequence = result.interruptions.protectivePauseEvents.map(
      (e) => e.startedAtMs,
    );
    assert.deepEqual(startedAtMsSequence, [10, 30, 50]);
  });
});

describe("assembleUpperLimbMotorScreenSessionResult — integer-millisecond normalization", () => {
  /**
   * Reproduces the real live-capture defect: performance.now()-sourced
   * timestamps subtract to a fractional millisecond value
   * (488342.6999999881 was the actual value from a real POST failure —
   * "invalid input syntax for type integer"). protectivePauseDurationMsTotal
   * is both a typed INTEGER column and separately CHECK-constrained
   * against the same value embedded in result_payload (migration 019:
   * ulmssr_payload_pause_duration_chk casts
   * result_payload->'technicalTrackingQuality'->>'protectivePauseDurationMsTotal'
   * via ::integer) — a fractional value fails BOTH, and fixing only the
   * typed-column side would still leave result_payload's cast failing,
   * which is exactly why normalization must happen once, upstream, here.
   */
  const FRACTIONAL_MS = 488342.6999999881;

  it("rounds protectivePauseDurationMsTotal to an integer even when summed from fractional per-attempt durations", () => {
    const attempt = makeAttempt({ protectivePauseDurationMs: FRACTIONAL_MS });
    const result = assembleUpperLimbMotorScreenSessionResult(baseInput({ attempts: [attempt] }));

    assert.equal(result.technicalTrackingQuality.protectivePauseDurationMsTotal, Math.round(FRACTIONAL_MS));
    assert.equal(Number.isInteger(result.technicalTrackingQuality.protectivePauseDurationMsTotal), true);
  });

  it("rounds the sum once (not each addend) across multiple fractional per-attempt durations", () => {
    const attemptA = makeAttempt({ attemptIndex: 0, protectivePauseDurationMs: 100.3 });
    const attemptB = makeAttempt({ attemptIndex: 1, protectivePauseDurationMs: 200.4 });
    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ attempts: [attemptA, attemptB] }),
    );

    // Sum-then-round: 100.3 + 200.4 = 300.7 -> 301 (not round(100.3)+round(200.4) = 100+200 = 300).
    assert.equal(result.technicalTrackingQuality.protectivePauseDurationMsTotal, 301);
  });

  it("rounds each attempt's own embedded protectivePauseDurationMs in the persisted attempts array", () => {
    const attempt = makeAttempt({ protectivePauseDurationMs: FRACTIONAL_MS });
    const result = assembleUpperLimbMotorScreenSessionResult(baseInput({ attempts: [attempt] }));

    assert.equal(result.attempts[0].protectivePauseDurationMs, Math.round(FRACTIONAL_MS));
  });

  it("rounds reachTimeMs, returnTimeMs, and totalMovementTimeMs when fractional", () => {
    const attempt = makeAttempt({
      reachTimeMs: 411.5000001,
      returnTimeMs: 388.49999,
      totalMovementTimeMs: 1000.6,
    });
    const result = assembleUpperLimbMotorScreenSessionResult(baseInput({ attempts: [attempt] }));

    assert.equal(result.attempts[0].reachTimeMs, 412);
    assert.equal(result.attempts[0].returnTimeMs, 388);
    assert.equal(result.attempts[0].totalMovementTimeMs, 1001);
  });

  it("preserves null for reachTimeMs/returnTimeMs/totalMovementTimeMs rather than coercing to 0", () => {
    const attempt = makeAttempt({ reachTimeMs: null, returnTimeMs: null, totalMovementTimeMs: null });
    const result = assembleUpperLimbMotorScreenSessionResult(baseInput({ attempts: [attempt] }));

    assert.equal(result.attempts[0].reachTimeMs, null);
    assert.equal(result.attempts[0].returnTimeMs, null);
    assert.equal(result.attempts[0].totalMovementTimeMs, null);
  });

  it("leaves already-integer durations completely unchanged", () => {
    const attempt = makeAttempt({
      reachTimeMs: 400,
      returnTimeMs: 400,
      totalMovementTimeMs: 1000,
      protectivePauseDurationMs: 700,
    });
    const result = assembleUpperLimbMotorScreenSessionResult(baseInput({ attempts: [attempt] }));

    assert.equal(result.attempts[0].reachTimeMs, 400);
    assert.equal(result.attempts[0].returnTimeMs, 400);
    assert.equal(result.attempts[0].totalMovementTimeMs, 1000);
    assert.equal(result.attempts[0].protectivePauseDurationMs, 700);
    assert.equal(result.technicalTrackingQuality.protectivePauseDurationMsTotal, 700);
  });

  it("does not mutate the caller's original attempt object while rounding", () => {
    const attempt = makeAttempt({ reachTimeMs: FRACTIONAL_MS, protectivePauseDurationMs: FRACTIONAL_MS });
    const snapshot = JSON.parse(JSON.stringify(attempt));
    assembleUpperLimbMotorScreenSessionResult(baseInput({ attempts: [attempt] }));
    assert.deepEqual(attempt, snapshot);
  });

  it("longestPauseGapMs remains an explicit opaque passthrough — this module does not touch it (see forward-reach-pause-duration.ts for where that field's own rounding lives)", () => {
    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ longestPauseGapMs: FRACTIONAL_MS }),
    );
    assert.equal(result.technicalTrackingQuality.longestPauseGapMs, FRACTIONAL_MS);
  });
});

describe("assembleUpperLimbMotorScreenSessionResult — explicit passthrough, no derivation/reconciliation", () => {
  it("passes taskCompletion through verbatim even when it does not correspond to any attempt", () => {
    const mismatchedTaskCompletion = [
      makeTaskCompletion({ taskId: "elbowExtension", testedSide: "left", completionState: "not_started" }),
    ];
    const attempt = makeAttempt({ taskId: "lateralReach", testedSide: "right" });

    const result = assembleUpperLimbMotorScreenSessionResult(
      baseInput({ taskCompletion: mismatchedTaskCompletion, attempts: [attempt] }),
    );

    assert.deepEqual(result.taskCompletion, mismatchedTaskCompletion);
  });

  it("passes every explicit session-level field through unchanged", () => {
    const clinicalStopEvents = [makeClinicalStopEvent()];
    const input = baseInput({
      id: "sr-42",
      assignmentId: "asg-7",
      status: "finalized",
      clinicalStopEvents,
      overallTrackingQuality: "fair",
      longestPauseGapMs: 12345,
      trunkCompensationObserved: true,
      asymmetryNotes: ["note-a", "note-b"],
    });

    const result = assembleUpperLimbMotorScreenSessionResult(input);

    assert.equal(result.id, "sr-42");
    assert.equal(result.assignmentId, "asg-7");
    assert.equal(result.status, "finalized");
    assert.deepEqual(result.interruptions.clinicalStopEvents, clinicalStopEvents);
    assert.equal(result.technicalTrackingQuality.overallQuality, "fair");
    assert.equal(result.technicalTrackingQuality.longestPauseGapMs, 12345);
    assert.equal(result.observedMovementFeatures.trunkCompensationObserved, true);
    assert.deepEqual(result.observedMovementFeatures.asymmetryNotes, ["note-a", "note-b"]);
  });
});

describe("assembleUpperLimbMotorScreenSessionResult — value-preserving copies, no aliasing", () => {
  it("mutating the caller's attempt object after the call does not affect the result", () => {
    const attempt = makeAttempt({ completionState: "completed" });
    const input = baseInput({ attempts: [attempt] });

    const result = assembleUpperLimbMotorScreenSessionResult(input);
    attempt.completionState = "interrupted";
    attempt.protectivePauseCount = 999;

    assert.equal(result.attempts[0]!.completionState, "completed");
    assert.equal(result.attempts[0]!.protectivePauseCount, 0);
  });

  it("mutating the caller's pause-event object (including nested reason) after the call does not affect either result location", () => {
    const event = makePauseEvent({ outcome: "resumed" });
    const attempt = makeAttempt({ protectivePauseEvents: [event] });
    const input = baseInput({ attempts: [attempt] });

    const result = assembleUpperLimbMotorScreenSessionResult(input);
    event.outcome = "escalated_to_clinical_stop";
    event.reason.detail = "shoulder_landmark_lost";

    assert.equal(result.attempts[0]!.protectivePauseEvents[0]!.outcome, "resumed");
    assert.equal(result.interruptions.protectivePauseEvents[0]!.outcome, "resumed");
    assert.equal(
      result.attempts[0]!.protectivePauseEvents[0]!.reason.detail,
      "wrist_landmark_lost",
    );
  });

  it("mutating the caller's factualNotes array after the call does not affect the result", () => {
    const attempt = makeAttempt({ factualNotes: ["original"] });
    const input = baseInput({ attempts: [attempt] });

    const result = assembleUpperLimbMotorScreenSessionResult(input);
    attempt.factualNotes.push("mutated_after_call");

    assert.deepEqual(result.attempts[0]!.factualNotes, ["original"]);
  });

  it("mutating the caller's taskCompletion entry after the call does not affect the result", () => {
    const entry = makeTaskCompletion({ completionState: "completed" });
    const input = baseInput({ taskCompletion: [entry] });

    const result = assembleUpperLimbMotorScreenSessionResult(input);
    entry.completionState = "stopped";

    assert.equal(result.taskCompletion[0]!.completionState, "completed");
  });

  it("mutating the caller's clinicalStopEvents entry after the call does not affect the result", () => {
    const event = makeClinicalStopEvent({ recordedBy: "patient" });
    const input = baseInput({ clinicalStopEvents: [event] });

    const result = assembleUpperLimbMotorScreenSessionResult(input);
    event.recordedBy = "clinician";

    assert.equal(result.interruptions.clinicalStopEvents[0]!.recordedBy, "patient");
  });

  it("mutating the caller's asymmetryNotes array after the call does not affect the result", () => {
    const notes = ["original"];
    const input = baseInput({ asymmetryNotes: notes });

    const result = assembleUpperLimbMotorScreenSessionResult(input);
    notes.push("mutated_after_call");

    assert.deepEqual(result.observedMovementFeatures.asymmetryNotes, ["original"]);
  });

  it("mutating the returned result's nested objects after the call does not affect the caller's original input", () => {
    const event = makePauseEvent({ outcome: "resumed" });
    const attempt = makeAttempt({
      protectivePauseEvents: [event],
      factualNotes: ["original"],
    });
    const taskCompletionEntry = makeTaskCompletion();
    const clinicalStopEvent = makeClinicalStopEvent();
    const asymmetryNotes = ["original"];

    const input = baseInput({
      attempts: [attempt],
      taskCompletion: [taskCompletionEntry],
      clinicalStopEvents: [clinicalStopEvent],
      asymmetryNotes,
    });

    const result = assembleUpperLimbMotorScreenSessionResult(input);

    result.attempts[0]!.completionState = "stopped";
    result.attempts[0]!.protectivePauseEvents[0]!.outcome = "escalated_to_clinical_stop";
    result.attempts[0]!.factualNotes.push("mutated_on_result");
    result.taskCompletion[0]!.completionState = "not_started";
    result.interruptions.clinicalStopEvents[0]!.recordedBy = "clinician";
    result.observedMovementFeatures.asymmetryNotes.push("mutated_on_result");

    assert.equal(attempt.completionState, "completed");
    assert.equal(event.outcome, "resumed");
    assert.deepEqual(attempt.factualNotes, ["original"]);
    assert.equal(taskCompletionEntry.completionState, "completed");
    assert.equal(clinicalStopEvent.recordedBy, "patient");
    assert.deepEqual(asymmetryNotes, ["original"]);
  });

  it("does not alias pause-event objects between attempts[*].protectivePauseEvents and interruptions.protectivePauseEvents", () => {
    const event = makePauseEvent();
    const attempt = makeAttempt({ protectivePauseEvents: [event] });
    const input = baseInput({ attempts: [attempt] });

    const result = assembleUpperLimbMotorScreenSessionResult(input);

    const attemptSideEvent = result.attempts[0]!.protectivePauseEvents[0]!;
    const interruptionSideEvent = result.interruptions.protectivePauseEvents[0]!;

    assert.notEqual(attemptSideEvent, event, "attempt-side event must not alias caller input");
    assert.notEqual(
      interruptionSideEvent,
      event,
      "interruptions-side event must not alias caller input",
    );
    assert.notEqual(
      attemptSideEvent,
      interruptionSideEvent,
      "attempt-side and interruptions-side copies must be independent objects",
    );
    assert.notEqual(
      attemptSideEvent.reason,
      interruptionSideEvent.reason,
      "nested reason objects must also be independently copied",
    );
    assert.deepEqual(attemptSideEvent, interruptionSideEvent);
  });
});
