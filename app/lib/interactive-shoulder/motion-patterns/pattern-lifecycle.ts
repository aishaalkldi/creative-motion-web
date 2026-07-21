import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import {
  createEmptyShoulderInteractionMetrics,
  type NormalizedPoint,
  type ShoulderInteractionMetrics,
} from "../types";
import { projectPointOntoPath, samplePathAtProgress } from "./bezier-path";
import type { ResolvedMotionPattern } from "./motion-pattern-types";

export type PatternCompletionEvent = {
  patternId: string;
  capturedAtMs: number;
  reactionTimeMs: number;
  pathProgress: number;
};

export type PatternLifecycleState = {
  patternId: string;
  pathProgress: number;
  furthestProgress: number;
  wristNearPath: boolean;
  sequence: number;
  startedAtMs: number | null;
  spawnLockedUntilMs: number | null;
  exitingProgress: number | null;
  interaction: ShoulderInteractionMetrics;
};

export function createInitialPatternLifecycle(patternId: string): PatternLifecycleState {
  return {
    patternId,
    pathProgress: 0,
    furthestProgress: 0,
    wristNearPath: false,
    sequence: 0,
    startedAtMs: null,
    spawnLockedUntilMs: null,
    exitingProgress: null,
    interaction: createEmptyShoulderInteractionMetrics(),
  };
}

export type PatternLifecycleTickInput = {
  wrist: NormalizedPoint | null;
  nowMs: number;
  pattern: ResolvedMotionPattern;
  completionExitTransitionMs?: number;
};

export type PatternLifecycleTickResult = {
  state: PatternLifecycleState;
  completionEvent: PatternCompletionEvent | null;
};

function resetForNextPass(state: PatternLifecycleState, nowMs: number): PatternLifecycleState {
  return {
    ...state,
    pathProgress: 0,
    furthestProgress: 0,
    wristNearPath: false,
    sequence: state.sequence + 1,
    startedAtMs: nowMs,
    spawnLockedUntilMs: null,
    exitingProgress: null,
    interaction: {
      ...state.interaction,
      targetsShown: state.interaction.targetsShown + 1,
    },
  };
}

export function tickPatternLifecycle(
  state: PatternLifecycleState,
  input: PatternLifecycleTickInput,
): PatternLifecycleTickResult {
  const exitTransitionMs = input.completionExitTransitionMs ?? 0;
  let next = state;
  let completionEvent: PatternCompletionEvent | null = null;

  if (next.spawnLockedUntilMs !== null) {
    if (input.nowMs < next.spawnLockedUntilMs) {
      return { state: { ...next, wristNearPath: false }, completionEvent: null };
    }
    next = resetForNextPass(
      {
        ...next,
        spawnLockedUntilMs: null,
        exitingProgress: null,
      },
      input.nowMs,
    );
  }

  if (next.startedAtMs === null) {
    next = {
      ...next,
      startedAtMs: input.nowMs,
      interaction: {
        ...next.interaction,
        targetsShown: next.interaction.targetsShown + 1,
      },
    };
  }

  if (!input.wrist) {
    return { state: { ...next, wristNearPath: false }, completionEvent: null };
  }

  const projection = projectPointOntoPath(input.pattern.sampledPath, input.wrist);
  const nearPath = projection.distance <= input.pattern.pathTolerance;
  const minAdvance = input.pattern.minAdvanceDelta ?? 0.003;
  let furthestProgress = next.furthestProgress;

  if (nearPath && projection.progress >= furthestProgress + minAdvance) {
    furthestProgress = Math.max(furthestProgress, projection.progress);
  } else if (nearPath && projection.progress >= furthestProgress) {
    furthestProgress = projection.progress;
  }

  next = {
    ...next,
    wristNearPath: nearPath,
    furthestProgress,
    pathProgress: furthestProgress,
  };

  if (furthestProgress >= input.pattern.completionProgress && next.spawnLockedUntilMs === null) {
    const reactionTimeMs = Math.max(0, input.nowMs - (next.startedAtMs ?? input.nowMs));
    completionEvent = {
      patternId: input.pattern.id,
      capturedAtMs: input.nowMs,
      reactionTimeMs,
      pathProgress: furthestProgress,
    };
    next = {
      ...next,
      interaction: {
        ...next.interaction,
        targetsReached: next.interaction.targetsReached + 1,
        targetHitTimestampsMs: [...next.interaction.targetHitTimestampsMs, input.nowMs],
        reactionTimesMs: [...next.interaction.reactionTimesMs, reactionTimeMs],
      },
      exitingProgress: furthestProgress,
      pathProgress: furthestProgress,
    };

    if (exitTransitionMs > 0) {
      next = {
        ...next,
        spawnLockedUntilMs: input.nowMs + exitTransitionMs,
      };
      return { state: next, completionEvent };
    }

    next = resetForNextPass(next, input.nowMs);
    return { state: next, completionEvent };
  }

  return { state: next, completionEvent: null };
}

export function getPatternGuidePoint(
  pattern: ResolvedMotionPattern,
  progress: number,
): NormalizedPoint {
  return samplePathAtProgress(pattern.sampledPath, progress);
}

export function isPatternSpawnLocked(
  spawnLockedUntilMs: number | null,
  nowMs: number,
): boolean {
  return spawnLockedUntilMs !== null && nowMs < spawnLockedUntilMs;
}
