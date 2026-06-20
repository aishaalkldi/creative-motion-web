/**
 * Extract technical capture quality records from cv_session_metrics.motion_quality.
 * Technical QC only — not movement quality or clinical assessment.
 */

import { parseCaptureQuality, type CaptureQualityResult } from "@/app/lib/cv/capture-quality";

export type CaptureQualityHistoryEntry = {
  cvMetricId: string;
  recordedAt: string;
  exerciseId: string;
  qualityLevel: CaptureQualityResult["qualityLevel"];
  retestRecommended: boolean;
};

function readPilotCaptureQuality(
  motionQuality: Record<string, unknown> | null | undefined,
  pilotKey: string,
): CaptureQualityResult | null {
  if (!motionQuality || typeof motionQuality !== "object") return null;
  const pilot = motionQuality[pilotKey];
  if (!pilot || typeof pilot !== "object") return null;
  const record = pilot as Record<string, unknown>;
  return parseCaptureQuality(record.captureQuality);
}

export function extractCaptureQualityFromMotionQuality(
  cvMetricId: string,
  recordedAt: string,
  exerciseId: string,
  motionQuality: Record<string, unknown> | null | undefined,
): CaptureQualityHistoryEntry | null {
  const pilotsToCheck = ["smtPilot", "hrPilot", "msPilot", "suPilot", "lsPilot", "frPilot"];
  for (const key of pilotsToCheck) {
    const quality = readPilotCaptureQuality(motionQuality, key);
    if (quality) {
      return {
        cvMetricId,
        recordedAt,
        exerciseId,
        qualityLevel: quality.qualityLevel,
        retestRecommended: quality.retestRecommended,
      };
    }
  }
  return null;
}

export function buildCaptureQualityHistory(
  rows: Array<{
    id: string;
    recorded_at: string;
    exercise_id: string;
    motion_quality: Record<string, unknown> | null;
  }>,
): CaptureQualityHistoryEntry[] {
  const entries: CaptureQualityHistoryEntry[] = [];
  for (const row of rows) {
    const entry = extractCaptureQualityFromMotionQuality(
      row.id,
      row.recorded_at,
      row.exercise_id,
      row.motion_quality,
    );
    if (entry) entries.push(entry);
  }
  return entries.sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}
