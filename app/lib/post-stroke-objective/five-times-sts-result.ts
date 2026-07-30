/**
 * Post-stroke 5×STS result contract helpers (Phase 2+ persistence).
 * Phase 1 defines shapes only — no result rows are written at assignment time.
 */

import {
  FIVE_TIMES_STS_COMPLETION_STATES,
  FIVE_TIMES_STS_TARGET_REPETITIONS,
  type FiveTimesStsCompletionState,
  type FiveTimesStsProtocol,
  type FiveTimesStsResult,
} from "@/app/lib/post-stroke-objective/types";

export function classifyCompletionStateFromRepetitions(input: {
  protocol: FiveTimesStsProtocol;
  repetitionsCompleted: number;
  interrupted: boolean;
}): FiveTimesStsCompletionState {
  if (input.interrupted) {
    return "interrupted";
  }
  if (input.repetitionsCompleted <= 0) {
    return "not_started";
  }
  if (input.repetitionsCompleted >= FIVE_TIMES_STS_TARGET_REPETITIONS) {
    return "completed";
  }
  return "incomplete";
}

/** Protocol remains whatever was assigned — incomplete standard attempts stay standard. */
export function buildFiveTimesStsResultSkeleton(input: {
  completionState: FiveTimesStsCompletionState;
  repetitionsCompleted: number;
}): FiveTimesStsResult {
  return {
    completionState: input.completionState,
    repetitionsCompleted: input.repetitionsCompleted,
    targetRepetitions: FIVE_TIMES_STS_TARGET_REPETITIONS,
  };
}

export function isValidFiveTimesStsCompletionState(
  value: unknown,
): value is FiveTimesStsCompletionState {
  return (
    typeof value === "string" &&
    (FIVE_TIMES_STS_COMPLETION_STATES as readonly string[]).includes(value)
  );
}

export function readFiveTimesStsResult(value: unknown): FiveTimesStsResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!isValidFiveTimesStsCompletionState(candidate.completionState)) return null;
  if (
    typeof candidate.repetitionsCompleted !== "number" ||
    !Number.isFinite(candidate.repetitionsCompleted) ||
    candidate.repetitionsCompleted < 0
  ) {
    return null;
  }
  if (candidate.targetRepetitions !== FIVE_TIMES_STS_TARGET_REPETITIONS) return null;
  return candidate as FiveTimesStsResult;
}
