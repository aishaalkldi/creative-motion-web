/**
 * Reach the Light, exposed as a Block Runner. This file contains no
 * target-lifecycle logic of its own — it is a mechanical field-rename
 * wrapper around the existing, unmodified `target-lifecycle.ts` /
 * `target-lifecycle-gating.ts` state machine. As of PR2,
 * `InteractiveShoulderSession.tsx` resolves and ticks Reach the Light
 * exclusively through `resolveTargetBlockRunner`/`registerTargetBlockRunner`
 * below — it no longer imports `tickTargetLifecycleIfActive` directly.
 */
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import {
  createInitialTargetLifecycle,
  type TargetLifecycleState,
  type TargetLifecycleTickInput,
} from "../target-lifecycle";
import { tickTargetLifecycleIfActive } from "../target-lifecycle-gating";
import type { TargetHitEvent } from "../types";
import type { BlockRunner } from "./block-runner-types";
import {
  getBlockRunnerForBlockType,
  isBlockTypeRegistered,
  registerBlockRunner,
} from "./block-runner-registry";

export const TARGET_BLOCK_RUNNER: BlockRunner<
  TargetLifecycleState,
  TargetLifecycleTickInput,
  TargetHitEvent,
  void
> = {
  blockType: "movement-target",
  createInitialState: () => createInitialTargetLifecycle(),
  tick: (sessionState, state, input) => {
    const result = tickTargetLifecycleIfActive(sessionState, state, input);
    return {
      state: result.state,
      ticked: result.ticked,
      completionEvent: result.hitEvent,
    };
  },
};

/**
 * Registers TARGET_BLOCK_RUNNER under "movement-target". Idempotent — the
 * registry's own duplicate-registration guard would otherwise throw on a
 * second call (e.g. a test file re-importing this module in the same
 * process), so this checks membership first rather than relying on the
 * caller to register exactly once.
 */
export function registerTargetBlockRunner(): void {
  if (isBlockTypeRegistered("movement-target")) return;
  registerBlockRunner(TARGET_BLOCK_RUNNER);
}

/**
 * Resolves TARGET_BLOCK_RUNNER through the shared registry rather than
 * importing the constant directly, so the production call site proves
 * genuine blockType-driven resolution instead of a hardcoded reference.
 *
 * Returns null whenever `blockType` isn't exactly "movement-target" —
 * including undefined (no blockType set) and every other SessionBlockType
 * — so a caller can never be silently handed the wrong runner for the
 * block it asked about.
 *
 * The cast back to this module's concrete type is safe specifically
 * because: (1) `blockType` has just been narrowed to the literal
 * "movement-target" by the check above, and (2) this module is the only
 * place in the codebase that ever registers anything under that key —
 * `registerBlockRunner`'s duplicate-registration guard (block-runner-
 * registry.ts) makes that a structural guarantee, not an assumption a
 * future change could silently break without this file's own test
 * suite catching it.
 */
export function resolveTargetBlockRunner(
  blockType: SessionBlockType | undefined,
): typeof TARGET_BLOCK_RUNNER | null {
  if (blockType !== "movement-target") return null;
  const runner = getBlockRunnerForBlockType(blockType);
  if (!runner) return null;
  return runner as typeof TARGET_BLOCK_RUNNER;
}
