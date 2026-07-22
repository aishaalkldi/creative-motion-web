import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import type { NormalizedPoint } from "../types";
import { projectPointOntoPath, samplePathAtProgress } from "./bezier-path";
import type { PatternProgressionConfig, ResolvedMotionPattern } from "./motion-pattern-types";

export type PatternCompletionEvent = {
  patternId: string;
  capturedAtMs: number;
  reactionTimeMs: number;
  pathProgress: number;
};

export type PatternInteractionMetrics = {
  patternsShown: number;
  patternsCompleted: number;
  completionTimestampsMs: number[];
  reactionTimesMs: number[];
};

export function createEmptyPatternInteractionMetrics(): PatternInteractionMetrics {
  return {
    patternsShown: 0,
    patternsCompleted: 0,
    completionTimestampsMs: [],
    reactionTimesMs: [],
  };
}

export type PatternLifecycleState = {
  patternId: string;
  pathProgress: number;
  furthestProgress: number;
  wristNearPath: boolean;
  hasAcquiredStart: boolean;
  awaitingReacquisition: boolean;
  acceptedSampleCount: number;
  completionEmittedForPass: boolean;
  sequence: number;
  startedAtMs: number | null;
  spawnLockedUntilMs: number | null;
  exitingProgress: number | null;
  interaction: PatternInteractionMetrics;
};

export function createInitialPatternLifecycle(patternId: string): PatternLifecycleState {
  return {
    patternId,
    pathProgress: 0,
    furthestProgress: 0,
    wristNearPath: false,
    hasAcquiredStart: false,
    awaitingReacquisition: false,
    acceptedSampleCount: 0,
    completionEmittedForPass: false,
    sequence: 0,
    startedAtMs: null,
    spawnLockedUntilMs: null,
    exitingProgress: null,
    interaction: createEmptyPatternInteractionMetrics(),
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

function progressionConfig(pattern: ResolvedMotionPattern): PatternProgressionConfig {
  return pattern.progression;
}

function resetForNextPass(state: PatternLifecycleState, nowMs: number): PatternLifecycleState {
  return {
    ...state,
    pathProgress: 0,
    furthestProgress: 0,
    wristNearPath: false,
    hasAcquiredStart: false,
    awaitingReacquisition: false,
    acceptedSampleCount: 0,
    completionEmittedForPass: false,
    sequence: state.sequence + 1,
    startedAtMs: nowMs,
    spawnLockedUntilMs: null,
    exitingProgress: null,
    interaction: {
      ...state.interaction,
      patternsShown: state.interaction.patternsShown + 1,
    },
  };
}

function isNearAcceptedProgress(
  progress: number,
  furthestProgress: number,
  window: number,
): boolean {
  return Math.abs(progress - furthestProgress) <= window;
}

function canEmitCompletion(
  state: PatternLifecycleState,
  cfg: PatternProgressionConfig,
): boolean {
  return (
    state.hasAcquiredStart &&
    !state.awaitingReacquisition &&
    !state.completionEmittedForPass &&
    state.spawnLockedUntilMs === null &&
    state.acceptedSampleCount >= cfg.minimumAcceptedSamples &&
    state.furthestProgress >= cfg.completionProgress
  );
}

export function tickPatternLifecycle(
  state: PatternLifecycleState,
  input: PatternLifecycleTickInput,
): PatternLifecycleTickResult {
  const cfg = progressionConfig(input.pattern);
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
        patternsShown: next.interaction.patternsShown + 1,
      },
    };
  }

  if (!input.wrist) {
    const awaitingReacquisition =
      next.hasAcquiredStart || next.awaitingReacquisition ? true : next.awaitingReacquisition;
    return {
      state: {
        ...next,
        wristNearPath: false,
        awaitingReacquisition,
        pathProgress: next.furthestProgress,
      },
      completionEvent: null,
    };
  }

  const projection = projectPointOntoPath(input.pattern.sampledPath, input.wrist);
  const nearPath = projection.distance <= cfg.pathTolerance;
  let furthestProgress = next.furthestProgress;
  let hasAcquiredStart = next.hasAcquiredStart;
  let awaitingReacquisition = next.awaitingReacquisition;
  let acceptedSampleCount = next.acceptedSampleCount;

  if (awaitingReacquisition) {
    if (nearPath && isNearAcceptedProgress(projection.progress, furthestProgress, cfg.reacquisitionProgressWindow)) {
      awaitingReacquisition = false;
    } else {
      return {
        state: {
          ...next,
          wristNearPath: nearPath,
          awaitingReacquisition: true,
          pathProgress: furthestProgress,
        },
        completionEvent: null,
      };
    }
  }

  if (!hasAcquiredStart) {
    if (nearPath && projection.progress <= cfg.startAcquisitionMaxProgress) {
      hasAcquiredStart = true;
      acceptedSampleCount += 1;
      furthestProgress = Math.max(furthestProgress, projection.progress);
    }
    return {
      state: {
        ...next,
        wristNearPath: nearPath,
        hasAcquiredStart,
        awaitingReacquisition,
        acceptedSampleCount,
        furthestProgress,
        pathProgress: furthestProgress,
      },
      completionEvent: null,
    };
  }

  if (!nearPath) {
    return {
      state: {
        ...next,
        wristNearPath: false,
        hasAcquiredStart,
        awaitingReacquisition,
        acceptedSampleCount,
        furthestProgress,
        pathProgress: furthestProgress,
      },
      completionEvent: null,
    };
  }

  if (projection.progress > furthestProgress + cfg.maxForwardProgressWindow) {
    awaitingReacquisition = true;
    return {
      state: {
        ...next,
        wristNearPath: nearPath,
        hasAcquiredStart,
        awaitingReacquisition,
        acceptedSampleCount,
        furthestProgress,
        pathProgress: furthestProgress,
      },
      completionEvent: null,
    };
  }

  if (projection.progress < furthestProgress - cfg.reverseTolerance) {
    return {
      state: {
        ...next,
        wristNearPath: nearPath,
        hasAcquiredStart,
        awaitingReacquisition,
        acceptedSampleCount,
        furthestProgress,
        pathProgress: furthestProgress,
      },
      completionEvent: null,
    };
  }

  if (projection.progress >= furthestProgress + cfg.minAdvanceDelta) {
    furthestProgress = projection.progress;
    acceptedSampleCount += 1;
  } else if (projection.progress > furthestProgress) {
    furthestProgress = projection.progress;
  }

  next = {
    ...next,
    wristNearPath: nearPath,
    hasAcquiredStart,
    awaitingReacquisition,
    acceptedSampleCount,
    furthestProgress,
    pathProgress: furthestProgress,
  };

  if (canEmitCompletion(next, cfg)) {
    const reactionTimeMs = Math.max(0, input.nowMs - (next.startedAtMs ?? input.nowMs));
    completionEvent = {
      patternId: input.pattern.id,
      capturedAtMs: input.nowMs,
      reactionTimeMs,
      pathProgress: furthestProgress,
    };
    next = {
      ...next,
      completionEmittedForPass: true,
      interaction: {
        ...next.interaction,
        patternsCompleted: next.interaction.patternsCompleted + 1,
        completionTimestampsMs: [...next.interaction.completionTimestampsMs, input.nowMs],
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
