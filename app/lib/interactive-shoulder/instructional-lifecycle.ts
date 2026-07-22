/**
 * Instructional block lifecycle — presentation-only session content such
 * as Warm-up and Cool-down. Deliberately the simplest lifecycle in this
 * module family: no wrist/motion input, no spawn geometry, no progression
 * integrity concerns, because there is no movement to track. Completion
 * fires from accumulated ACTIVE duration, an explicit acknowledgement, or
 * whichever comes first — never from any clinical or motion signal.
 *
 * This module does not track its own elapsed time and never reconstructs
 * one from nowMs. An earlier version of this file tried to reimplement
 * pause-aware duration tracking internally (accumulatedActiveMs /
 * activeSinceMs / freezeInstructionalLifecycle) and remained incorrect
 * whenever the caller simply didn't tick this lifecycle during a pause —
 * which is exactly what InteractiveShoulderSession.tsx's existing,
 * established convention does for the target/pattern runners today
 * (`if (snap.sessionState === "active") { ...tick... }`, never ticked
 * otherwise). Reconstructing pause-awareness from a tick stream that may
 * simply stop arriving during a pause cannot be made correct from inside
 * this module.
 *
 * Instead, duration-based completion consumes `blockElapsedSeconds` —
 * required on every tick, sourced by the caller from
 * `SessionOrchestratorSnapshot.blockElapsedSeconds`, which the orchestrator
 * already guarantees excludes paused/safetyHold time via its own
 * PausableTimer. This lifecycle is correct regardless of how often, or in
 * which session states, it happens to be ticked — its own tick-call
 * discipline no longer matters for timing correctness.
 *
 * This file must never grow a rep count, target count, pattern-progress
 * field, or any other measurement — that would misrepresent an
 * instructional pause as measured clinical data. If a future block needs
 * measurement, it belongs in a movement-target/movement-pattern-style
 * lifecycle, not here.
 */

export type InstructionalCompletionReason = "duration" | "acknowledged";

export type InstructionalCompletionEvent = {
  capturedAtMs: number;
  reason: InstructionalCompletionReason;
};

export type InstructionalLifecycleState = {
  completed: boolean;
};

export function createInitialInstructionalLifecycle(): InstructionalLifecycleState {
  return { completed: false };
}

export type InstructionalLifecycleTickInput = {
  nowMs: number;
  /**
   * Pause-aware active elapsed seconds for the current block. Must be
   * `SessionOrchestratorSnapshot.blockElapsedSeconds` (or an equivalent
   * value carrying the same paused/safetyHold-exclusion guarantee) —
   * never derived from `nowMs` by the caller. Required, not optional:
   * there is no wall-clock fallback anywhere in this module, by design —
   * an absent or non-finite value simply prevents duration-based
   * completion (see tickInstructionalLifecycle) rather than silently
   * substituting a less-safe calculation.
   */
  blockElapsedSeconds: number;
  /** Auto-completes once blockElapsedSeconds reaches this value. Omit for acknowledgement-only blocks. */
  targetDurationSeconds?: number;
  /** Patient/UI-driven "I'm ready" signal — completes immediately regardless of elapsed duration. */
  acknowledged?: boolean;
};

export type InstructionalLifecycleTickResult = {
  state: InstructionalLifecycleState;
  completionEvent: InstructionalCompletionEvent | null;
};

export function tickInstructionalLifecycle(
  state: InstructionalLifecycleState,
  input: InstructionalLifecycleTickInput,
): InstructionalLifecycleTickResult {
  if (state.completed) {
    // Completion-once guard — mirrors the exit-lock/completionEmittedForPass
    // pattern already used by target-lifecycle.ts and pattern-lifecycle.ts.
    return { state, completionEvent: null };
  }

  const acknowledged = input.acknowledged === true;
  const durationMet =
    input.targetDurationSeconds != null &&
    Number.isFinite(input.blockElapsedSeconds) &&
    input.blockElapsedSeconds >= input.targetDurationSeconds;

  if (acknowledged || durationMet) {
    return {
      state: { completed: true },
      completionEvent: {
        capturedAtMs: input.nowMs,
        reason: acknowledged ? "acknowledged" : "duration",
      },
    };
  }

  return { state, completionEvent: null };
}
