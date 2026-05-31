import {
  AI_MOTION_REVIEW_DISCLAIMER,
  AI_MOTION_REVIEW_FORBIDDEN_PHRASES,
  AI_MOTION_REVIEW_SCHEMA_VERSION,
  type ClinicianMotionReviewDraft,
} from "@/app/lib/ai/motion-review-constants";

export function buildSafeFallbackMotionReview(): ClinicianMotionReviewDraft {
  return {
    schemaVersion: AI_MOTION_REVIEW_SCHEMA_VERSION,
    disclaimer: AI_MOTION_REVIEW_DISCLAIMER,
    trackingObservations: ["Motion evidence summary was available for review."],
    completionObservations: [],
    visibilityObservations: [],
    interruptionObservations: [],
    generatedAt: new Date().toISOString(),
  };
}

export function validateMotionReviewDraft(raw: unknown): ClinicianMotionReviewDraft | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const sections = [
    obj.trackingObservations,
    obj.completionObservations,
    obj.visibilityObservations,
    obj.interruptionObservations,
  ];
  if (!sections.every((s) => Array.isArray(s) && s.every((x) => typeof x === "string"))) {
    return null;
  }

  const allText = [
    ...((obj.trackingObservations as string[]) ?? []),
    ...((obj.completionObservations as string[]) ?? []),
    ...((obj.visibilityObservations as string[]) ?? []),
    ...((obj.interruptionObservations as string[]) ?? []),
    typeof obj.disclaimer === "string" ? obj.disclaimer : "",
  ]
    .join(" ")
    .toLowerCase();

  for (const phrase of AI_MOTION_REVIEW_FORBIDDEN_PHRASES) {
    if (allText.includes(phrase.toLowerCase())) return null;
  }

  if (!allText.includes(AI_MOTION_REVIEW_DISCLAIMER.toLowerCase())) return null;

  return {
    schemaVersion: AI_MOTION_REVIEW_SCHEMA_VERSION,
    disclaimer: AI_MOTION_REVIEW_DISCLAIMER,
    trackingObservations: obj.trackingObservations as string[],
    completionObservations: obj.completionObservations as string[],
    visibilityObservations: obj.visibilityObservations as string[],
    interruptionObservations: obj.interruptionObservations as string[],
    generatedAt: new Date().toISOString(),
  };
}
