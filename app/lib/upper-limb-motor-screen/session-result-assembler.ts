/**
 * Upper-Limb Motor Screen — session-result assembler.
 *
 * Policy-neutral assembly of UpperLimbMotorScreenSessionResult from
 * explicit caller-supplied inputs. This module makes no clinical or
 * product judgment calls — every field that has no existing, deterministic
 * derivation rule in the current contract (types.ts) is accepted as
 * explicit input and passed through unchanged. It only derives the three
 * values that are mechanically safe to fold from attempts:
 *   - technicalTrackingQuality.protectivePauseCount
 *   - technicalTrackingQuality.protectivePauseDurationMsTotal
 *   - interruptions.protectivePauseEvents (flattened, order-preserving)
 *
 * Deliberately NOT enforced (see the architecture audit this module
 * implements): no uniqueness constraint on (taskId, testedSide) across
 * attempts, no non-empty-attempts requirement, no reconciliation between
 * taskCompletion and attempts, no semantics for longestPauseGapMs (opaque
 * passthrough), no cross-attempt reduction for overallTrackingQuality, no
 * inference of trunkCompensationObserved/asymmetryNotes, no status
 * transition logic. All of those remain unresolved policy for a later
 * layer.
 *
 * No mutation, no aliasing: every object and array reachable from the
 * input — including nested ProtectivePauseReason objects — is copied
 * before being placed in the result, and interruptions.protectivePauseEvents
 * is built from its own independent copy pass so it never shares object
 * identity with attempts[*].protectivePauseEvents even for the same
 * logical event.
 *
 * Integer-millisecond normalization (mechanical, not policy): every
 * elapsed-millisecond field this module touches or derives —
 * reachTimeMs, returnTimeMs, totalMovementTimeMs, and
 * protectivePauseDurationMs on each copied attempt, plus the derived
 * protectivePauseDurationMsTotal — is rounded to the nearest whole
 * millisecond here, once, before the result is returned. Upstream
 * engines compute these from raw performance.now()-sourced timestamp
 * subtraction, which carries sub-millisecond floating-point noise with
 * no clinical meaning; protectivePauseDurationMsTotal in particular is
 * both a typed INTEGER DB column and independently CHECK-constrained
 * against the identical value embedded in result_payload (migration
 * 019), so a fractional value here fails persistence outright. This is
 * the single normalization boundary for every caller of this assembler
 * — the DB layer only ever sees values already rounded here.
 * longestPauseGapMs remains untouched, per its explicit opaque-passthrough
 * status above — its own rounding, where relevant, is owned by whichever
 * integration layer defines its semantics (e.g.
 * forward-reach-pause-duration.ts), not this module.
 */

import {
  validateUpperLimbMotorScreenSessionResultSafety,
  type ClinicalStopEvent,
  type ProtectivePauseEvent,
  type ProtectivePauseReason,
  type UpperLimbMotorScreenSessionResult,
  type UpperLimbMovementAttemptResult,
  type UpperLimbTaskCompletionSummary,
} from "./types";

export type AssembleUpperLimbMotorScreenSessionResultInput = {
  id: string;
  assignmentId: string;
  /** Opaque explicit input — this layer never decides computed vs finalized. */
  status: "computed" | "finalized";
  /** Explicit input — NOT derived from attempts. Multi-attempt aggregation is unresolved policy. */
  taskCompletion: UpperLimbTaskCompletionSummary[];
  /** No uniqueness or non-empty invariant enforced here. */
  attempts: UpperLimbMovementAttemptResult[];
  /** Explicit input — no attempt field to derive clinical stops from. */
  clinicalStopEvents: ClinicalStopEvent[];
  /** Explicit input — no cross-attempt aggregation rule exists yet. */
  overallTrackingQuality: "good" | "fair" | "poor" | "unknown";
  /**
   * Opaque explicit input. Semantics undefined in the current contract
   * (single pause duration vs. inter-pause gap) — must be clarified before
   * the persistence/schema slice. This module never interprets it.
   */
  longestPauseGapMs: number;
  /** Explicit input — no engine currently computes a non-null attempt-level equivalent. */
  trunkCompensationObserved: boolean | null;
  /** Explicit input — no attempt-level equivalent exists in the current contract. */
  asymmetryNotes: string[];
};

function copyProtectivePauseReason(reason: ProtectivePauseReason): ProtectivePauseReason {
  if (reason.category === "tracking_or_environment") {
    return { category: "tracking_or_environment", detail: reason.detail };
  }
  return { category: "configured_limit", detail: reason.detail };
}

function copyProtectivePauseEvent(event: ProtectivePauseEvent): ProtectivePauseEvent {
  return {
    reason: copyProtectivePauseReason(event.reason),
    startedAtMs: event.startedAtMs,
    endedAtMs: event.endedAtMs,
    outcome: event.outcome,
    readinessConfirmedAt: event.readinessConfirmedAt,
    resumedBy: event.resumedBy,
  };
}

