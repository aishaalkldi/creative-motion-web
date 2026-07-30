/**
 * Run: npx tsx --test app/lib/upper-limb-session-integration/cv-output-adapter.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapMohammedCvOutputToEvent,
  normalizeUpperLimbSessionEvents,
} from "./cv-output-adapter";
import {
  UpperLimbSessionValidationError,
  type MohammedUpperLimbCvOutput,
  type UpperLimbCvSessionEvent,
} from "./types";

const IDENTITY = {
  sessionId: "session-1",
  patientId: "patient-1",
  exerciseId: "shoulder-reach",
  affectedSide: "left" as const,
};

function event(
  partial: Partial<UpperLimbCvSessionEvent> &
    Pick<UpperLimbCvSessionEvent, "eventId" | "eventType" | "timestamp">,
): UpperLimbCvSessionEvent {
  return { ...IDENTITY, ...partial };
}

/** A fully-formed, valid completed session (11 minutes, 2 attempts, 1 hit, 1 incomplete). */
function buildValidCompletedEvents(): UpperLimbCvSessionEvent[] {
  return [
    event({
      eventId: "e-start",
      eventType: "session_started",
      timestamp: "2026-01-01T10:00:00.000Z",
      startedAt: "2026-01-01T10:00:00.000Z",
      trackingQuality: "medium",
    }),
    event({ eventId: "e-att-1", eventType: "target_attempt", timestamp: "2026-01-01T10:00:05.000Z" }),
    event({ eventId: "e-hit-1", eventType: "target_hit", timestamp: "2026-01-01T10:00:06.000Z" }),
    event({ eventId: "e-att-2", eventType: "target_attempt", timestamp: "2026-01-01T10:00:10.000Z" }),
    event({
      eventId: "e-inc-2",
      eventType: "target_incomplete",
      timestamp: "2026-01-01T10:00:12.000Z",
    }),
    event({
      eventId: "e-track-int-1",
      eventType: "tracking_interrupted",
      timestamp: "2026-01-01T10:00:20.000Z",
      trackingQuality: "low",
    }),
    event({
      eventId: "e-trunk-1",
      eventType: "trunk_compensation_observed",
      timestamp: "2026-01-01T10:00:25.000Z",
    }),
    event({
      eventId: "e-pain",
      eventType: "patient_reported_pain",
      timestamp: "2026-01-01T10:00:30.000Z",
      patientReportedPain: 3,
    }),
    event({
      eventId: "e-effort",
      eventType: "patient_reported_effort",
      timestamp: "2026-01-01T10:00:31.000Z",
      patientReportedEffort: 6,
    }),
    event({
      eventId: "e-complete",
      eventType: "session_completed",
      timestamp: "2026-01-01T10:11:00.000Z",
      endedAt: "2026-01-01T10:11:00.000Z",
      completionState: "completed",
      trackingQuality: "medium",
    }),
  ];
}

describe("normalizeUpperLimbSessionEvents — valid input", () => {
  it("normalizes a valid CV/session event stream into a factual result", () => {
    const result = normalizeUpperLimbSessionEvents(buildValidCompletedEvents());

    assert.equal(result.sessionId, "session-1");
    assert.equal(result.patientId, "patient-1");
    assert.equal(result.exerciseId, "shoulder-reach");
    assert.equal(result.affectedSide, "left");

    assert.equal(result.timing.startedAt, "2026-01-01T10:00:00.000Z");
    assert.equal(result.timing.endedAt, "2026-01-01T10:11:00.000Z");
    assert.equal(result.timing.elapsedSeconds, 660);

    assert.equal(result.performance.targetAttempts, 2);
    assert.equal(result.performance.successfulTargets, 1);
    assert.equal(result.performance.incompleteAttempts, 1);

    assert.equal(result.tracking.quality, "medium");
    assert.equal(result.tracking.interruptionCount, 1);

    assert.equal(result.observations.trunkCompensationCount, 1);

    assert.equal(result.patientReported.pain, 3);
    assert.equal(result.patientReported.effort, 6);

    assert.equal(result.completion.state, "completed");
    assert.equal(result.completion.interruptionReason, null);
  });

  it("keeps observations narrowly factual (count only, no interpretation fields)", () => {
    const result = normalizeUpperLimbSessionEvents(buildValidCompletedEvents());
    assert.deepEqual(Object.keys(result.observations), ["trunkCompensationCount"]);
  });

  it("handles a missing optional pain value safely", () => {
    const events = buildValidCompletedEvents().filter((e) => e.eventType !== "patient_reported_pain");
    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.patientReported.pain, null);
  });

  it("handles a missing optional effort value safely", () => {
    const events = buildValidCompletedEvents().filter(
      (e) => e.eventType !== "patient_reported_effort",
    );
    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.patientReported.effort, null);
  });
});

