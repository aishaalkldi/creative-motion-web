/**
 * Structured exercise prescription stored in plan_sessions.exercises jsonb.
 * Backward compatible with legacy string[] entries.
 */

export type PrescribedExerciseV1 = {
  exerciseId: string;
  name: string;
  sets?: number;
  reps?: number | string;
  durationSec?: number;
  restSec?: number;
  clinicianNote?: string;
};

/** Raw value as stored in jsonb — string legacy or structured object. */
export type StoredExercise = string | PrescribedExerciseV1;

export function isPrescribedExerciseV1(value: unknown): value is PrescribedExerciseV1 {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.exerciseId === "string" && typeof obj.name === "string";
}

export function getExerciseDisplayName(exercise: StoredExercise): string {
  if (typeof exercise === "string") return exercise;
  return exercise.name;
}

export function formatDoseLabel(p: Pick<
  PrescribedExerciseV1,
  "sets" | "reps" | "durationSec" | "restSec"
>): string | null {
  const parts: string[] = [];
  if (p.sets != null && p.reps != null) {
    parts.push(`${p.sets} sets × ${p.reps} reps`);
  } else if (p.sets != null && p.durationSec != null) {
    parts.push(`${p.sets} sets × ${p.durationSec}s`);
  } else if (p.reps != null) {
    parts.push(`${p.reps} reps`);
  } else if (p.durationSec != null) {
    parts.push(`${p.durationSec}s`);
  }
  if (p.restSec != null && p.restSec > 0) {
    parts.push(`rest ${p.restSec}s`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
