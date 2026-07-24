/**
 * Pure orchestrator CV block dispatch — no React state, no orchestrator
 * pause side effects. OrchestratorCvSessionCore owns fault reactions.
 */
import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import type {
  MovementBlock,
  SessionBlockType,
  SessionOrchestratorSnapshot,
} from "@/app/lib/session-orchestrator/types";
import { createInitialInstructionalLifecycle } from "./instructional-lifecycle";
import {
  resolveActiveMotionPattern,
  resolveFeedbackInteractionMode,
  type FeedbackInteractionMode,
} from "./motion-patterns/motion-pattern-registry";
import {
  createInitialPatternLifecycle,
  type PatternCompletionEvent,
} from "./motion-patterns/pattern-lifecycle";
import { resetPatternLifecycleForBlock } from "./motion-patterns/pattern-lifecycle-gating";
import type { ResolvedMotionPattern } from "./motion-patterns/motion-pattern-types";
import {
  tickActiveBlockRunner,
  type ActiveBlockRunnerResolvers,
  type ActiveBlockRunnerStates,
  type ActiveBlockTickInput,
  type ActiveBlockTickResult,
} from "./block-engine/tick-active-block-runner";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "./target-generator";
import { createInitialTargetLifecycle } from "./target-lifecycle";
import type { NormalizedPoint, TargetHitEvent } from "./types";

export type OrchestratorCvRuntimeFault =
  | {
      kind: "runner_unavailable";
      blockType: SessionBlockType;
      reason: string;
    }
  | {
      kind: "pattern_unresolved";
      blockId: string;
      feedbackProfile?: string;
    };

export type OrchestratorCvBlockTransitionResult = {
  states: ActiveBlockRunnerStates;
  activeMotionPattern: ResolvedMotionPattern | null;
  feedbackMode: FeedbackInteractionMode;
  presentationProgress: null;
  fault: OrchestratorCvRuntimeFault | null;
};

export type OrchestratorCvBlockDispatchInput = {
  snap: SessionOrchestratorSnapshot;
  nowMs: number;
  wrist: NormalizedPoint | null;
  side: ShoulderAbductionReachSide;
  hitExitTransitionMs: number;
  states: ActiveBlockRunnerStates;
  activeMotionPattern: ResolvedMotionPattern | null;
  /** Optional resolver overrides for deterministic tests — production callers omit. */
  resolvers?: ActiveBlockRunnerResolvers;
};

export type OrchestratorCvBlockDispatchResult =
  | { status: "not_active" }
  | { status: "skipped"; reason: "target_wrist_required" }
  | {
      status: "dispatched";
      states: ActiveBlockRunnerStates;
      targetContact: TargetHitEvent | null;
      patternCompleted: PatternCompletionEvent | null;
      presentationProgress: number | null;
    }
  | { status: "fault"; fault: OrchestratorCvRuntimeFault };

export function resolveOrchestratorBlockType(
  block: MovementBlock | null | undefined,
): SessionBlockType | null {
  if (!block) return null;
  if (block.blockType) return block.blockType;
  const mode = resolveFeedbackInteractionMode(block.feedbackProfile);
  return mode === "motion-pattern" ? "movement-pattern" : "movement-target";
}

export function resetRunnerStatesForBlockTransition(input: {
  block: MovementBlock;
  side: ShoulderAbductionReachSide;
}): OrchestratorCvBlockTransitionResult {
  const blockType = resolveOrchestratorBlockType(input.block);
  const feedbackMode = resolveFeedbackInteractionMode(input.block.feedbackProfile);
  const resolvedPattern = resolveActiveMotionPattern(input.block.feedbackProfile, input.side);

  const states: ActiveBlockRunnerStates = {
    instructional: createInitialInstructionalLifecycle(),
    target: createInitialTargetLifecycle(),
    pattern: resolvedPattern
      ? resetPatternLifecycleForBlock(resolvedPattern.id)
      : createInitialPatternLifecycle(""),
  };

  if (blockType === "movement-pattern" && !resolvedPattern) {
    return {
      states,
      activeMotionPattern: null,
      feedbackMode,
      presentationProgress: null,
      fault: {
        kind: "pattern_unresolved",
        blockId: input.block.blockId,
        feedbackProfile: input.block.feedbackProfile,
      },
    };
  }

  return {
    states,
    activeMotionPattern: resolvedPattern,
    feedbackMode,
    presentationProgress: null,
    fault: null,
  };
}

function mapTickResult(
  tickResult: ActiveBlockTickResult,
): OrchestratorCvBlockDispatchResult {
  if (tickResult.status === "not_active") {
    return { status: "not_active" };
  }
  if (tickResult.status === "runner_unavailable") {
    return {
      status: "fault",
      fault: {
        kind: "runner_unavailable",
        blockType: tickResult.blockType,
        reason: tickResult.reason,
      },
    };
  }
  return {
    status: "dispatched",
    states: tickResult.states,
    targetContact: tickResult.targetContact,
    patternCompleted: tickResult.patternCompleted,
    presentationProgress: tickResult.presentationProgress,
  };
}

export function dispatchOrchestratorCvBlock(
  input: OrchestratorCvBlockDispatchInput,
): OrchestratorCvBlockDispatchResult {
  const { snap } = input;
  if (snap.sessionState !== "active") {
    return { status: "not_active" };
  }

  const currentBlock = snap.currentBlock;
  const blockType = resolveOrchestratorBlockType(currentBlock);
  if (!currentBlock || !blockType) {
    return { status: "not_active" };
  }

  if (blockType === "movement-pattern" && !input.activeMotionPattern) {
    return {
      status: "fault",
      fault: {
        kind: "pattern_unresolved",
        blockId: currentBlock.blockId,
        feedbackProfile: currentBlock.feedbackProfile,
      },
    };
  }

  if (blockType === "movement-target" && !input.wrist) {
    return { status: "skipped", reason: "target_wrist_required" };
  }

  const base = {
    sessionState: snap.sessionState,
    nowMs: input.nowMs,
    blockElapsedSeconds: snap.blockElapsedSeconds,
    states: input.states,
  };

  let tickInput: ActiveBlockTickInput;
  switch (blockType) {
    case "instructional":
      tickInput = {
        ...base,
        blockType: "instructional",
        targetDurationSeconds: currentBlock.targetDurationSeconds,
      };
      break;
    case "movement-target":
      tickInput = {
        ...base,
        blockType: "movement-target",
        wrist: input.wrist,
        side: input.side,
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        hitExitTransitionMs: input.hitExitTransitionMs,
      };
      break;
    case "movement-pattern":
      tickInput = {
        ...base,
        blockType: "movement-pattern",
        wrist: input.wrist,
        pattern: input.activeMotionPattern!,
        completionExitTransitionMs: input.hitExitTransitionMs,
      };
      break;
    default: {
      const _exhaustive: never = blockType;
      return _exhaustive;
    }
  }

  return mapTickResult(tickActiveBlockRunner({ ...tickInput, resolvers: input.resolvers }));
}