describe("normalizeUpperLimbSessionEvents — completion state handling", () => {
  it("completed sessions remain completed", () => {
    const result = normalizeUpperLimbSessionEvents(buildValidCompletedEvents());
    assert.equal(result.completion.state, "completed");
  });

  it("interrupted sessions are not marked completed, and preserve the interruption reason", () => {
    const events = buildValidCompletedEvents().filter((e) => e.eventType !== "session_completed");
    events.push(
      event({
        eventId: "e-interrupted",
        eventType: "session_interrupted",
        timestamp: "2026-01-01T10:05:00.000Z",
        endedAt: "2026-01-01T10:05:00.000Z",
        completionState: "interrupted",
        interruptionReason: "tracking was lost",
        trackingQuality: "low",
      }),
    );

    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.completion.state, "interrupted");
    assert.notEqual(result.completion.state, "completed");
    assert.equal(result.completion.interruptionReason, "tracking was lost");
  });

  it("abandoned sessions remain distinguishable from interrupted sessions", () => {
    const events = buildValidCompletedEvents().filter((e) => e.eventType !== "session_completed");
    events.push(
      event({
        eventId: "e-abandoned",
        eventType: "session_abandoned",
        timestamp: "2026-01-01T10:05:00.000Z",
        endedAt: "2026-01-01T10:05:00.000Z",
        completionState: "abandoned",
        trackingQuality: "low",
      }),
    );

    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.completion.state, "abandoned");
    assert.notEqual(result.completion.state, "interrupted");
  });

  it("rejects a session_completed event whose completionState field is incompatible", () => {
    const events = buildValidCompletedEvents().map((e) =>
      e.eventType === "session_completed" ? { ...e, completionState: "interrupted" as const } : e,
    );

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "completion_state_mismatch",
    );
  });

  it("rejects sessions with conflicting terminal events", () => {
    const events = buildValidCompletedEvents();
    events.push(
      event({
        eventId: "e-also-interrupted",
        eventType: "session_interrupted",
        timestamp: "2026-01-01T10:12:00.000Z",
        completionState: "interrupted",
      }),
    );

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "conflicting_completion_state",
    );
  });

  it("rejects an event stream with no terminal event", () => {
    const events = buildValidCompletedEvents().filter((e) => e.eventType !== "session_completed");

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "missing_completion_event",
    );
  });
});

describe("normalizeUpperLimbSessionEvents — duplicate-event handling", () => {
  it("does not count two events sharing the same stable eventId twice", () => {
    const events = buildValidCompletedEvents();
    const duplicateAttempt = events.find((e) => e.eventId === "e-att-1")!;
    events.push({ ...duplicateAttempt, timestamp: "2026-01-01T10:00:07.000Z" });

    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.performance.targetAttempts, 2);
  });

  it("counts legitimate identical-content events separately when eventIds differ", () => {
    const events = buildValidCompletedEvents();
    const duplicateAttempt = events.find((e) => e.eventId === "e-att-1")!;
    events.push({ ...duplicateAttempt, eventId: "e-att-3", timestamp: "2026-01-01T10:00:08.000Z" });

    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.performance.targetAttempts, 3);
  });

  it("aggregates tracking interruptions correctly, ignoring duplicate eventIds", () => {
    const events = buildValidCompletedEvents();
    const interruption = events.find((e) => e.eventId === "e-track-int-1")!;
    events.push({ ...interruption, timestamp: "2026-01-01T10:00:21.000Z" }); // same eventId: duplicate
    events.push({
      ...interruption,
      eventId: "e-track-int-2",
      timestamp: "2026-01-01T10:00:40.000Z",
    }); // distinct eventId: legitimate second interruption

    const result = normalizeUpperLimbSessionEvents(events);
    assert.equal(result.tracking.interruptionCount, 2);
  });
});

