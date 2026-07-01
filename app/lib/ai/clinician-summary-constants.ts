export const AI_CLINICIAN_SUMMARY_SCHEMA_VERSION = "ai-clinician-summary-v2" as const;

export type AiClinicianSummaryV2Sections = {
  overview: string;
  sessionActivity: string;
  patientReportedResponse: string;
  cvObservations: string;
  therapistReviewNote: string;
};

export const AI_CLINICIAN_SUMMARY_V2_SECTION_KEYS = [
  "overview",
  "sessionActivity",
  "patientReportedResponse",
  "cvObservations",
  "therapistReviewNote",
] as const satisfies readonly (keyof AiClinicianSummaryV2Sections)[];

export const AI_CLINICIAN_SUMMARY_V2_SECTION_LABELS: Record<
  keyof AiClinicianSummaryV2Sections,
  string
> = {
  overview: "Overview",
  sessionActivity: "Session activity",
  patientReportedResponse: "Patient-reported response",
  cvObservations: "Camera-assisted observations",
  therapistReviewNote: "Therapist review note",
};

export const AI_CLINICIAN_SUMMARY_DISCLAIMER =
  "AI draft — clinician review required. This summary is generated from structured session data and does not replace clinical judgment. No diagnosis, scoring, or treatment recommendation is generated.";

export const AI_CLINICIAN_SUMMARY_REQUIRED_CLOSING =
  "No automatic plan changes are suggested. Therapist review required.";

/** Substrings that invalidate AI output — case-insensitive match. */
export const AI_CLINICIAN_SUMMARY_FORBIDDEN_PHRASES = [
  "diagnosis",
  "diagnose",
  "prescribe",
  "increase exercises",
  "decrease exercises",
  "progress patient",
  "ready to progress",
  "clinical score",
  "bad form",
  "wrong movement",
  "treatment recommendation",
] as const;

/** Keys that must never appear in LLM payload (structured data only). */
export const AI_CLINICIAN_SUMMARY_FORBIDDEN_PAYLOAD_KEYS = new Set([
  "video",
  "image",
  "images",
  "frame",
  "frames",
  "blob",
  "landmarks",
  "poseLandmarks",
  "rawLandmarks",
  "bodyCoordinates",
  "hipY",
  "hip_y",
  "motionTrace",
  "motionTraces",
  "rawMotion",
  "patientName",
  "full_name",
  "phone",
  "email",
  "nationalId",
  "patientToken",
  "token",
]);

export const AI_CLINICIAN_SUMMARY_MAX_NOTE_CHARS = 200;
export const AI_CLINICIAN_SUMMARY_MAX_RECENT_LOGS = 10;
export const AI_CLINICIAN_SUMMARY_MAX_CV_SESSIONS = 5;
