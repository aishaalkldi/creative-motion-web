/**
 * Patient CV save eligibility — separates wall-clock (rep exercises) from hold accumulation (SLS).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { CV_MIN_SAVE_DURATION_S, PATIENT_SLS_HOLD_CONFIG } from "@/app/lib/cv/cv-patient-config";
import { isHoldClassCvExercise } from "@/app/lib/cv/cv-metrics-display";

/** True when derived metrics meet exercise-specific save thresholds before POST. */
export function isCvMetricsEligibleForSave(metrics: PatientCvDerivedMetrics): boolean {
  if (isHoldClassCvExercise(metrics.exerciseId)) {
    return (
      metrics.movementDetected === true ||
      metrics.sessionDurationS >= PATIENT_SLS_HOLD_CONFIG.minSaveHoldS
    );
  }
  return metrics.sessionDurationS >= CV_MIN_SAVE_DURATION_S;
}
