/**
 * Patient-facing movement check summaries — derived from allowlisted CV metrics only.
 * No clinical interpretation, confidence, or biomechanical detail.
 */

import { isHoldClassCvExercise } from "@/app/lib/cv/cv-metrics-display";

export const PATIENT_MOVEMENT_CHECK_EXERCISE_IDS = [
  "functional-reach",
  "single-leg-stance",
] as const;

export type PatientMovementCheckExerciseId =
  (typeof PATIENT_MOVEMENT_CHECK_EXERCISE_IDS)[number];

export type PatientMovementCheckMetricRow = {
  exerciseId: PatientMovementCheckExerciseId;
  recordedAt: string;
  /** Reps for functional-reach; hold seconds for single-leg-stance. */
  value: number;
};

export type PatientMovementCheckExerciseSummary = {
  exerciseId: PatientMovementCheckExerciseId;
  latest: PatientMovementCheckMetricRow | null;
  best: PatientMovementCheckMetricRow | null;
  before: PatientMovementCheckMetricRow | null;
  hasComparison: boolean;
};

export type PatientMovementCheckView = {
  exercises: PatientMovementCheckExerciseSummary[];
  hasAnyResults: boolean;
};

export function isPatientMovementCheckExerciseId(
  value: string,
): value is PatientMovementCheckExerciseId {
  const normalized = value.trim().toLowerCase();
  return (PATIENT_MOVEMENT_CHECK_EXERCISE_IDS as readonly string[]).includes(normalized);
}

export function patientMovementCheckValue(
  exerciseId: string,
  repCount: number | null,
  sessionDurationS: number | null,
): number | null {
  if (!isPatientMovementCheckExerciseId(exerciseId)) return null;
  if (isHoldClassCvExercise(exerciseId)) {
    return sessionDurationS != null && sessionDurationS >= 0 ? sessionDurationS : null;
  }
  return repCount != null && repCount >= 0 ? repCount : null;
}

export function buildPatientMovementCheckView(
  rows: PatientMovementCheckMetricRow[],
): PatientMovementCheckView {
  const byExercise = new Map<PatientMovementCheckExerciseId, PatientMovementCheckMetricRow[]>();

  for (const row of rows) {
    if (!isPatientMovementCheckExerciseId(row.exerciseId)) continue;
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push(row);
    byExercise.set(row.exerciseId, list);
  }

  const exercises: PatientMovementCheckExerciseSummary[] = [];

  for (const exerciseId of PATIENT_MOVEMENT_CHECK_EXERCISE_IDS) {
    const sorted = (byExercise.get(exerciseId) ?? []).slice().sort((a, b) => {
      return new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
    });
    if (sorted.length === 0) {
      exercises.push({
        exerciseId,
        latest: null,
        best: null,
        before: null,
        hasComparison: false,
      });
      continue;
    }

    const latest = sorted[sorted.length - 1] ?? null;
    const before = sorted.length > 1 ? sorted[0] : null;
    const best = sorted.reduce<PatientMovementCheckMetricRow | null>((acc, row) => {
      if (!acc || row.value > acc.value) return row;
      return acc;
    }, null);

    exercises.push({
      exerciseId,
      latest,
      best,
      before,
      hasComparison: before != null && latest != null && before.recordedAt !== latest.recordedAt,
    });
  }

  return {
    exercises,
    hasAnyResults: exercises.some((item) => item.latest != null),
  };
}
