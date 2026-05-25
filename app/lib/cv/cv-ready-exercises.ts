/**
 * Sprint R — CV-ready exercises from static library metadata.
 * No API calls. No Supabase. Read-only registry.
 */

import { EXERCISE_LIBRARY_V1 } from "@/app/lib/exercise-library-v1";

export type CvReadyExercise = {
  exerciseId: string;
  nameEn: string;
  nameAr?: string;
  cvTarget: string;
  bodyRegion: string;
};

export function getCvReadyExercises(): CvReadyExercise[] {
  return EXERCISE_LIBRARY_V1.filter(
    (entry) =>
      typeof entry.futureCvMeasurementTarget === "string" &&
      entry.futureCvMeasurementTarget.trim().length > 0,
  )
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      nameEn: entry.nameEn,
      nameAr: entry.nameAr,
      cvTarget: entry.futureCvMeasurementTarget!.trim(),
      bodyRegion: entry.bodyRegion,
    }))
    .sort((a, b) => a.bodyRegion.localeCompare(b.bodyRegion) || a.nameEn.localeCompare(b.nameEn));
}
