import type { SessionState } from "@/app/lib/session-orchestrator/types";

/** Full-session completion only — block transitions remain sessionState "active". */
export function shouldFireSessionCompleteCallback(
  sessionState: SessionState,
  hasFired: boolean,
): boolean {
  return sessionState === "completed" && !hasFired;
}
