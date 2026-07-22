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
import {
  createInitialPatternLifecycle,
  type PatternCompletionEvent,
  type PatternLifecycleState,
  type PatternLifecycleTickInput,
} from "../motion-patterns/pattern-lifecycle";
import { tickPatternLifecycleIfActive } from "../motion-patterns/pattern-lifecycle-gating";
import type { BlockRunner } from "./block-runner-types";

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
