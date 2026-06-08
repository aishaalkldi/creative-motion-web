import type { SagittalHipRepPhase } from "@/app/lib/cv/sagittal-hip-rep-core";

/**
 * Map step-up rep phase to standPhase for phase classifier (rise polarity on hip Y).
 * Standing at baseline = up; top step position at peak = down.
 */
export function stepUpStandPhaseFromRepPhase(
  repPhase: SagittalHipRepPhase,
): "up" | "down" {
  return repPhase === "peak" ? "down" : "up";
}
