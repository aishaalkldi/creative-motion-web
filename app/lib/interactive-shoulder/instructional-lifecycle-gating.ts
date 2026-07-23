import type { SessionState } from "@/app/lib/session-orchestrator/types";
import { shouldTickTargetLifecycle } from "./interactive-shoulder-ui";
import {
  tickInstructionalLifecycle,
  type InstructionalLifecycleState,
  type InstructionalLifecycleTickInput,
  type InstructionalLifecycleTickResult,
} from "./instructional-lifecycle";

export type InstructionalLifecycleGatedTickResult = InstructionalLifecycleTickResult & {
  ticked: boolean;
};

/**
 * Instructional blocks only register completion while the session is
 * active — same simple gate every other lifecycle uses. This gate does
 * not need to "freeze" anything: the underlying tick function's duration
 * check depends only on the caller-supplied, already pause-aware
 * blockElapsedSeconds (see instructional-lifecycle.ts), not on how often
 * or in which session states this function itself has been called. Being
 * skipped entirely during paused/safetyHold — exactly what
 * InteractiveShoulderSession.tsx's existing convention already does for
 * the target/pattern runners — is safe and requires no special handling
 * here.
 */
export function tickInstructionalLifecycleIfActive(
  sessionState: SessionState,
  state: InstructionalLifecycleState,
  input: InstructionalLifecycleTickInput,
): InstructionalLifecycleGatedTickResult {
  if (!shouldTickTargetLifecycle(sessionState)) {
    return { state, completionEvent: null, ticked: false };
  }
  const result = tickInstructionalLifecycle(state, input);
  return { ...result, ticked: true };
}
