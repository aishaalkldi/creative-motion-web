/**
 * Static instructional guide images for patient session movement preview.
 * CV tracking is unchanged — guides are display-only fallbacks in ExerciseMediaArea.
 */

export const SIT_TO_STAND_GUIDE_IMAGE_SRC = "/exercises/sit-to-stand-guide.png";

export const SIT_TO_STAND_GUIDE_IMAGE_ALT = "Sit-to-Stand exercise guide";

export const STEP_UP_GUIDE_IMAGE_SRC = "/exercises/step-up-guide.jpeg";

export const STEP_UP_GUIDE_IMAGE_ALT = "Step-Up exercise guide";

const PATIENT_EXERCISE_GUIDE_BY_ID: Readonly<Record<string, { src: string; alt: string }>> = {
  "sit-to-stand": {
    src: SIT_TO_STAND_GUIDE_IMAGE_SRC,
    alt: SIT_TO_STAND_GUIDE_IMAGE_ALT,
  },
  "step-up": {
    src: STEP_UP_GUIDE_IMAGE_SRC,
    alt: STEP_UP_GUIDE_IMAGE_ALT,
  },
};

export type PatientExerciseGuideImage = {
  src: string;
  alt: string;
};

export function patientExerciseGuideImage(
  exerciseId: string | undefined,
): PatientExerciseGuideImage | null {
  if (!exerciseId?.trim()) return null;
  return PATIENT_EXERCISE_GUIDE_BY_ID[exerciseId.trim().toLowerCase()] ?? null;
}
