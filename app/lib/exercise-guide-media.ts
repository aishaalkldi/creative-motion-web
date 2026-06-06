/**
 * Static instructional guide images for patient session movement preview.
 * CV tracking is unchanged — guides are display-only fallbacks in ExerciseMediaArea.
 */

export const SIT_TO_STAND_GUIDE_IMAGE_SRC = "/exercises/sit-to-stand-guide.png";

export const SIT_TO_STAND_GUIDE_IMAGE_ALT = "Sit-to-Stand exercise guide";

export const STEP_UP_GUIDE_IMAGE_SRC = "/exercises/step-up-guide.jpeg";

export const STEP_UP_GUIDE_IMAGE_ALT = "Step-Up exercise guide";

export const MINI_SQUAT_GUIDE_IMAGE_SRC = "/exercises/mini-squat-guide.png";

export const MINI_SQUAT_GUIDE_IMAGE_ALT = "Mini Squat exercise guide";

export const SINGLE_LEG_STANCE_GUIDE_IMAGE_SRC = "/exercises/single-leg-stance-guide.png";

export const SINGLE_LEG_STANCE_GUIDE_IMAGE_ALT = "Single Leg Stance exercise guide";

export const HEEL_RAISE_GUIDE_IMAGE_SRC = "/exercises/heel-raise-guide.jpg";

export const HEEL_RAISE_GUIDE_IMAGE_ALT = "Heel Raise exercise guide";

export const LATERAL_STEP_GUIDE_IMAGE_SRC = "/exercises/lateral-step-guide.png";

export const LATERAL_STEP_GUIDE_IMAGE_ALT = "Lateral Step exercise guide";

export const FUNCTIONAL_REACH_GUIDE_IMAGE_SRC = "/exercises/functional-reach-guide.png";

export const FUNCTIONAL_REACH_GUIDE_IMAGE_ALT = "Functional Reach exercise guide";

const PATIENT_EXERCISE_GUIDE_BY_ID: Readonly<Record<string, { src: string; alt: string }>> = {
  "sit-to-stand": {
    src: SIT_TO_STAND_GUIDE_IMAGE_SRC,
    alt: SIT_TO_STAND_GUIDE_IMAGE_ALT,
  },
  "mini-squat": {
    src: MINI_SQUAT_GUIDE_IMAGE_SRC,
    alt: MINI_SQUAT_GUIDE_IMAGE_ALT,
  },
  "single-leg-stance": {
    src: SINGLE_LEG_STANCE_GUIDE_IMAGE_SRC,
    alt: SINGLE_LEG_STANCE_GUIDE_IMAGE_ALT,
  },
  "step-up": {
    src: STEP_UP_GUIDE_IMAGE_SRC,
    alt: STEP_UP_GUIDE_IMAGE_ALT,
  },
  "heel-raise": {
    src: HEEL_RAISE_GUIDE_IMAGE_SRC,
    alt: HEEL_RAISE_GUIDE_IMAGE_ALT,
  },
  "lateral-step": {
    src: LATERAL_STEP_GUIDE_IMAGE_SRC,
    alt: LATERAL_STEP_GUIDE_IMAGE_ALT,
  },
  "functional-reach": {
    src: FUNCTIONAL_REACH_GUIDE_IMAGE_SRC,
    alt: FUNCTIONAL_REACH_GUIDE_IMAGE_ALT,
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
