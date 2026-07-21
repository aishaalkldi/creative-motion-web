import { isExerciseCvRegistered } from "@/app/lib/cv/exercise-cv-registry";

/** Library exercise id mapped to the shoulder CV registry entry. */
export const INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID = "upper-limb-reaching-seated";

export const INTERACTIVE_SHOULDER_CV_EXERCISE_ID = "shoulder-abduction-reach";

const INTERACTIVE_SHOULDER_WIRED_IDS = new Set([
  INTERACTIVE_SHOULDER_CV_EXERCISE_ID,
  INTERACTIVE_SHOULDER_LIBRARY_EXERCISE_ID,
]);

export function isInteractiveShoulderSessionWired(
  exerciseId: string | undefined | null,
): boolean {
  if (!exerciseId?.trim()) return false;
  const normalized = exerciseId.trim().toLowerCase();
  if (!INTERACTIVE_SHOULDER_WIRED_IDS.has(normalized)) return false;
  return isExerciseCvRegistered(INTERACTIVE_SHOULDER_CV_EXERCISE_ID);
}

export function resolveInteractiveShoulderCvExerciseId(
  exerciseId: string | undefined | null,
): string | null {
  if (!isInteractiveShoulderSessionWired(exerciseId)) return null;
  return INTERACTIVE_SHOULDER_CV_EXERCISE_ID;
}
