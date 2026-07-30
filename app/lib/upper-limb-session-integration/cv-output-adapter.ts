import {
  AFFECTED_SIDES,
  COMPLETION_STATES,
  TRACKING_QUALITIES,
  UPPER_LIMB_EVENT_TYPES,
  SCHEMA_VERSION,
  UpperLimbSessionValidationError,
  type AffectedSide,
  type CompletionState,
  type MohammedUpperLimbCvOutput,
  type NormalizedUpperLimbSessionResult,
  type TrackingQuality,
  type UpperLimbCvSessionEvent,
  type UpperLimbEventType,
} from "./types";

const TERMINAL_STATE_BY_EVENT_TYPE: Partial<Record<UpperLimbEventType, CompletionState>> = {
  session_completed: "completed",
  session_interrupted: "interrupted",
  session_abandoned: "abandoned",
};

/**
 * Narrow mapping seam for Mohammed's future CV output. Today this is a
 * structural passthrough because MohammedUpperLimbCvOutput is defined to
 * match UpperLimbCvSessionEvent; it exists so callers never depend on
 * Mohammed's branch or types directly, and so this mapping is the one place
 * that needs to change if his output shape diverges from this contract.
 */
export function mapMohammedCvOutputToEvent(
  output: MohammedUpperLimbCvOutput,
): UpperLimbCvSessionEvent {
  return { ...output };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidIsoTimestamp(value: string): boolean {
  if (!isNonEmptyString(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function assertValidTimestamp(value: string, field: string): void {
  if (!isValidIsoTimestamp(value)) {
    throw new UpperLimbSessionValidationError(
      "invalid_timestamp",
      `Field "${field}" is not a valid timestamp: ${JSON.stringify(value)}`,
    );
  }
}

function assertNonNegativeFiniteNumber(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new UpperLimbSessionValidationError(
      "negative_or_invalid_value",
      `Field "${field}" must be a non-negative finite number, received: ${value}`,
    );
  }
}

function validateEvent(event: UpperLimbCvSessionEvent): void {
  if (!(UPPER_LIMB_EVENT_TYPES as readonly string[]).includes(event.eventType)) {
    throw new UpperLimbSessionValidationError(
      "invalid_event_type",
      `Unsupported eventType: ${JSON.stringify(event.eventType)}`,
    );
  }

  if (!(AFFECTED_SIDES as readonly string[]).includes(event.affectedSide)) {
    throw new UpperLimbSessionValidationError(
      "invalid_affected_side",
      `Unsupported affectedSide: ${JSON.stringify(event.affectedSide)}`,
    );
  }

  if (
    event.completionState !== undefined &&
    !(COMPLETION_STATES as readonly string[]).includes(event.completionState)
  ) {
    throw new UpperLimbSessionValidationError(
      "invalid_completion_state",
      `Unsupported completionState: ${JSON.stringify(event.completionState)}`,
    );
  }

  if (
    event.trackingQuality !== undefined &&
    !(TRACKING_QUALITIES as readonly string[]).includes(event.trackingQuality)
  ) {
    throw new UpperLimbSessionValidationError(
      "invalid_tracking_quality",
      `Unsupported trackingQuality: ${JSON.stringify(event.trackingQuality)}`,
    );
  }

  assertValidTimestamp(event.timestamp, "timestamp");
  if (event.startedAt !== undefined) assertValidTimestamp(event.startedAt, "startedAt");
  if (event.endedAt !== undefined) assertValidTimestamp(event.endedAt, "endedAt");

  const numericFields: Array<[number | undefined, string]> = [
    [event.elapsedSeconds, "elapsedSeconds"],
    [event.targetAttempts, "targetAttempts"],
    [event.successfulTargets, "successfulTargets"],
    [event.incompleteAttempts, "incompleteAttempts"],
    [event.trackingInterruptions, "trackingInterruptions"],
    [event.trunkCompensationObservations, "trunkCompensationObservations"],
    [event.patientReportedPain, "patientReportedPain"],
    [event.patientReportedEffort, "patientReportedEffort"],
  ];
  for (const [value, field] of numericFields) {
    if (value !== undefined) assertNonNegativeFiniteNumber(value, field);
  }
}

/**
 * Duplicate-event handling:
 *
 * Events sharing the same non-empty `eventId` are treated as the same
 * factual event and only the first occurrence is kept — later duplicates
 * are dropped without being counted again.
 *
 * Events without a usable `eventId` (empty string) have no stable identity,
 * so they are never removed based on matching field values alone: two
 * legitimate attempts that happen to carry identical data but no shared
 * eventId are both kept and both counted.
 */
function dedupeByEventId(events: UpperLimbCvSessionEvent[]): UpperLimbCvSessionEvent[] {
  const seen = new Set<string>();
  const deduped: UpperLimbCvSessionEvent[] = [];

  for (const event of events) {
    if (isNonEmptyString(event.eventId)) {
      if (seen.has(event.eventId)) continue;
      seen.add(event.eventId);
    }
    deduped.push(event);
  }

  return deduped;
}

function assertConsistentSessionIdentity(events: UpperLimbCvSessionEvent[]): void {
  const [first, ...rest] = events;
  for (const event of rest) {
    if (
      event.sessionId !== first.sessionId ||
      event.patientId !== first.patientId ||
      event.exerciseId !== first.exerciseId ||
      event.affectedSide !== first.affectedSide
    ) {
      throw new UpperLimbSessionValidationError(
        "inconsistent_session_identity",
        "All events for a single normalized session must share the same sessionId, patientId, exerciseId, and affectedSide.",
      );
    }
  }
}

function sortByTimestamp(events: UpperLimbCvSessionEvent[]): UpperLimbCvSessionEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

function resolveTerminalEvent(sortedEvents: UpperLimbCvSessionEvent[]): {
  event: UpperLimbCvSessionEvent;
  state: CompletionState;
} {
  const terminalEvents = sortedEvents.filter(
    (event) => TERMINAL_STATE_BY_EVENT_TYPE[event.eventType] !== undefined,
  );

  if (terminalEvents.length === 0) {
    throw new UpperLimbSessionValidationError(
      "missing_completion_event",
      "At least one terminal event (session_completed, session_interrupted, or session_abandoned) is required.",
    );
  }

  const impliedStates = new Set(
    terminalEvents.map((event) => TERMINAL_STATE_BY_EVENT_TYPE[event.eventType]),
  );
  if (impliedStates.size > 1) {
    throw new UpperLimbSessionValidationError(
      "conflicting_completion_state",
      `Session has conflicting terminal events implying different completion states: ${[...impliedStates].join(", ")}`,
    );
  }

  const latestTerminalEvent = terminalEvents[terminalEvents.length - 1];
  const impliedState = TERMINAL_STATE_BY_EVENT_TYPE[latestTerminalEvent.eventType]!;

  if (
    latestTerminalEvent.completionState !== undefined &&
    latestTerminalEvent.completionState !== impliedState
  ) {
    throw new UpperLimbSessionValidationError(
      "completion_state_mismatch",
      `Terminal event "${latestTerminalEvent.eventType}" declares completionState ` +
        `"${latestTerminalEvent.completionState}", which is incompatible with the implied state "${impliedState}".`,
    );
  }

  return { event: latestTerminalEvent, state: impliedState };
}

function resolveStartedAt(sortedEvents: UpperLimbCvSessionEvent[]): string {
  const sessionStarted = sortedEvents.find((event) => event.eventType === "session_started");
  if (sessionStarted) return sessionStarted.startedAt ?? sessionStarted.timestamp;
  return sortedEvents[0].timestamp;
}

function resolveElapsedSeconds(
  terminalEvent: UpperLimbCvSessionEvent,
  startedAt: string,
  endedAt: string,
): number {
  if (terminalEvent.elapsedSeconds !== undefined) return terminalEvent.elapsedSeconds;

  const elapsedMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const elapsedSeconds = elapsedMs / 1000;

  if (elapsedSeconds < 0) {
    throw new UpperLimbSessionValidationError(
      "negative_duration",
      `Computed session duration is negative: endedAt (${endedAt}) precedes startedAt (${startedAt}).`,
    );
  }

  return elapsedSeconds;
}

function resolveLastDefined<T>(
  events: UpperLimbCvSessionEvent[],
  select: (event: UpperLimbCvSessionEvent) => T | undefined,
): T | undefined {
  let result: T | undefined;
  for (const event of events) {
    const value = select(event);
    if (value !== undefined) result = value;
  }
  return result;
}

function countEventsOfType(events: UpperLimbCvSessionEvent[], type: UpperLimbEventType): number {
  return events.filter((event) => event.eventType === type).length;
}

/**
 * Converts a factual Upper-Limb CV / session event stream for a single
 * session into a NormalizedUpperLimbSessionResult.
 *
 * This function only validates, deduplicates, counts, and reshapes values
 * that are already present on the input events. It never computes pose
 * landmarks, tracking quality, target hits, trunk compensation, or affected
 * side, and it never produces a diagnosis, safety verdict, or treatment
 * recommendation.
 */
export function normalizeUpperLimbSessionEvents(
  events: UpperLimbCvSessionEvent[],
): NormalizedUpperLimbSessionResult {
  if (events.length === 0) {
    throw new UpperLimbSessionValidationError(
      "empty_event_list",
      "At least one event is required to normalize a session.",
    );
  }

  const deduped = dedupeByEventId(events);
  deduped.forEach(validateEvent);
  assertConsistentSessionIdentity(deduped);

  const sorted = sortByTimestamp(deduped);
  const { event: terminalEvent, state: completionState } = resolveTerminalEvent(sorted);

  const startedAt = terminalEvent.startedAt ?? resolveStartedAt(sorted);
  assertValidTimestamp(startedAt, "startedAt");
  const endedAt = terminalEvent.endedAt ?? terminalEvent.timestamp;
  assertValidTimestamp(endedAt, "endedAt");
  const elapsedSeconds = resolveElapsedSeconds(terminalEvent, startedAt, endedAt);

  const targetAttempts = countEventsOfType(deduped, "target_attempt");
  const successfulTargets = countEventsOfType(deduped, "target_hit");
  const incompleteAttempts = countEventsOfType(deduped, "target_incomplete");

  if (successfulTargets > targetAttempts) {
    throw new UpperLimbSessionValidationError(
      "invalid_target_counts",
      `successfulTargets (${successfulTargets}) cannot exceed targetAttempts (${targetAttempts}).`,
    );
  }
  if (successfulTargets + incompleteAttempts > targetAttempts) {
    throw new UpperLimbSessionValidationError(
      "invalid_target_counts",
      `successfulTargets + incompleteAttempts (${successfulTargets + incompleteAttempts}) ` +
        `cannot exceed targetAttempts (${targetAttempts}).`,
    );
  }

  const trackingQuality = resolveLastDefined(sorted, (event) => event.trackingQuality);
  if (trackingQuality === undefined) {
    throw new UpperLimbSessionValidationError(
      "missing_tracking_quality",
      "At least one event must report trackingQuality.",
    );
  }
  const trackingInterruptions = countEventsOfType(deduped, "tracking_interrupted");
  const trunkCompensationCount = countEventsOfType(deduped, "trunk_compensation_observed");

  const pain = resolveLastDefined(sorted, (event) => event.patientReportedPain) ?? null;
  const effort = resolveLastDefined(sorted, (event) => event.patientReportedEffort) ?? null;

  const first = deduped[0];

  const result: NormalizedUpperLimbSessionResult = {
    schemaVersion: SCHEMA_VERSION,
    sessionId: first.sessionId,
    patientId: first.patientId,
    exerciseId: first.exerciseId,
    affectedSide: first.affectedSide as AffectedSide,

    timing: {
      startedAt,
      endedAt,
      elapsedSeconds,
    },

    performance: {
      targetAttempts,
      successfulTargets,
      incompleteAttempts,
    },

    tracking: {
      quality: trackingQuality as TrackingQuality,
      interruptionCount: trackingInterruptions,
    },

    observations: {
      trunkCompensationCount,
    },

    patientReported: {
      pain,
      effort,
    },

    completion: {
      state: completionState,
      interruptionReason: terminalEvent.interruptionReason ?? null,
    },
  };

  return result;
}
