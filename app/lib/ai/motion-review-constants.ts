export const AI_MOTION_REVIEW_SCHEMA_VERSION = "cmr-1" as const;

export const AI_MOTION_REVIEW_DISCLAIMER =
  "AI-generated observation. Clinician review required.";

export const AI_MOTION_REVIEW_FORBIDDEN_PHRASES = [
  "diagnosis",
  "diagnose",
  "prescribe",
  "treatment recommendation",
  "progress patient",
  "ready to progress",
  "return to sport",
  "clinical score",
  "severity",
  "mild",
  "moderate",
  "severe",
] as const;

export const AI_MOTION_REVIEW_FORBIDDEN_INPUT_KEYS = new Set([
  "timeline",
  "snapshots",
  "landmarks",
  "poseLandmarks",
  "rawLandmarks",
  "video",
  "frame",
  "frames",
  "blob",
  "image",
  "patientName",
  "full_name",
  "phone",
  "email",
  "notes",
  "diagnosis",
  "treatmentPlan",
  "planId",
  "token",
]);

export type ClinicianMotionReviewDraft = {
  schemaVersion: typeof AI_MOTION_REVIEW_SCHEMA_VERSION;
  disclaimer: typeof AI_MOTION_REVIEW_DISCLAIMER;
  trackingObservations: string[];
  completionObservations: string[];
  visibilityObservations: string[];
  interruptionObservations: string[];
  generatedAt: string;
};
