/**
 * Centralized active-block dispatch by blockType. Callers tick exactly one
 * runner per frame based on the orchestrator's current block — this module
 * does not decide which block is active.
 *
 * Instructional blocks: presentation progress only. Duration-based block
 * completion remains SessionOrchestrator's responsibility — this dispatch
 * never passes targetDurationSeconds or acknowledgement into the
 * instructional lifecycle, so the runner cannot complete the block here.
 *
 * Unknown or unregistered runners return a structured runner_unavailable
 * result — never a silent successful no-op.
 */
import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import type { SessionState } from "@/app/lib/session-orchestrator/types";
import type {
  PatternCompletionEvent,
  PatternLifecycleState,
} from "../motion-patterns/pattern-lifecycle";
import type { ResolvedMotionPattern } from "../motion-patterns/motion-pattern-types";
import type { InstructionalLifecycleState } from "../instructional-lifecycle";
import type { TargetLifecycleState } from "../target-lifecycle";
import type { NormalizedPoint, SafeTargetBounds, TargetHitEvent } from "../types";
import {
  resolveInstructionalBlockRunner,
} from "./instructional-block-runner";
import {
  resolvePatternBlockRunner,
} from "./pattern-block-runner";
import {
  resolveTargetBlockRunner,
} from "./target-block-runner";

export type InstructionalBlockRunner = NonNullable<
  ReturnType<typeof resolveInstructionalBlockRunner>
>;
export type TargetBlockRunner = NonNullable<ReturnType<typeof resolveTargetBlockRunner>>;
export type PatternBlockRunner = NonNullable<ReturnType<typeof resolvePatternBlockRunner>>;

export type ActiveBlockRunnerResolvers = {
  resolveInstructionalRunner?: () => InstructionalBlockRunner | null;
  resolveTargetRunner?: () => TargetBlockRunner | null;
  resolvePatternRunner?: () => PatternBlockRunner | null;
};

const defaultResolveInstructionalRunner = (): InstructionalBlockRunner | null =>
  resolveInstructionalBlockRunner("instructional");
const defaultResolveTargetRunner = (): TargetBlockRunner | null =>
  resolveTargetBlockRunner("movement-target");
const defaultResolvePatternRunner = (): PatternBlockRunner | null =>
  resolvePatternBlockRunner("movement-pattern");

export type ActiveBlockRunnerStates = {
  instructional: InstructionalLifecycleState;
  target: TargetLifecycleState;
  pattern: PatternLifecycleState;
};

type ActiveBlockTickBase = {
  sessionState: SessionState;
  nowMs: number;
  blockElapsedSeconds: number;
  states: ActiveBlockRunnerStates;
  /** Optional typed resolver overrides — production callers omit this. */
  resolvers?: ActiveBlockRunnerResolvers;
};

export type InstructionalBlockTickInput = ActiveBlockTickBase & {
  blockType: "instructional";
  targetDurationSeconds?: number;
};

export type TargetBlockTickInput = ActiveBlockTickBase & {
  blockType: "movement-target";
  wrist: NormalizedPoint | null;
  side: ShoulderAbductionReachSide;
  bounds: SafeTargetBounds;
  hitExitTransitionMs?: number;
  random?: () => number;
};

export type PatternBlockTickInput = ActiveBlockTickBase & {
  blockType: "movement-pattern";
  wrist: NormalizedPoint | null;
  pattern: ResolvedMotionPattern;
  completionExitTransitionMs?: number;
};

export type ActiveBlockTickInput =
  | InstructionalBlockTickInput
  | TargetBlockTickInput
  | PatternBlockTickInput;

export type ActiveBlockTickResult =
  | {
      status: "ticked";
      ticked: true;
      blockType: ActiveBlockTickInput["blockType"];
      states: ActiveBlockRunnerStates;
      targetContact: TargetHitEvent | null;
      patternCompleted: PatternCompletionEvent | null;
      /** 0–1 presentation progress for instructional blocks; null otherwise. */
      presentationProgress: number | null;
    }
  | {
      status: "not_active";
      ticked: false;
      sessionState: SessionState;
    }
  | {
      status: "runner_unavailable";
      ticked: false;
      blockType: ActiveBlockTickInput["blockType"];
      reason: string;
    };

function computeInstructionalPresentationProgress(
  blockElapsedSeconds: number,
  targetDurationSeconds: number | undefined,
): number | null {
  if (
    targetDurationSeconds == null ||
    !Number.isFinite(targetDurationSeconds) ||
    targetDurationSeconds <= 0 ||
    !Number.isFinite(blockElapsedSeconds)
  ) {
    return null;
  }
  return Math.min(1, Math.max(0, blockElapsedSeconds / targetDurationSeconds));
}

function runnerUnavailable(
  blockType: ActiveBlockTickInput["blockType"],
): ActiveBlockTickResult {
  return {
    status: "runner_unavailable",
    ticked: false,
    blockType,
    reason: `No Block Runner registered for blockType "${blockType}".`,
  };
}

export function tickActiveBlockRunner(input: ActiveBlockTickInput): ActiveBlockTickResult {
  if (input.sessionState !== "active") {
    return { status: "not_active", ticked: false, sessionState: input.sessionState };
  }

  const nextStates = { ...input.states };
  const resolvers = input.resolvers;

  switch (input.blockType) {
    case "instructional": {
      const runner = (resolvers?.resolveInstructionalRunner ?? defaultResolveInstructionalRunner)();
      if (!runner) return runnerUnavailable("instructional");

      const ticked = runner.tick("active", nextStates.instructional, {
        nowMs: input.nowMs,
        blockElapsedSeconds: input.blockElapsedSeconds,
      });
      nextStates.instructional = ticked.state;
      return {
        status: "ticked",
        ticked: true,
        blockType: "instructional",
        states: nextStates,
        targetContact: null,
        patternCompleted: null,
        presentationProgress: computeInstructionalPresentationProgress(
          input.blockElapsedSeconds,
          input.targetDurationSeconds,
        ),
      };
    }
    case "movement-target": {
      const runner = (resolvers?.resolveTargetRunner ?? defaultResolveTargetRunner)();
      if (!runner) return runnerUnavailable("movement-target");

      const ticked = runner.tick("active", nextStates.target, {
        wrist: input.wrist,
        nowMs: input.nowMs,
        side: input.side,
        bounds: input.bounds,
        hitExitTransitionMs: input.hitExitTransitionMs,
        random: input.random,
      });
      nextStates.target = ticked.state;
      return {
        status: "ticked",
        ticked: true,
        blockType: "movement-target",
        states: nextStates,
        targetContact: ticked.completionEvent,
        patternCompleted: null,
        presentationProgress: null,
      };
    }
    case "movement-pattern": {
      const runner = (resolvers?.resolvePatternRunner ?? defaultResolvePatternRunner)();
      if (!runner) return runnerUnavailable("movement-pattern");

      const ticked = runner.tick("active", nextStates.pattern, {
        wrist: input.wrist,
        nowMs: input.nowMs,
        pattern: input.pattern,
        completionExitTransitionMs: input.completionExitTransitionMs,
      });
      nextStates.pattern = ticked.state;
      return {
        status: "ticked",
        ticked: true,
        blockType: "movement-pattern",
        states: nextStates,
        targetContact: null,
        patternCompleted: ticked.completionEvent,
        presentationProgress: null,
      };
    }
    default: {
      const _exhaustive: never = input;
      return _exhaustive;
    }
  }
}
