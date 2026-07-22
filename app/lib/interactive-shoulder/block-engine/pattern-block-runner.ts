/**
 * D1-Inspired Diagonal Reach, exposed as a Block Runner. This file
 * contains no progression-integrity logic of its own — it is a
 * mechanical wrapper around the existing, unmodified
 * `motion-patterns/pattern-lifecycle.ts` / `pattern-lifecycle-gating.ts`
 * state machine. Every jump-rejection, reacquisition, and
 * completion-once guarantee already proven there is unchanged; this file
 * does not touch `pattern-lifecycle.ts`. As of PR3,
 * `InteractiveShoulderSession.tsx` resolves and ticks D1-Inspired
 * Diagonal Reach exclusively through `resolvePatternBlockRunner` /
 * `registerPatternBlockRunner` below — it no longer imports
 * `tickPatternLifecycleIfActive` directly.
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
 * the registry's own duplicate-registration guard would otherwise throw
 * on a second call (e.g. a test file re-importing this module in the
 * same process), so this checks membership first rather than relying on
 * the caller to register exactly once.
 */
export function registerPatternBlockRunner(): void {
  if (isBlockTypeRegistered("movement-pattern")) return;
  registerBlockRunner(PATTERN_BLOCK_RUNNER);
}

/**
 * Resolves PATTERN_BLOCK_RUNNER through the shared registry rather than
 * importing the constant directly, so the production call site proves
 * genuine blockType-driven resolution instead of a hardcoded reference —
 * the same approach `target-block-runner.ts` uses for Reach the Light.
 *
 * Returns null whenever `blockType` isn't exactly "movement-pattern" —
 * including undefined and every other SessionBlockType — so a caller can
 * never be silently handed the pattern runner (or any runner) for a
 * block that isn't declared movement-pattern.
 *
 * The cast back to this module's concrete type is safe specifically
 * because: (1) `blockType` has just been narrowed to the literal
 * "movement-pattern" by the check above, and (2) this module is the only
 * place in the codebase that ever registers anything under that key —
 * `registerBlockRunner`'s duplicate-registration guard (block-runner-
 * registry.ts) makes that a structural guarantee, not an assumption a
 * future change could silently break without this file's own test
 * suite catching it.
 */
export function resolvePatternBlockRunner(
  blockType: SessionBlockType | undefined,
): typeof PATTERN_BLOCK_RUNNER | null {
  if (blockType !== "movement-pattern") return null;
  const runner = getBlockRunnerForBlockType(blockType);
  if (!runner) return null;
  return runner as typeof PATTERN_BLOCK_RUNNER;
}
