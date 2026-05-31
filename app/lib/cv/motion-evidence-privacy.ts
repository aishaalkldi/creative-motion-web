/**
 * Privacy validation for motion evidence API payloads.
 * Rejects timeline, snapshots, landmarks, video, and related keys.
 */

export const MOTION_EVIDENCE_FORBIDDEN_KEYS = new Set([
  "timeline",
  "snapshots",
  "motionTimeline",
  "motionSnapshots",
  "landmarks",
  "landmark",
  "poseLandmarks",
  "rawLandmarks",
  "video",
  "frame",
  "frames",
  "blob",
  "image",
  "images",
  "audio",
  "face",
  "faceMesh",
  "bodyCoordinates",
  "rawMotion",
  "motionTrace",
]);

export function findForbiddenMotionEvidenceKey(
  value: unknown,
  path = "",
): string | null {
  if (value === null || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findForbiddenMotionEvidenceKey(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (MOTION_EVIDENCE_FORBIDDEN_KEYS.has(key)) {
      return path ? `${path}.${key}` : key;
    }
    const nested = findForbiddenMotionEvidenceKey(
      (value as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key,
    );
    if (nested) return nested;
  }
  return null;
}

export function validateSessionMotionEvidenceSummary(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj.schemaVersion !== "sms-1") return false;
  if (obj.exerciseId !== "sit-to-stand") return false;
  if (findForbiddenMotionEvidenceKey(obj)) return false;
  return true;
}
