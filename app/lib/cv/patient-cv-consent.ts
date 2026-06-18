/**
 * PR103 — Patient CV camera consent record (no PHI, no DB table).
 */

import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";

export const PATIENT_CV_CAMERA_CONSENT_VERSION = "cv-camera-1.0" as const;

export const PATIENT_CV_CAMERA_CONSENT_STORAGE_KEY = "rasq_cv_camera_consent_v1";

export type PatientCvCameraConsentSurface = "patient_cv_capture";

export type PatientCvCameraConsentRecord = {
  version: typeof PATIENT_CV_CAMERA_CONSENT_VERSION | string;
  acceptedAtMs: number;
  surface: PatientCvCameraConsentSurface;
};

export function createPatientCvCameraConsentRecord(
  nowMs = Date.now(),
): PatientCvCameraConsentRecord {
  return {
    version: PATIENT_CV_CAMERA_CONSENT_VERSION,
    acceptedAtMs: nowMs,
    surface: "patient_cv_capture",
  };
}

export function readPatientCvCameraConsentFromSession(): PatientCvCameraConsentRecord | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PATIENT_CV_CAMERA_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PatientCvCameraConsentRecord;
    if (!isPatientCvCameraConsentRecord(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePatientCvCameraConsentToSession(
  record: PatientCvCameraConsentRecord,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PATIENT_CV_CAMERA_CONSENT_STORAGE_KEY, JSON.stringify(record));
}

export function isPatientCvCameraConsentRecord(
  value: unknown,
): value is PatientCvCameraConsentRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.version !== "string" || r.version.length === 0) return false;
  if (!Number.isInteger(r.acceptedAtMs) || (r.acceptedAtMs as number) < 0) return false;
  if (r.surface !== "patient_cv_capture") return false;
  const keys = Object.keys(r).sort();
  return keys.join(",") === "acceptedAtMs,surface,version";
}

export function mergeCaptureConsentIntoMotionQuality(
  motionQuality: CvMotionQualityPayload | null | undefined,
  consent: PatientCvCameraConsentRecord | null | undefined,
): CvMotionQualityPayload | undefined {
  if (!consent && !motionQuality) return undefined;
  return {
    ...(motionQuality ?? {}),
    ...(consent ? { captureConsent: consent } : {}),
  };
}
