/**
 * Run: npx tsx --test app/lib/cv/capture-quality.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessCaptureQualityFromLandmarks,
  assessCaptureQualityFromSession,
  buildCaptureQualityLandmarkFixture,
  findForbiddenTermsInCaptureWarnings,
  FORBIDDEN_CAPTURE_WARNING_TERMS,
} from "./capture-quality";
import { PATIENT_POSE_ANKLE_INDICES, PATIENT_POSE_KNEE_INDICES } from "./pose-landmark-overlay";

describe("assessCaptureQualityFromLandmarks", () => {
  it("returns high quality when required landmarks are visible and confidence is high", () => {
    const result = assessCaptureQualityFromLandmarks({
      landmarks: buildCaptureQualityLandmarkFixture(0.85),
      bodyFramingState: "good_distance",
      trackingStatus: "pose-found",
    });

    assert.equal(result.qualityLevel, "high");
    assert.equal(result.bodyVisibility, "good");
    assert.equal(result.trackingConfidence, "high");
    assert.equal(result.retestRecommended, false);
    assert.equal(result.warnings.length, 0);
  });

  it("returns medium quality when some landmarks are lower confidence but enough data exists", () => {
    const landmarks = buildCaptureQualityLandmarkFixture(0.45);
    const result = assessCaptureQualityFromLandmarks({
      landmarks,
      bodyFramingState: "good_distance",
      trackingStatus: "pose-found",
    });

    assert.equal(result.qualityLevel, "medium");
    assert.equal(result.trackingConfidence, "medium");
    assert.equal(result.retestRecommended, false);
  });

  it("returns low quality when key landmarks are missing", () => {
    const landmarks = buildCaptureQualityLandmarkFixture(0.85);
    for (const idx of PATIENT_POSE_KNEE_INDICES) {
      landmarks[idx] = { x: 0.5, y: 0.5, visibility: 0.05 };
    }
    for (const idx of PATIENT_POSE_ANKLE_INDICES) {
      landmarks[idx] = { x: 0.5, y: 0.5, visibility: 0.05 };
    }

    const result = assessCaptureQualityFromLandmarks({
      landmarks,
      trackingStatus: "pose-found",
    });

    assert.equal(result.qualityLevel, "low");
    assert.equal(result.retestRecommended, true);
    assert.ok(result.warnings.includes("Key lower-limb landmarks are missing"));
    assert.ok(result.warnings.includes("Retest recommended before therapist review"));
  });

  it("sets retestRecommended true for low quality", () => {
    const result = assessCaptureQualityFromLandmarks({
      landmarks: buildCaptureQualityLandmarkFixture(0.1),
      trackingStatus: "pose-lost",
    });

    assert.equal(result.qualityLevel, "low");
    assert.equal(result.retestRecommended, true);
  });

  it("generates warnings for missing lower-limb landmarks", () => {
    const landmarks = buildCaptureQualityLandmarkFixture(0.8);
    for (const idx of PATIENT_POSE_ANKLE_INDICES) {
      landmarks[idx] = { x: 0.5, y: 0.5, visibility: 0 };
    }

    const result = assessCaptureQualityFromLandmarks({ landmarks });
    assert.ok(result.warnings.includes("Key lower-limb landmarks are missing"));
  });

  it("uses no diagnostic wording in warnings", () => {
    const cases = [
      assessCaptureQualityFromLandmarks({
        landmarks: buildCaptureQualityLandmarkFixture(0.1),
        bodyFramingState: "low_visibility",
        trackingStatus: "pose-lost",
      }),
      assessCaptureQualityFromSession({
        visibilityRatios: { hip: 10, knee: 5, ankle: 0 },
        trackingSignal: "lost",
        poseLossEventCount: 5,
      }),
    ];

    for (const result of cases) {
      assert.deepEqual(findForbiddenTermsInCaptureWarnings(result.warnings), []);
      for (const term of FORBIDDEN_CAPTURE_WARNING_TERMS) {
        for (const warning of result.warnings) {
          assert.equal(warning.toLowerCase().includes(term), false, `found "${term}" in "${warning}"`);
        }
      }
    }
  });
});

describe("assessCaptureQualityFromSession", () => {
  it("returns high quality for strong visibility ratios and good tracking", () => {
    const result = assessCaptureQualityFromSession({
      visibilityRatios: { hip: 85, knee: 82, ankle: 78 },
      trackingSignal: "good",
    });

    assert.equal(result.qualityLevel, "high");
    assert.equal(result.retestRecommended, false);
  });

  it("returns medium for fair session visibility", () => {
    const result = assessCaptureQualityFromSession({
      visibilityRatios: { hip: 55, knee: 50, ankle: 48 },
      trackingSignal: "fair",
    });

    assert.equal(result.qualityLevel, "medium");
  });
});
