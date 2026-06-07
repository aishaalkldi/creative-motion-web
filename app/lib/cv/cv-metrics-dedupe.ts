/**
 * Clinician list helpers — collapse duplicate patient portal captures for the same plan session.
 */

import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";

export function patientCvMetricDedupeKey(row: CvSessionMetricPublic): string | null {
  if (row.source !== "patient_session" || !row.planSessionId) return null;
  return `${row.planSessionId}:${row.exerciseId}`;
}

/** Keep the newest row per plan_session_id + exercise_id for patient_session source. */
export function dedupeCvMetricsByPlanSessionExercise(
  metrics: readonly CvSessionMetricPublic[],
): CvSessionMetricPublic[] {
  const bestByKey = new Map<string, CvSessionMetricPublic>();
  const passthrough: CvSessionMetricPublic[] = [];

  for (const row of metrics) {
    const key = patientCvMetricDedupeKey(row);
    if (!key) {
      passthrough.push(row);
      continue;
    }
    const existing = bestByKey.get(key);
    if (!existing || new Date(row.recordedAt).getTime() > new Date(existing.recordedAt).getTime()) {
      bestByKey.set(key, row);
    }
  }

  return [...passthrough, ...bestByKey.values()];
}
