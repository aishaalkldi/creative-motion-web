/**
 * SMT pilot — safe Motion Evidence Record for motion_quality.smtPilot (STS only).
 * No video, images, landmarks, diagnosis, or treatment advice.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { SitToStandDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";

export const STS_MOTION_PILOT_VERSION = "smt-1" as const;

export type StsMotionPilotRecord = {
  pilotVersion: typeof STS_MOTION_PILOT_VERSION;
  isPilot: true;
  exerciseId: "sit-to-stand";
  snapshotCount: number;
  durationS: number;
  repCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  movementDetected: boolean;
  reviewRequired: true;
  reviewReason: string;
  disclaimer: string;
};

export const STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS = [
  "pilotVersion",
  "isPilot",
  "exerciseId",
  "snapshotCount",
  "durationS",
  "repCount",
  "completeReps",
  "unclearReps",
  "trackingSignal",
  "movementDetected",
  "reviewRequired",
  "reviewReason",
  "disclaimer",
] as const satisfies readonly (keyof StsMotionPilotRecord)[];

export type BuildStsMotionPilotRecordInput = {
  summary: SessionMotionSummary;
  metrics: SitToStandDerivedMetrics;
  snapshotCount: number;
};

function dominantTrackingSignal(
  distribution: SessionMotionSummary["trackingQualityDistribution"],
): CvTrackingQuality | "lost" | "mixed" {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return "unknown";

  entries.sort((a, b) => b[1] - a[1]);
  const topCount = entries[0][1];
  const tied = entries.filter(([, count]) => count === topCount);
  if (tied.length > 1) return "mixed";

  const key = entries[0][0];
  if (key === "lost") return "lost";
  if (key === "good" || key === "fair" || key === "poor" || key === "unknown") {
    return key;
  }
  return "unknown";
}

export function buildStsMotionPilotRecord(
  input: BuildStsMotionPilotRecordInput,
): StsMotionPilotRecord {
  const { summary, metrics, snapshotCount } = input;

  return {
    pilotVersion: STS_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "sit-to-stand",
    snapshotCount: Math.max(0, Math.floor(snapshotCount)),
    durationS: summary.sessionDurationS,
    repCount: summary.legacyRepCount,
    completeReps: summary.completeRepCount,
    unclearReps: summary.unclearRepCount,
    trackingSignal: dominantTrackingSignal(summary.trackingQualityDistribution),
    movementDetected: metrics.movementDetected,
    reviewRequired: true,
    reviewReason: "derived_motion_timeline_pilot",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}

export function findForbiddenKeysInStsPilotRecord(record: StsMotionPilotRecord): string[] {
  return findForbiddenKeysInSummaryPayload(record);
}

/** Payload shape stored on cv_session_metrics.motion_quality */
export type CvMotionQualityPayload = {
  smtPilot?: StsMotionPilotRecord;
  [key: string]: unknown;
};

export function buildMotionQualityWithStsPilot(
  record: StsMotionPilotRecord,
  existing?: CvMotionQualityPayload | null,
): CvMotionQualityPayload {
  return {
    ...(existing ?? {}),
    smtPilot: record,
  };
}
