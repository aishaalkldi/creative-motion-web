/**
 * D1-Inspired Diagonal Reach, exposed as a Block Runner (PR1 — additive,
 * not yet consumed by production). This file contains no progression-
 * integrity logic of its own — it is a mechanical wrapper around the
 * existing, unmodified `motion-patterns/pattern-lifecycle.ts` /
 * `pattern-lifecycle-gating.ts` state machine. Every jump-rejection,
 * reacquisition, and completion-once guarantee already proven there is
 * unchanged; this file does not touch `pattern-lifecycle.ts`.
 * `InteractiveShoulderSession.tsx` does not import this module yet; it
 * keeps calling `tickPatternLifecycleIfActive` directly until PR3
 * migrates that call site.
 */
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import {
  createInitialPatternLifecycle,
  type PatternCompletionEvent,
  type PatternLifecycleState,
  type PatternLifecycleTickInput,
} from "../motion-patterns/pattern-lifecycle";
import { tickPatternLifecycleIfActive } from "../motion-patterns/pattern-lifecycle-gating";
import type { BlockRunner } from "./block-runner-types";
import {
  getBlockRunnerForBlockType,
  isBlockTypeRegistered,
  registerBlockRunner,
} from "./block-runner-registry";

export const PATTERN_BLOCK_RUNNER: BlockRunner<
  PatternLifecycleState,
  PatternLifecycleTickInput,
  PatternCompletionEvent,
  string
> = {
  blockType: "movement-pattern",
  /** initArgs is the pattern's own id (e.g. "d1-inspired-diagonal-reach"), not the session block's blockId. */
  createInitialState: (patternId) => createInitialPatternLifecycle(patternId),
  tick: (sessionState, state, input) => {
    const result = tickPatternLifecycleIfActive(sessionState, state, input);
    return {
      state: result.state,
      ticked: result.ticked,
      completionEvent: result.completionEvent,
    };
  },
};

/**
 * Registers PATTERN_BLOCK_RUNNER under "movement-pattern". Idempotent —
 * mirrors registerTargetBlockRunner/registerInstructionalBlockRunner's guard
 * so a test file re-importing this module in the same process never throws on
 * the registry's duplicate-registration check.
 */
export function registerPatternBlockRunner(): void {
  if (isBlockTypeRegistered("movement-pattern")) return;
  registerBlockRunner(PATTERN_BLOCK_RUNNER);
}

/**
 * Resolves PATTERN_BLOCK_RUNNER through the shared registry rather than
 * importing the constant directly — same blockType-driven resolution proof
 * as resolveTargetBlockRunner/resolveInstructionalBlockRunner.
 *
 * Returns null whenever `blockType` isn't exactly "movement-pattern" —
 * including undefined and every other SessionBlockType — so a caller can
 * never be silently handed this runner for a block that isn't declared
 * movement-pattern.
 */
export function resolvePatternBlockRunner(
  blockType: SessionBlockType | undefined,
): typeof PATTERN_BLOCK_RUNNER | null {
  if (blockType !== "movement-pattern") return null;
  const runner = getBlockRunnerForBlockType(blockType);
  if (!runner) return null;
  return runner as typeof PATTERN_BLOCK_RUNNER;
}
