/**
 * Reach the Light, exposed as a Block Runner (PR1 — additive, not yet
 * consumed by production). This file contains no target-lifecycle logic
 * of its own — it is a mechanical field-rename wrapper around the
 * existing, unmodified `target-lifecycle.ts` / `target-lifecycle-gating.ts`
 * state machine. `InteractiveShoulderSession.tsx` does not import this
 * module yet; it keeps calling `tickTargetLifecycleIfActive` directly
 * until PR2 migrates that call site.
 */
import {
  createInitialTargetLifecycle,
  type TargetLifecycleState,
  type TargetLifecycleTickInput,
} from "../target-lifecycle";
import { tickTargetLifecycleIfActive } from "../target-lifecycle-gating";
import type { TargetHitEvent } from "../types";
import type { BlockRunner } from "./block-runner-types";

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
