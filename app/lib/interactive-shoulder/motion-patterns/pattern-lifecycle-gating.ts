import type { SessionState } from "@/app/lib/session-orchestrator/types";
import { shouldTickTargetLifecycle } from "../interactive-shoulder-ui";
import {
  createInitialPatternLifecycle,
  tickPatternLifecycle,
  type PatternLifecycleState,
  type PatternLifecycleTickInput,
  type PatternLifecycleTickResult,
} from "./pattern-lifecycle";

export type PatternLifecycleGatedTickResult = PatternLifecycleTickResult & {
  ticked: boolean;
};

/** Pattern interaction advances only during an active orchestrator block. */
export function tickPatternLifecycleIfActive(
  sessionState: SessionState,
  state: PatternLifecycleState,
  input: PatternLifecycleTickInput,
): PatternLifecycleGatedTickResult {
  if (!shouldTickTargetLifecycle(sessionState)) {
    return { state, completionEvent: null, ticked: false };
  }
  const result = tickPatternLifecycle(state, input);
  return { ...result, ticked: true };
}

export function resetPatternLifecycleForBlock(patternId: string): PatternLifecycleState {
  return createInitialPatternLifecycle(patternId);
}
