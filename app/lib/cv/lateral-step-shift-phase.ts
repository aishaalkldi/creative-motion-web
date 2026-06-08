import type { SagittalHipRepPhase } from "@/app/lib/cv/sagittal-hip-rep-core";

/**
 * Map lateral-step rep phase to shiftPhase for phase classifier (frontal hip X deviation).
 * Center at baseline = center; max lateral displacement at peak = out.
 */
export function lateralStepShiftPhaseFromRepPhase(
  repPhase: SagittalHipRepPhase,
): "center" | "out" {
  return repPhase === "peak" ? "out" : "center";
}

/** Map to standPhase for shared SitToStandDetectorSnapshot / phase classifier wiring. */
export function lateralStepStandPhaseFromRepPhase(
  repPhase: SagittalHipRepPhase,
): "up" | "down" {
  return repPhase === "peak" ? "down" : "up";
}
