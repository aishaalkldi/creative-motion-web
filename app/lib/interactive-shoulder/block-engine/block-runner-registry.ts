/**
 * Block Runner registry (PR1 — additive, not yet consumed by production).
 *
 * Same role for block dispatch that `exercise-cv-registry.ts` already plays
 * for detector dispatch: a single place that maps a routing key to a
 * pluggable implementation, so adding a new one never means editing a
 * dispatch `if`/`else` chain. It is a lookup mechanism, not a decision —
 * this module does not decide which blockType is active, it only resolves
 * one once asked.
 *
 * Registration is an explicit function call, not a static object literal,
 * because — unlike the closed seven-exercise CV registry — this registry
 * is meant to gain new block types over time (PR4 and beyond) from
 * independent modules that should not need to edit a shared literal.
 * Registering the same blockType twice is treated as a programming error
 * (thrown, not silently overwritten) so a future duplicate registration
 * fails loudly at the point it happens rather than silently shadowing an
 * existing runner.
 *
 * Storage type: the registry holds runners for genuinely different tick
 * input/state/event shapes (target mode needs spawn bounds; pattern mode
 * needs a resolved path). A caller who resolves a runner by blockType is
 * expected to know — from that same blockType — which concrete shape to
 * treat it as, exactly like `exercise-cv-registry.ts`'s `detectorResolver`
 * already asks its caller to know what it's instantiating. The type-erased
 * `ErasedBlockRunner` alias exists only at this storage boundary; it is
 * never exported for callers to build against.
 */
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import type { BlockRunner } from "./block-runner-types";

type ErasedBlockRunner = BlockRunner<unknown, unknown, unknown, unknown>;

const REGISTRY = new Map<SessionBlockType, ErasedBlockRunner>();

export function registerBlockRunner<TState, TTickInput, TCompletionEvent, TInitArgs>(
  runner: BlockRunner<TState, TTickInput, TCompletionEvent, TInitArgs>,
): void {
  if (REGISTRY.has(runner.blockType)) {
    throw new Error(
      `A Block Runner is already registered for blockType "${runner.blockType}". ` +
        "Each blockType may have exactly one runner.",
    );
  }
  REGISTRY.set(runner.blockType, runner as unknown as ErasedBlockRunner);
}

export function getBlockRunnerForBlockType(
  blockType: SessionBlockType,
): ErasedBlockRunner | null {
  return REGISTRY.get(blockType) ?? null;
}

export function isBlockTypeRegistered(blockType: SessionBlockType): boolean {
  return REGISTRY.has(blockType);
}

export function listRegisteredBlockRunners(): readonly ErasedBlockRunner[] {
  return Array.from(REGISTRY.values());
}
