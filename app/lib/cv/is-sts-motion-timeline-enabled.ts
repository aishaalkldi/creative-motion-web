/**
 * SMT-1 — gate in-memory STS motion timeline (off unless explicitly enabled on patient STS config).
 */

import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";

export function isStsMotionTimelineEnabled(exerciseId: CvY1ExerciseId): boolean {
  return (
    exerciseId === "sit-to-stand" && PATIENT_STS_CONFIG.motionTimelineEnabled === true
  );
}
