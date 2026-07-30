import type {
  NormalizedUpperLimbSessionResult,
  SerializedUpperLimbSessionResult,
} from "./types";

/**
 * Pure, deterministic conversion of a NormalizedUpperLimbSessionResult into
 * a persistence-ready, JSON-safe plain object.
 *
 * This does not write to Supabase, local storage, any API, or any existing
 * persistence utility, and it does not create migrations — it only builds
 * the plain object a caller could safely JSON.stringify or hand to a
 * persistence layer of their choosing.
 *
 * Every field is listed explicitly (rather than spreading the input) so
 * this function stays independent of the normalizer's internal object
 * identity and never leaks an `undefined` value: optional facts are always
 * `null`, never omitted or undefined.
 */
export function serializeUpperLimbSessionResult(
  result: NormalizedUpperLimbSessionResult,
): SerializedUpperLimbSessionResult {
  return {
    schemaVersion: result.schemaVersion,
    sessionId: result.sessionId,
    patientId: result.patientId,
    exerciseId: result.exerciseId,
    affectedSide: result.affectedSide,

    timing: {
      startedAt: result.timing.startedAt,
      endedAt: result.timing.endedAt ?? null,
      elapsedSeconds: result.timing.elapsedSeconds,
    },

    performance: {
      targetAttempts: result.performance.targetAttempts,
      successfulTargets: result.performance.successfulTargets,
      incompleteAttempts: result.performance.incompleteAttempts,
    },

    tracking: {
      quality: result.tracking.quality,
      interruptionCount: result.tracking.interruptionCount,
    },

    observations: {
      trunkCompensationCount: result.observations.trunkCompensationCount,
    },

    patientReported: {
      pain: result.patientReported.pain ?? null,
      effort: result.patientReported.effort ?? null,
    },

    completion: {
      state: result.completion.state,
      interruptionReason: result.completion.interruptionReason ?? null,
    },
  };
}
