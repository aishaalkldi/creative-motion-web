/**
 * Motion-pilot feature flags — isolated from cv-patient-config to avoid
 * bio-0-contracts ↔ cv-patient-config circular imports at module init.
 */

export const PATIENT_HEEL_RAISE_MOTION_PILOT_ENABLED = true;
export const PATIENT_STEP_UP_MOTION_PILOT_ENABLED = true;
export const PATIENT_LATERAL_STEP_MOTION_PILOT_ENABLED = true;

export function isCvMotionPilotWiredForCopy(exerciseId: string): boolean {
  switch (exerciseId) {
    case "heel-raise":
      return PATIENT_HEEL_RAISE_MOTION_PILOT_ENABLED;
    case "step-up":
      return PATIENT_STEP_UP_MOTION_PILOT_ENABLED;
    case "lateral-step":
      return PATIENT_LATERAL_STEP_MOTION_PILOT_ENABLED;
    default:
      return false;
  }
}
