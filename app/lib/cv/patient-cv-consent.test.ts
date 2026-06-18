/**
 * Run: npx tsx --test app/lib/cv/patient-cv-consent.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPatientCvCameraConsentRecord,
  isPatientCvCameraConsentRecord,
  mergeCaptureConsentIntoMotionQuality,
  PATIENT_CV_CAMERA_CONSENT_VERSION,
} from "@/app/lib/cv/patient-cv-consent";

describe("patient-cv-consent", () => {
  it("creates a versioned consent record", () => {
    const record = createPatientCvCameraConsentRecord(1_700_000_000_000);
    assert.equal(record.version, PATIENT_CV_CAMERA_CONSENT_VERSION);
    assert.equal(record.acceptedAtMs, 1_700_000_000_000);
    assert.equal(record.surface, "patient_cv_capture");
  });

  it("validates consent record shape", () => {
    assert.equal(isPatientCvCameraConsentRecord(createPatientCvCameraConsentRecord()), true);
    assert.equal(isPatientCvCameraConsentRecord({ version: "x", acceptedAtMs: 1 }), false);
    assert.equal(
      isPatientCvCameraConsentRecord({
        version: PATIENT_CV_CAMERA_CONSENT_VERSION,
        acceptedAtMs: 1,
        surface: "other",
      }),
      false,
    );
  });

  it("merges captureConsent into motion_quality payload", () => {
    const consent = createPatientCvCameraConsentRecord(99);
    const merged = mergeCaptureConsentIntoMotionQuality({ smtPilot: undefined }, consent);
    assert.deepEqual(merged?.captureConsent, consent);
  });

  it("returns consent-only motion_quality when pilot payload is absent", () => {
    const consent = createPatientCvCameraConsentRecord(42);
    const merged = mergeCaptureConsentIntoMotionQuality(null, consent);
    assert.deepEqual(merged, { captureConsent: consent });
  });
});
