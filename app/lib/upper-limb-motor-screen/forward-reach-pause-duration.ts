/**
 * RASQ Upper-Limb Motor Screen — Forward Reach runtime integration layer.
 *
 * Defines longestPauseGapMs for THIS integration layer only, as the longest
 * actual protective-pause duration observed in a single terminal attempt.
 * This is an explicit, isolated, replaceable operational definition — the
 * assembler (session-result-assembler.ts) is never changed to infer this
 * value, and this module makes no clinical judgment about what the value
 * means or should be used for.
 *
 * Rule, per event in attempt.protectivePauseEvents:
 *   - endedAtMs is set        -> endedAtMs - startedAtMs
 *   - endedAtMs is null AND
 *     outcome === "session_ended_while_paused" AND
 *     attempt.completedAtMs is non-null
 *                              -> attempt.completedAtMs - startedAtMs
 *   - otherwise                -> not counted
 * Only finite, non-negative durations are counted. No pauses (or no
 * countable duration among them) -> 0.
 *
 * The returned value is always rounded to the nearest whole millisecond
 * (Math.round) — live event timestamps are performance.now()-sourced and
 * routinely fractional, with no clinical meaning below 1ms.
 */

import type { UpperLimbMovementAttemptResult } from "./types";

export type ForwardReachPauseDurationAttempt = Pick<
  UpperLimbMovementAttemptResult,
  "completedAtMs" | "protectivePauseEvents"
>;

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function computeLongestForwardReachPauseGapMs(
  attempt: ForwardReachPauseDurationAttempt,
): number {
  let longest = 0;

  for (const event of attempt.protectivePauseEvents) {
    let duration: number | null = null;

    if (event.endedAtMs !== null) {
      duration = event.endedAtMs - event.startedAtMs;
    } else if (event.outcome === "session_ended_while_paused" && attempt.completedAtMs !== null) {
      duration = attempt.completedAtMs - event.startedAtMs;
    }

    if (duration !== null && isFiniteNonNegative(duration)) {
      longest = Math.max(longest, duration);
    }
  }

  // Rounded once, at the end, to the nearest whole millisecond — not per
  // event before the max comparison, since rounding is monotonic
  // (round(a) >= round(b) whenever a >= b) so it can never change which
  // event is "longest". event.startedAtMs/endedAtMs and completedAtMs
  // are performance.now()-sourced live timestamps and routinely carry
  // sub-millisecond floating-point noise with no clinical meaning; see
  // session-result-assembler.ts's header comment for the same convention
  // applied to the other elapsed-ms fields it owns.
  return Math.round(longest);
}
