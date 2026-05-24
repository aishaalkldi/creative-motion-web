/** Validation for patient remote-assessment structuredData payloads. */

export const REMOTE_ASSESSMENT_MAX_JSON_BYTES = 512 * 1024;
export const REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS = 32;
export const REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS = 400;
export const REMOTE_ASSESSMENT_MAX_STRING_LENGTH = 8000;
export const REMOTE_ASSESSMENT_MAX_DEPTH = 8;

export type RemoteAssessmentValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function countFields(value: unknown, depth: number): number {
  if (depth > REMOTE_ASSESSMENT_MAX_DEPTH) return REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS + 1;
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countFields(item, depth + 1), 0);
  }
  const obj = value as Record<string, unknown>;
  let count = Object.keys(obj).length;
  for (const v of Object.values(obj)) {
    count += countFields(v, depth + 1);
  }
  return count;
}

function stringsWithinLimit(value: unknown, depth: number): boolean {
  if (depth > REMOTE_ASSESSMENT_MAX_DEPTH) return false;
  if (typeof value === "string") {
    return value.length <= REMOTE_ASSESSMENT_MAX_STRING_LENGTH;
  }
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) {
    return value.every((item) => stringsWithinLimit(item, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).every((v) =>
    stringsWithinLimit(v, depth + 1),
  );
}

/**
 * Validate structuredData from remote assessment submit.
 * Accepts nested section objects (Arabic/English text fields).
 */
export function validateRemoteAssessmentStructuredData(
  value: unknown,
): RemoteAssessmentValidationResult {
  if (!isPlainObject(value)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const topKeys = Object.keys(value);
  if (topKeys.length === 0) {
    return { ok: false, error: "Invalid assessment data." };
  }
  if (topKeys.length > REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS) {
    return { ok: false, error: "Assessment data exceeds allowed size." };
  }

  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, error: "Invalid assessment data." };
  }

  if (serialized.length > REMOTE_ASSESSMENT_MAX_JSON_BYTES) {
    return { ok: false, error: "Assessment data exceeds allowed size." };
  }

  if (countFields(value, 0) > REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS) {
    return { ok: false, error: "Assessment data exceeds allowed size." };
  }

  if (!stringsWithinLimit(value, 0)) {
    return { ok: false, error: "Assessment data exceeds allowed size." };
  }

  return { ok: true, data: value };
}

/** Reject oversized raw request bodies before JSON parse. */
export function isRemoteAssessmentBodyTooLarge(contentLength: string | null): boolean {
  if (!contentLength) return false;
  const n = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(n) || n < 0) return false;
  return n > REMOTE_ASSESSMENT_MAX_JSON_BYTES;
}
