/**
 * Validate motion_quality JSONB on CV metric POST (pilot smtPilot only).
 */

import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import {
  findForbiddenKeysInStsPilotRecord,
  STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type CvMotionQualityPayload,
  type StsMotionPilotRecord,
} from "@/app/lib/cv/sts-motion-pilot-record";

const TRACKING_SIGNALS = new Set(["good", "fair", "poor", "unknown", "lost", "mixed"]);

function isStsMotionPilotRecord(value: unknown): value is StsMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "smt-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "sit-to-stand") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  return findForbiddenKeysInStsPilotRecord(r as StsMotionPilotRecord).length === 0;
}

/** Returns null when valid; error message when invalid. */
export function validateCvMotionQualityPayload(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return "motion_quality must be an object.";
  }
  if (findForbiddenKeysInSummaryPayload(value).length > 0) {
    return "motion_quality contains forbidden keys.";
  }
  const payload = value as CvMotionQualityPayload;
  if (payload.smtPilot !== undefined && !isStsMotionPilotRecord(payload.smtPilot)) {
    return "motion_quality.smtPilot is invalid.";
  }
  return null;
}
