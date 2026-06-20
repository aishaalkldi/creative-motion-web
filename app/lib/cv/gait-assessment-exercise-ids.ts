/**
 * Gait Assessment Center — exercise IDs for clinician review filtering.
 * No capture implementation yet; IDs reserved for future assessment_movement saves.
 */

/** Primary ID from GAIT_ASSESSMENT_V1_CAPTURE_AUDIT (PR109). */
export const GAIT_WALKING_OBSERVATION_EXERCISE_ID = "gait-walking-observation" as const;

export const GAIT_ASSESSMENT_EXERCISE_IDS = [GAIT_WALKING_OBSERVATION_EXERCISE_ID] as const;

export type GaitAssessmentExerciseId = (typeof GAIT_ASSESSMENT_EXERCISE_IDS)[number];

const GAIT_ASSESSMENT_ID_SET = new Set<string>(GAIT_ASSESSMENT_EXERCISE_IDS);

/** True when a cv_session_metrics row belongs to the Gait Assessment review surface. */
export function isGaitAssessmentExerciseId(exerciseId: string | undefined | null): boolean {
  if (!exerciseId?.trim()) return false;
  const normalized = exerciseId.trim().toLowerCase();
  if (GAIT_ASSESSMENT_ID_SET.has(normalized)) return true;
  return normalized.startsWith("gait-walking-");
}

export const GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  [GAIT_WALKING_OBSERVATION_EXERCISE_ID]: "Walking observation",
};
