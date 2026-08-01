/**
 * Upper-Limb Session Result Contract — factual types only.
 *
 * This module defines the isolated integration contract between:
 *   - factual Upper-Limb CV / session events (produced today by test fixtures,
 *     and in the future by Mohammed's CV work on
 *     feature/mohammed-adaptive-upper-limb-cv), and
 *   - the normalized, persistence-ready, clinician-facing layers in this
 *     directory (cv-output-adapter.ts, session-result-serializer.ts,
 *     session-summary.ts).
 *
 * Nothing here calculates pose landmarks, tracking quality, target hits,
 * trunk compensation, affected side, or any clinical judgment. Those values
 * must already be factual when they arrive at this contract.
 */

export const SCHEMA_VERSION = "upper-limb-session-result@1.0.0";

export const AFFECTED_SIDES = ["left", "right"] as const;
export type AffectedSide = (typeof AFFECTED_SIDES)[number];

export const COMPLETION_STATES = ["completed", "interrupted", "abandoned"] as const;
export type CompletionState = (typeof COMPLETION_STATES)[number];

export const TRACKING_QUALITIES = ["high", "medium", "low", "insufficient"] as const;
export type TrackingQuality = (typeof TRACKING_QUALITIES)[number];

export const UPPER_LIMB_EVENT_TYPES = [
  "target_attempt",
  "target_hit",
  "target_incomplete",
  "tracking_interrupted",
  "tracking_restored",
  "trunk_compensation_observed",
  "session_started",
  "session_completed",
  "session_interrupted",
  "session_abandoned",
  "patient_reported_pain",
  "patient_reported_effort",
] as const;
export type UpperLimbEventType = (typeof UPPER_LIMB_EVENT_TYPES)[number];

const TERMINAL_EVENT_TYPES = [
  "session_completed",
  "session_interrupted",
  "session_abandoned",
] as const;
export type TerminalEventType = (typeof TERMINAL_EVENT_TYPES)[number];

/**
 * A single factual Upper-Limb CV / session event.
 *
 * Fields are optional beyond the identity fields because a real event stream
 * populates different fields depending on `eventType` (e.g. a
 * `patient_reported_pain` event carries `patientReportedPain`, while a
 * `session_completed` event carries `completionState` and `endedAt`).
 *
 * `eventId` is the stable identity used for duplicate-event handling in
 * cv-output-adapter.ts. See that file for the documented dedupe behavior.
 */
export interface UpperLimbCvSessionEvent {
  eventId: string;
  eventType: UpperLimbEventType;
  timestamp: string;
  sessionId: string;
  patientId: string;
  exerciseId: string;
  affectedSide: AffectedSide;

  startedAt?: string;
  endedAt?: string;
  elapsedSeconds?: number;

  targetAttempts?: number;
  successfulTargets?: number;
  incompleteAttempts?: number;

  trackingQuality?: TrackingQuality;
  trackingInterruptions?: number;

  trunkCompensationObservations?: number;

  interruptionReason?: string;
  completionState?: CompletionState;

  patientReportedPain?: number;
  patientReportedEffort?: number;
}

/**
 * Explicit contract describing the factual Upper-Limb CV output that
 * Mohammed's work (feature/mohammed-adaptive-upper-limb-cv) is expected to
 * provide in the future.
 *
 * This is intentionally kept as its own named type — structurally aligned
 * with UpperLimbCvSessionEvent today, but decoupled so this task never
 * imports from Mohammed's branch and Mohammed's future implementation is
 * never required to import from this directory. The narrow mapping between
 * the two lives in cv-output-adapter.ts (`mapMohammedCvOutputToEvent`).
 *
 * No CV algorithm (target-hit detection, trunk-compensation calculation,
 * affected-side resolution, tracking-quality scoring, etc.) is implemented
 * here or implied by this type — it only describes the shape of the factual
 * output once Mohammed's detector has already computed it.
 */
export type MohammedUpperLimbCvOutput = UpperLimbCvSessionEvent;

export class UpperLimbSessionValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "UpperLimbSessionValidationError";
    this.code = code;
  }
}

export interface NormalizedUpperLimbSessionResult {
  schemaVersion: string;
  sessionId: string;
  patientId: string;
  exerciseId: string;
  affectedSide: AffectedSide;

  timing: {
    startedAt: string;
    endedAt: string | null;
    elapsedSeconds: number;
  };

  performance: {
    targetAttempts: number;
    successfulTargets: number;
    incompleteAttempts: number;
  };

  tracking: {
    quality: TrackingQuality;
    interruptionCount: number;
  };

  observations: {
    trunkCompensationCount: number;
  };

  patientReported: {
    pain: number | null;
    effort: number | null;
  };

  completion: {
    state: CompletionState;
    interruptionReason: string | null;
  };
}

/**
 * The persistence-ready serialized form is structurally identical to the
 * normalized result: every field is already a JSON-safe primitive, plain
 * object, or null. session-result-serializer.ts still rebuilds this object
 * explicitly (rather than returning the input as-is) so serialization stays
 * a pure, independent step from normalization.
 */
export type SerializedUpperLimbSessionResult = NormalizedUpperLimbSessionResult;
