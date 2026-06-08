import type { SagittalHipRepPhase } from "@/app/lib/cv/sagittal-hip-rep-core";

/**
 * Map functional-reach rep phase to reachPhase for phase classifier (forward reach extent).
 * Baseline at rest = center; peak forward reach = out.
 */
export function functionalReachReachPhaseFromRepPhase(
  repPhase: SagittalHipRepPhase,
): "center" | "out" {
  return repPhase === "peak" ? "out" : "center";
}

/** Map to standPhase for shared SitToStandDetectorSnapshot / phase classifier wiring. */
export function functionalReachStandPhaseFromRepPhase(
  repPhase: SagittalHipRepPhase,
): "up" | "down" {
  return repPhase === "peak" ? "down" : "up";
}
