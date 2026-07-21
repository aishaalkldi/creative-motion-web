import {
  DEFAULT_TARGET_HIT_CONFIG,
  isWristInsideTarget,
  shouldRegisterTargetHit,
} from "./target-hit";
import { generateTherapeuticTarget } from "./target-generator";
import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import {
  createEmptyShoulderInteractionMetrics,
  type NormalizedPoint,
  type SafeTargetBounds,
  type ShoulderInteractionMetrics,
  type TargetHitConfig,
  type TargetHitEvent,
  type TherapeuticTarget,
} from "./types";

export type TargetLifecycleState = {
  currentTarget: TherapeuticTarget | null;
  wristInside: boolean;
  targetHit: boolean;
  sequence: number;
  interaction: ShoulderInteractionMetrics;
};

export function createInitialTargetLifecycle(): TargetLifecycleState {
  return {
    currentTarget: null,
    wristInside: false,
    targetHit: false,
    sequence: 0,
    interaction: createEmptyShoulderInteractionMetrics(),
  };
}

export type TargetLifecycleTickInput = {
  wrist: NormalizedPoint | null;
  nowMs: number;
  side: ShoulderAbductionReachSide;
  bounds: SafeTargetBounds;
  hitConfig?: TargetHitConfig;
  random?: () => number;
};

export type TargetLifecycleTickResult = {
  state: TargetLifecycleState;
  hitEvent: TargetHitEvent | null;
};

function spawnNextTarget(
  state: TargetLifecycleState,
  input: TargetLifecycleTickInput,
): TargetLifecycleState {
  const nextSequence = state.sequence + 1;
  const target = generateTherapeuticTarget({
    bounds: input.bounds,
    side: input.side,
    nowMs: input.nowMs,
    sequence: nextSequence,
    previousTarget: state.currentTarget,
    random: input.random,
  });
  return {
    ...state,
    sequence: nextSequence,
    currentTarget: target,
    wristInside: false,
    targetHit: false,
    interaction: {
      ...state.interaction,
      targetsShown: state.interaction.targetsShown + 1,
    },
  };
}

export function tickTargetLifecycle(
  state: TargetLifecycleState,
  input: TargetLifecycleTickInput,
): TargetLifecycleTickResult {
  const config = input.hitConfig ?? DEFAULT_TARGET_HIT_CONFIG;
  let next = state;
  let hitEvent: TargetHitEvent | null = null;

  if (!next.currentTarget) {
    next = spawnNextTarget(next, input);
  }

  if (!input.wrist || !next.currentTarget) {
    return { state: { ...next, wristInside: false }, hitEvent: null };
  }

  const isInside = isWristInsideTarget(input.wrist, next.currentTarget, config);
  if (
    shouldRegisterTargetHit(next.wristInside, isInside, next.targetHit) &&
    next.currentTarget
  ) {
    const reactionTimeMs = Math.max(0, input.nowMs - next.currentTarget.spawnedAtMs);
    hitEvent = {
      targetId: next.currentTarget.id,
      capturedAtMs: input.nowMs,
      reactionTimeMs,
    };
    next = {
      ...next,
      wristInside: isInside,
      targetHit: true,
      interaction: {
        ...next.interaction,
        targetsReached: next.interaction.targetsReached + 1,
        targetHitTimestampsMs: [...next.interaction.targetHitTimestampsMs, input.nowMs],
        reactionTimesMs: [...next.interaction.reactionTimesMs, reactionTimeMs],
      },
    };
    next = spawnNextTarget(next, input);
    return { state: { ...next, wristInside: false }, hitEvent };
  }

  return { state: { ...next, wristInside: isInside }, hitEvent: null };
}
