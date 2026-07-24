import type { OrchestratorCvRuntimeFault } from "./orchestrator-cv-block-dispatch";

/** Orchestrator timing must not advance while a runtime fault is active. */
export function shouldAdvanceOrchestratorTick(
  runtimeFault: OrchestratorCvRuntimeFault | null,
): boolean {
  return runtimeFault == null;
}

/** Block runners must not dispatch while a runtime fault is active. */
export function shouldDispatchBlockRunner(
  runtimeFault: OrchestratorCvRuntimeFault | null,
): boolean {
  return runtimeFault == null;
}

/** Resume is rejected while a runtime fault is active. */
export function canResumeOrchestratorSession(
  runtimeFault: OrchestratorCvRuntimeFault | null,
): boolean {
  return runtimeFault == null;
}

/** Pause-on-fault must be applied at most once per fault episode. */
export function applyFaultPauseOnce(
  faultPauseApplied: boolean,
  pause: () => void,
): boolean {
  if (!faultPauseApplied) {
    pause();
    return true;
  }
  return faultPauseApplied;
}
