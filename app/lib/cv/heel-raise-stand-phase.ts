import type { SagittalHipRepPhase } from "@/app/lib/cv/sagittal-hip-rep-core";

/**
 * Map heel-raise rep phase to standPhase for phase classifier (rise polarity on ankle Y).
 * Heels down at baseline = up; heels up at peak = down.
 */
export function heelRaiseStandPhaseFromRepPhase(
  repPhase: SagittalHipRepPhase,
): "up" | "down" {
  return repPhase === "peak" ? "down" : "up";
}
