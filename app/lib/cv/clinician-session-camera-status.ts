/**
 * Clinician-only plan session camera labels — derived from existing rows only.
 * No clinical scoring, diagnosis, or movement judgment.
 */

import { parseStoredExercise } from "@/app/lib/exercise-resolve";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { isCvEnabledExercise } from "@/app/lib/cv/cv-patient-config";

export function sessionIncludesSitToStand(
  exercises: readonly unknown[] | null | undefined,
): boolean {
  if (!exercises?.length) return false;
  return exercises.some((raw) => {
    const parsed = parseStoredExercise(raw);
    return isCvEnabledExercise(parsed.exerciseId);
  });
}

/** Latest CV metric per plan_session_id (by recordedAt). */
export function indexCvMetricsByPlanSessionId(
  metrics: readonly CvSessionMetricPublic[],
): Map<string, CvSessionMetricPublic> {
  const map = new Map<string, CvSessionMetricPublic>();
  for (const row of metrics) {
    const planSessionId = row.planSessionId?.trim();
    if (!planSessionId) continue;
    const existing = map.get(planSessionId);
    if (!existing || new Date(row.recordedAt) > new Date(existing.recordedAt)) {
      map.set(planSessionId, row);
    }
  }
  return map;
}

function formatTrackingSignalShort(quality: string | null): string {
  const q = (quality ?? "unknown").trim().toLowerCase();
  if (q === "good" || q === "fair" || q === "poor") return q;
  return "unknown";
}

/**
 * Clinician-only line for rehabilitation plan session rows.
 * Returns null when the session has no sit-to-stand exercise.
 */
export function deriveClinicianSessionCameraLine(input: {
  planSessionId: string;
  sessionStatus: string;
  exercises: readonly unknown[] | null | undefined;
  cvMetric: CvSessionMetricPublic | null | undefined;
}): string | null {
  if (!sessionIncludesSitToStand(input.exercises)) return null;

  const completed =
    input.sessionStatus === "completed" || input.sessionStatus === "done";

  if (!completed) {
    return "Not completed";
  }

  if (input.cvMetric) {
    const reps = input.cvMetric.repCount ?? 0;
    const signal = formatTrackingSignalShort(input.cvMetric.trackingQuality);
    return `Camera used · reps: ${reps} · signal: ${signal}`;
  }

  return "Manual completion · camera not saved";
}
