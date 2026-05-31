/**
 * Clinician-only plan session camera labels — derived from existing rows only.
 * No clinical scoring, diagnosis, or movement judgment.
 */

import { parseStoredExercise } from "@/app/lib/exercise-resolve";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { isCvEnabledExercise } from "@/app/lib/cv/cv-patient-config";

const CV_EXERCISE_SHORT_NAME: Record<string, string> = {
  "sit-to-stand": "Sit-to-Stand",
  "mini-squat": "Mini Squat",
};

export function sessionIncludesCvExercise(
  exercises: readonly unknown[] | null | undefined,
): boolean {
  if (!exercises?.length) return false;
  return exercises.some((raw) => {
    const parsed = parseStoredExercise(raw);
    return isCvEnabledExercise(parsed.exerciseId);
  });
}

/** @deprecated Use sessionIncludesCvExercise */
export const sessionIncludesSitToStand = sessionIncludesCvExercise;

/** All CV metrics per plan_session_id, newest first within each session. */
export function indexCvMetricsByPlanSessionId(
  metrics: readonly CvSessionMetricPublic[],
): Map<string, CvSessionMetricPublic[]> {
  const map = new Map<string, CvSessionMetricPublic[]>();
  for (const row of metrics) {
    const planSessionId = row.planSessionId?.trim();
    if (!planSessionId) continue;
    const list = map.get(planSessionId) ?? [];
    list.push(row);
    map.set(planSessionId, list);
  }
  for (const [key, list] of map) {
    list.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    map.set(key, list);
  }
  return map;
}

function formatCameraVisibilityShort(quality: string | null): string {
  const q = (quality ?? "unknown").trim().toLowerCase();
  if (q === "good") return "good";
  if (q === "fair") return "fair";
  if (q === "poor") return "limited";
  return "unknown";
}

function formatCvExerciseShortName(exerciseId: string | null | undefined): string {
  const id = exerciseId?.trim().toLowerCase() ?? "";
  return CV_EXERCISE_SHORT_NAME[id] ?? exerciseId?.trim() ?? "CV exercise";
}

/**
 * Clinician-only line for rehabilitation plan session rows.
 * Returns null when the session has no CV-eligible exercise.
 */
export function deriveClinicianSessionCameraLine(input: {
  planSessionId: string;
  sessionStatus: string;
  exercises: readonly unknown[] | null | undefined;
  cvMetrics?: readonly CvSessionMetricPublic[] | null;
  /** @deprecated Prefer cvMetrics array */
  cvMetric?: CvSessionMetricPublic | null | undefined;
}): string | null {
  if (!sessionIncludesCvExercise(input.exercises)) return null;

  const completed =
    input.sessionStatus === "completed" || input.sessionStatus === "done";

  if (!completed) {
    return "Not completed";
  }

  const metrics =
    input.cvMetrics ??
    (input.cvMetric != null ? [input.cvMetric] : []);

  if (metrics.length === 0) {
    return "Manual completion · camera not saved";
  }

  const repParts = metrics.map((row) => {
    const name = formatCvExerciseShortName(row.exerciseId);
    const reps = row.repCount ?? 0;
    return `${name} reps: ${reps}`;
  });

  const visibility = formatCameraVisibilityShort(metrics[0]?.trackingQuality ?? null);
  return `Camera used · ${repParts.join(" · ")} · visibility: ${visibility}`;
}
