/**
 * Shared forbidden payload keys for CV metric APIs (clinician + future patient).
 * Derived metrics only — no media, landmarks, clinical interpretation, or PHI.
 */

export const CV_FORBIDDEN_BODY_KEYS = new Set([
  "video",
  "image",
  "frame",
  "frames",
  "blob",
  "landmarks",
  "poseLandmarks",
  "rawLandmarks",
  "bodyCoordinates",
  "audio",
  "movementQuality",
  "romEstimate",
  "symmetryScore",
  "riskFlag",
  "score",
  "diagnosis",
  "recommendation",
  "patientName",
  "phone",
  "nationalId",
  "patientId",
  "providerId",
  "planId",
]);

export function bodyHasForbiddenCvKeys(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (CV_FORBIDDEN_BODY_KEYS.has(key)) {
      return key;
    }
  }
  return null;
}
