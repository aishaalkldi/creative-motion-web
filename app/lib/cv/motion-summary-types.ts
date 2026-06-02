/**
 * SMT-1 — Sit-to-Stand session motion summary types (derived metrics only).
 * Timeline snapshots stay in browser memory; summary is produced at session end.
 * No landmarks, video, diagnosis, clinical scores, or treatment advice.
 */

import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";

export const SESSION_MOTION_SUMMARY_SCHEMA = "smt-1" as const;

export type StsMotionSnapshotEvent =
  | "rep_completed"
  | "rep_unclear"
  | "pose_lost"
  | "pose_recovered"
  | "movement_detected";

/** Per-second derived observation (in-memory timeline only). */
export type MotionSnapshot = {
  /** Seconds elapsed since motion sampling started. */
  tSec: number;
  exerciseId: "sit-to-stand";
  posePresent: boolean;
  trackingQuality: CvTrackingQuality | "lost";
  bodyFraming?: BodyFramingProfileId;
  repCount: number;
  movementPhase: "seated" | "rising" | "standing" | "returning" | "rest" | "unknown";
  visibility: {
    hip: number;
    knee: number;
    ankle: number;
  };
  events: StsMotionSnapshotEvent[];
};

/** Assistive rep timing derived from capture FSM or snapshot events — not clinical scoring. */
export type StsRepTimingRecord = {
  repIndex: number;
  completed: boolean;
  durationMs: number | null;
  captureFlags: string[];
};

export type BiomechanicalObservationCategory =
  | "rep_timing"
  | "rep_completion"
  | "tracking_visibility"
  | "session_capture";

/**
 * Deterministic, clinician-review observation — never shown to patients in SMT-1.
 * Labels use assistive / review-oriented language only.
 */
export type BiomechanicalObservation = {
  id: string;
  category: BiomechanicalObservationCategory;
  label: string;
  value?: string | number;
  unit?: string;
  patientVisible: false;
  clinicianReviewRequired: true;
};

/** Rollup produced at end of STS tracking (persist later — not in PR1). */
export type SessionMotionSummary = {
  schemaVersion: typeof SESSION_MOTION_SUMMARY_SCHEMA;
  exerciseId: "sit-to-stand";
  sessionDurationS: number;
  legacyRepCount: number;
  completeRepCount: number;
  unclearRepCount: number;
  trackingQualityDistribution: Record<CvTrackingQuality | "lost", number>;
  visibilityAssist: {
    hipVisiblePct: number;
    kneeVisiblePct: number;
    ankleVisiblePct: number;
  };
  interruptions: {
    poseLossEventCount: number;
    longestPoseLossGapMs: number;
  };
  repDurationSummary: {
    avgDurationS: number | null;
    fastestDurationS: number | null;
    slowestDurationS: number | null;
    completedRepCount: number;
  };
  captureFlags: string[];
  observations: BiomechanicalObservation[];
  capturedAt: string;
  patientVisible: false;
  clinicianReviewRequired: true;
  therapistReviewHint: "derived_motion_summary_only";
};

/** Top-level keys permitted on SessionMotionSummary JSON. */
export const STS_SUMMARY_ALLOWED_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "exerciseId",
  "sessionDurationS",
  "legacyRepCount",
  "completeRepCount",
  "unclearRepCount",
  "trackingQualityDistribution",
  "visibilityAssist",
  "interruptions",
  "repDurationSummary",
  "captureFlags",
  "observations",
  "capturedAt",
  "patientVisible",
  "clinicianReviewRequired",
  "therapistReviewHint",
] as const satisfies readonly (keyof SessionMotionSummary)[];

/** Keys that must never appear on motion summary payloads (privacy + safety). */
export const STS_SUMMARY_FORBIDDEN_KEYS = new Set([
  "video",
  "image",
  "frame",
  "frames",
  "blob",
  "landmarks",
  "landmark",
  "poseLandmarks",
  "rawLandmarks",
  "bodyCoordinates",
  "timeline",
  "snapshots",
  "motionTimeline",
  "motionSnapshots",
  "rawMotion",
  "movementQuality",
  "movementQualityScore",
  "clinicalScore",
  "postureScore",
  "romEstimate",
  "symmetryScore",
  "riskFlag",
  "score",
  "diagnosis",
  "recommendation",
  "progressionAdvice",
  "treatmentRecommendation",
  "severity",
  "patientName",
  "phone",
  "nationalId",
]);

export function findForbiddenKeysInSummaryPayload(
  value: unknown,
  path = "",
): string[] {
  const hits: string[] = [];
  if (value === null || typeof value !== "object") {
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findForbiddenKeysInSummaryPayload(item, `${path}[${index}]`));
    });
    return hits;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const full = path ? `${path}.${key}` : key;
    if (STS_SUMMARY_FORBIDDEN_KEYS.has(key)) {
      hits.push(full);
    }
    hits.push(
      ...findForbiddenKeysInSummaryPayload(
        (value as Record<string, unknown>)[key],
        full,
      ),
    );
  }
  return hits;
}
