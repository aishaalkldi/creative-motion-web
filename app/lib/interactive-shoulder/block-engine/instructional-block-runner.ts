/**
 * Warm-up / Cool-down / presentation-only content, exposed as a Block
 * Runner. Mechanical wrapper around instructional-lifecycle.ts /
 * instructional-lifecycle-gating.ts — same posture as target-block-runner.ts
 * and pattern-block-runner.ts. Not wired to InteractiveShoulderSession.tsx
 * or any other production call site in this PR — additive only, same
 * risk profile as the original BlockRunner contract/registry PR.
 *
 * This runner never produces a rep count, target contact, or pattern
 * progress value — its completion event carries only a timestamp and a
 * reason ("duration" | "acknowledged"), never clinical measurement data.
 */
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import {
  createInitialInstructionalLifecycle,
  type InstructionalCompletionEvent,
  type InstructionalLifecycleState,
  type InstructionalLifecycleTickInput,
} from "../instructional-lifecycle";
import { tickInstructionalLifecycleIfActive } from "../instructional-lifecycle-gating";
import type { BlockRunner } from "./block-runner-types";
import {
  getBlockRunnerForBlockType,
  isBlockTypeRegistered,
  registerBlockRunner,
} from "./block-runner-registry";

export const INSTRUCTIONAL_BLOCK_RUNNER: BlockRunner<
  InstructionalLifecycleState,
  InstructionalLifecycleTickInput,
  InstructionalCompletionEvent,
  void
> = {
  blockType: "instructional",
  createInitialState: () => createInitialInstructionalLifecycle(),
  tick: (sessionState, state, input) => {
    const result = tickInstructionalLifecycleIfActive(sessionState, state, input);
    return {
      state: result.state,
      ticked: result.ticked,
      completionEvent: result.completionEvent,
    };
  },
};

/**
 * Registers INSTRUCTIONAL_BLOCK_RUNNER under "instructional". Idempotent —
 * mirrors registerTargetBlockRunner/registerPatternBlockRunner's guard so a
 * test file re-importing this module in the same process never throws on
 * the registry's duplicate-registration check.
 */
export function registerInstructionalBlockRunner(): void {
  if (isBlockTypeRegistered("instructional")) return;
  registerBlockRunner(INSTRUCTIONAL_BLOCK_RUNNER);
}

/**
 * Resolves INSTRUCTIONAL_BLOCK_RUNNER through the shared registry rather
 * than importing the constant directly — same blockType-driven resolution
 * proof as resolveTargetBlockRunner/resolvePatternBlockRunner.
 *
 * Returns null whenever `blockType` isn't exactly "instructional" —
 * including undefined and every other SessionBlockType — so a caller can
 * never be silently handed this runner (or any runner) for a block that
 * isn't declared instructional.
 *
 * The cast back to this module's concrete type is safe for the same two
 * reasons documented in target-block-runner.ts: the literal-type check
 * above has just narrowed the key being asked for, and this module is the
 * only place that ever registers anything under "instructional" — the
 * registry's duplicate-registration guard makes that structural.
 */
export function resolveInstructionalBlockRunner(
  blockType: SessionBlockType | undefined,
): typeof INSTRUCTIONAL_BLOCK_RUNNER | null {
  if (blockType !== "instructional") return null;
  const runner = getBlockRunnerForBlockType(blockType);
  if (!runner) return null;
  return runner as typeof INSTRUCTIONAL_BLOCK_RUNNER;
}
