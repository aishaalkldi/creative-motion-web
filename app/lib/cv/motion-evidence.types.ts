/**
 * Phase 1 — Session Motion Evidence (sms-1).
 * Derived observations only — no landmarks, video, or clinical interpretation.
 */

export const SESSION_MOTION_EVIDENCE_SCHEMA = "sms-1" as const;

export type MotionTrackingQuality = "good" | "fair" | "poor" | "lost";

export type MotionPhase = "rest" | "transition" | "peak";

export type MotionSnapshotEvent =
  | "rep_completed"
  | "rep_unclear"
  | "pose_lost"
  | "pose_recovered"
  | "movement_detected";

export type MotionSnapshot = {
  t: number;
  posePresent: boolean;
  trackingQuality: MotionTrackingQuality;
  repCountConfirmed: number;
  visibility: {
    hip: number;
    knee: number;
    ankle: number;
  };
  movement: {
    phase: MotionPhase;
  };
  events: MotionSnapshotEvent[];
};

export type SessionMotionEvidenceSummary = {
  schemaVersion: typeof SESSION_MOTION_EVIDENCE_SCHEMA;
  exerciseId: "sit-to-stand";
  durationS: number;
  repsDetected: number;
  completeReps: number;
  unclearReps: number;
  trackingDistribution: {
    good: number;
    fair: number;
    poor: number;
    lost: number;
  };
  visibility: {
    hipPct: number;
    kneePct: number;
    anklePct: number;
  };
  interruptions: {
    poseLossCount: number;
    longestGapMs: number;
  };
  tempoProfile: {
    avgRepDurationS: number | null;
    fastestRepS: number | null;
    slowestRepS: number | null;
  };
  movementFlags: string[];
  capturedAt: string;
  therapistReviewHint: "motion_evidence_only";
};

export type RepTimingEvent = {
  repIndex: number;
  completed: boolean;
  durationMs: number | null;
  flags: string[];
};
