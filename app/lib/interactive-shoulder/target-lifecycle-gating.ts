import type { SessionState } from "@/app/lib/session-orchestrator/types";
import { shouldTickTargetLifecycle } from "./interactive-shoulder-ui";
import {
  tickTargetLifecycle,
  type TargetLifecycleState,
  type TargetLifecycleTickInput,
  type TargetLifecycleTickResult,
} from "./target-lifecycle";

export { shouldTickTargetLifecycle } from "./interactive-shoulder-ui";

export type TargetLifecycleGatedTickResult = TargetLifecycleTickResult & {
  ticked: boolean;
};

/** Target interaction advances only during an active orchestrator block. */
export function tickTargetLifecycleIfActive(
  sessionState: SessionState,
  state: TargetLifecycleState,
  input: TargetLifecycleTickInput,
): TargetLifecycleGatedTickResult {
  if (!shouldTickTargetLifecycle(sessionState)) {
    return { state, hitEvent: null, ticked: false };
  }
  const result = tickTargetLifecycle(state, input);
  return { ...result, ticked: true };
}