/**
 * Rounds a nullable elapsed-millisecond measurement to the nearest whole
 * millisecond, preserving null (a genuinely-unavailable measurement)
 * rather than coercing it to 0. Math.round, not floor/ceil: these values
 * come from subtracting two performance.now()-sourced timestamps, which
 * carry sub-millisecond floating-point noise with no clinical meaning —
 * rounding to nearest is the unbiased choice (floor/ceil would
 * systematically under/over-report every duration), and matches this
 * codebase's existing convention that every other "Ms" quantity
 * (onsetConfirmationMs, dwellDurationMs, maxAllowedGapMs, etc.) is
 * always a whole number.
 */
function roundNullableMs(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function copyAttempt(attempt: UpperLimbMovementAttemptResult): UpperLimbMovementAttemptResult {
  return {
    ...attempt,
    reachTimeMs: roundNullableMs(attempt.reachTimeMs),
    returnTimeMs: roundNullableMs(attempt.returnTimeMs),
    totalMovementTimeMs: roundNullableMs(attempt.totalMovementTimeMs),
    protectivePauseDurationMs: Math.round(attempt.protectivePauseDurationMs),
    protectivePauseEvents: attempt.protectivePauseEvents.map(copyProtectivePauseEvent),
    factualNotes: [...attempt.factualNotes],
  };
}

function copyTaskCompletionSummary(
  entry: UpperLimbTaskCompletionSummary,
): UpperLimbTaskCompletionSummary {
  return { ...entry };
}

function copyClinicalStopEvent(event: ClinicalStopEvent): ClinicalStopEvent {
  return { ...event };
}

/**
 * Assemble a UpperLimbMotorScreenSessionResult. Throws only on the
 * pre-existing safety-vocabulary check (same internal-inconsistency class
 * every engine already applies to its own attempt result via
 * buildAttemptResult) — never on multi-attempt shape, emptiness, or any
 * other business rule. This function assembles; it does not adjudicate
 * policy.
 */
export function assembleUpperLimbMotorScreenSessionResult(
  input: AssembleUpperLimbMotorScreenSessionResultInput,
): UpperLimbMotorScreenSessionResult {
  const attempts = input.attempts.map(copyAttempt);
  const taskCompletion = input.taskCompletion.map(copyTaskCompletionSummary);
  const clinicalStopEvents = input.clinicalStopEvents.map(copyClinicalStopEvent);
  const asymmetryNotes = [...input.asymmetryNotes];

  // Independent copy pass from the original input — must not share object
  // identity with the protectivePauseEvents copied into `attempts` above.
  const interruptionProtectivePauseEvents = input.attempts.flatMap((attempt) =>
    attempt.protectivePauseEvents.map(copyProtectivePauseEvent),
  );

  let protectivePauseCount = 0;
  let protectivePauseDurationMsTotalRaw = 0;
  for (const attempt of input.attempts) {
    protectivePauseCount += attempt.protectivePauseCount;
    protectivePauseDurationMsTotalRaw += attempt.protectivePauseDurationMs;
  }
  // Sum-then-round, once, from the raw (pre-copyAttempt) per-attempt
  // values — not the sum of already-rounded per-attempt copies, which
  // would compound rounding bias across multiple attempts. This total is
  // both a typed INTEGER DB column and independently CHECK-constrained
  // against the identical value embedded in result_payload (migration
  // 019: ulmssr_payload_pause_duration_chk), so it must be an exact
  // integer here — this is the sole place that value is derived, which
  // makes both projections consistent by construction.
  const protectivePauseDurationMsTotal = Math.round(protectivePauseDurationMsTotalRaw);

  const result: UpperLimbMotorScreenSessionResult = {
    id: input.id,
    assignmentId: input.assignmentId,
    status: input.status,
    taskCompletion,
    attempts,
    technicalTrackingQuality: {
      overallQuality: input.overallTrackingQuality,
      protectivePauseCount,
      protectivePauseDurationMsTotal,
      longestPauseGapMs: input.longestPauseGapMs,
    },
    interruptions: {
      clinicalStopEvents,
      protectivePauseEvents: interruptionProtectivePauseEvents,
    },
    observedMovementFeatures: {
      trunkCompensationObserved: input.trunkCompensationObserved,
      asymmetryNotes,
    },
  };

  const safety = validateUpperLimbMotorScreenSessionResultSafety(result);
  if (!safety.ok) {
    throw new Error(
      `assembleUpperLimbMotorScreenSessionResult: internal inconsistency — assembled result failed the safety-vocabulary check at ${safety.forbiddenKeyPaths.join(", ")}`,
    );
  }

  return result;
}