describe("normalizeUpperLimbSessionEvents — validation", () => {
  it("rejects unsupported affected-side values", () => {
    const events = buildValidCompletedEvents().map((e) => ({
      ...e,
      affectedSide: "middle" as unknown as UpperLimbCvSessionEvent["affectedSide"],
    }));

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "invalid_affected_side",
    );
  });

  it("rejects unsupported completion-state values", () => {
    const events = [
      event({
        eventId: "e-bad-state",
        eventType: "session_completed",
        timestamp: "2026-01-01T10:00:00.000Z",
        completionState: "cancelled" as unknown as UpperLimbCvSessionEvent["completionState"],
      }),
    ];

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "invalid_completion_state",
    );
  });

  it("rejects unsupported tracking-quality values", () => {
    const events = [
      event({
        eventId: "e-bad-quality",
        eventType: "session_started",
        timestamp: "2026-01-01T10:00:00.000Z",
        trackingQuality: "great" as unknown as UpperLimbCvSessionEvent["trackingQuality"],
      }),
    ];

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "invalid_tracking_quality",
    );
  });

  it("rejects invalid timestamps", () => {
    const events = buildValidCompletedEvents().map((e) =>
      e.eventId === "e-start" ? { ...e, timestamp: "not-a-date" } : e,
    );

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "invalid_timestamp",
    );
  });

  it("rejects negative numeric values", () => {
    const events = buildValidCompletedEvents().map((e) =>
      e.eventId === "e-complete" ? { ...e, elapsedSeconds: -5 } : e,
    );

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "negative_or_invalid_value",
    );
  });

  it("rejects successfulTargets greater than targetAttempts", () => {
    const events = buildValidCompletedEvents();
    events.push(
      event({ eventId: "e-hit-2", eventType: "target_hit", timestamp: "2026-01-01T10:00:07.000Z" }),
      event({ eventId: "e-hit-3", eventType: "target_hit", timestamp: "2026-01-01T10:00:08.000Z" }),
    );

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "invalid_target_counts",
    );
  });

  it("rejects a session missing tracking quality entirely", () => {
    const events = buildValidCompletedEvents().map((e) => {
      const { trackingQuality, ...rest } = e;
      return rest as UpperLimbCvSessionEvent;
    });

    assert.throws(
      () => normalizeUpperLimbSessionEvents(events),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "missing_tracking_quality",
    );
  });

  it("rejects an empty event list", () => {
    assert.throws(
      () => normalizeUpperLimbSessionEvents([]),
      (error: unknown) =>
        error instanceof UpperLimbSessionValidationError && error.code === "empty_event_list",
    );
  });
});

describe("mapMohammedCvOutputToEvent", () => {
  it("maps a future Mohammed CV output into the shared event contract without altering values", () => {
    const output: MohammedUpperLimbCvOutput = buildValidCompletedEvents()[0];
    const mapped = mapMohammedCvOutputToEvent(output);

    assert.deepEqual(mapped, output);
    assert.notEqual(mapped, output);
  });

  it("normalizes correctly once mapped through the adapter seam", () => {
    const mappedEvents = buildValidCompletedEvents().map((raw) =>
      mapMohammedCvOutputToEvent(raw as MohammedUpperLimbCvOutput),
    );
    const result = normalizeUpperLimbSessionEvents(mappedEvents);
    assert.equal(result.completion.state, "completed");
  });
});
