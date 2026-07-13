/**
 * Run: npx tsx --test app/lib/cv/sts-shadow-comparison.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  compareStsShadowFrame,
  DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS,
} from "@/app/lib/cv/sts-shadow-comparison";

const context = { frameIndex: 0, capturedAtMs: 0 };

/** 33-point BlazePose array, in-range, both hips well-tracked by default. */
function fullSyntheticLandmarks(overrides: Partial<Record<number, PoseLandmark>> = {}): PoseLandmark[] {
  const landmarks: PoseLandmark[] = [];
  for (let index = 0; index < 33; index += 1) {
    landmarks.push(overrides[index] ?? { x: 0.5, y: 0.5, visibility: 0.9 });
  }
  return landmarks;
}

describe("compareStsShadowFrame — agreement cases", () => {
  it("agrees on good tracking quality with well-tracked hips", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: 0.45, y: 0.55, visibility: 0.9 },
      24: { x: 0.55, y: 0.55, visibility: 0.9 },
    });

    const result = compareStsShadowFrame(landmarks, context);

    assert.equal(result.legacy.trackingQuality, "good");
    assert.equal(result.next.trackingQuality, "good");
    assert.equal(result.next.frameContractValid, true);
    assert.equal(result.divergent, false);
    assert.deepEqual(result.divergenceReasons, []);
  });

  it("agrees on poor tracking quality with low hip visibility", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: 0.45, y: 0.55, visibility: 0.1 },
      24: { x: 0.55, y: 0.55, visibility: 0.1 },
    });

    const result = compareStsShadowFrame(landmarks, context);

    assert.equal(result.legacy.trackingQuality, "poor");
    assert.equal(result.next.trackingQuality, "poor");
    assert.equal(result.divergent, false);
  });

  it("reports a zero hip visibility sum delta when both paths see identical hip data", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: 0.45, y: 0.55, visibility: 0.7 },
      24: { x: 0.55, y: 0.55, visibility: 0.6 },
    });

    const result = compareStsShadowFrame(landmarks, context);

    assert.ok(Math.abs(result.legacy.hipVisibilitySum - 1.3) < 1e-9);
    assert.ok(Math.abs(result.next.hipVisibilitySum - 1.3) < 1e-9);
    assert.equal(result.hipVisibilitySumDelta, 0);
  });
});

describe("compareStsShadowFrame — divergence cases", () => {
  it("flags a hip visibility sum delta when raw visibility exceeds [0,1] (clamping divergence)", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: 0.45, y: 0.55, visibility: 1.3 },
      24: { x: 0.55, y: 0.55, visibility: 0.9 },
    });

    const result = compareStsShadowFrame(landmarks, context);

    assert.equal(result.legacy.hipVisibilitySum, 2.2);
    assert.equal(result.next.hipVisibilitySum, 1.9);
    assert.ok(Math.abs(result.hipVisibilitySumDelta - -0.3) < 1e-9);
    assert.equal(result.divergent, true);
    assert.ok(result.divergenceReasons.includes("hip_visibility_sum_delta_exceeds_tolerance"));
  });

  it("flags a missing new-frame hip joint when a hip landmark is off-screen (out of [0,1])", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: -0.05, y: 0.55, visibility: 0.9 },
      24: { x: 0.55, y: 0.55, visibility: 0.9 },
    });

    const result = compareStsShadowFrame(landmarks, context);

    assert.equal(result.legacy.hipVisibilitySum, 1.8);
    assert.equal(result.next.leftHipPresent, false);
    assert.equal(result.next.rightHipPresent, true);
    assert.equal(result.divergent, true);
    assert.ok(result.divergenceReasons.includes("new_frame_missing_hip_joint"));
  });

  it("flags a tracking quality mismatch when off-screen hips push the new path to a lower tier", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: -0.05, y: 0.55, visibility: 0.9 },
      24: { x: 1.2, y: 0.55, visibility: 0.9 },
    });

    const result = compareStsShadowFrame(landmarks, context);

    assert.equal(result.legacy.trackingQuality, "good");
    assert.equal(result.next.hipVisibilitySum, 0);
    assert.equal(result.next.trackingQuality, "poor");
    assert.ok(result.divergenceReasons.includes("tracking_quality_mismatch"));
    assert.ok(result.divergenceReasons.includes("new_frame_missing_hip_joint"));
  });

  it("flags an invalid new frame contract when every landmark is off-screen", () => {
    const landmarks = fullSyntheticLandmarks();
    for (let index = 0; index < landmarks.length; index += 1) {
      landmarks[index] = { x: -1, y: -1, visibility: 0.9 };
    }
    landmarks[23] = { x: -1, y: -1, visibility: 0.9 };
    landmarks[24] = { x: -1, y: -1, visibility: 0.9 };

    const result = compareStsShadowFrame(landmarks, context);

    assert.equal(result.legacy.hipVisibilitySum, 1.8);
    assert.equal(result.next.frameContractValid, false);
    assert.equal(result.divergent, true);
    assert.ok(result.divergenceReasons.includes("new_frame_contract_invalid"));
    assert.ok(result.divergenceReasons.includes("new_frame_missing_hip_joint"));
  });
});

describe("compareStsShadowFrame — context and threshold passthrough", () => {
  it("passes frameIndex and capturedAtMs through into the comparison", () => {
    const result = compareStsShadowFrame(fullSyntheticLandmarks(), { frameIndex: 42, capturedAtMs: 9_000 });
    assert.equal(result.frameIndex, 42);
    assert.equal(result.capturedAtMs, 9_000);
  });

  it("uses the same default thresholds as the live detector config", () => {
    assert.equal(DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS.visibilityGood, 1.4);
    assert.equal(DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS.visibilityFair, 0.8);
  });

  it("honors custom thresholds passed by the caller", () => {
    const landmarks = fullSyntheticLandmarks({
      23: { x: 0.45, y: 0.55, visibility: 0.5 },
      24: { x: 0.55, y: 0.55, visibility: 0.5 },
    });

    const result = compareStsShadowFrame(landmarks, context, {
      visibilityGood: 0.5,
      visibilityFair: 0.2,
    });

    assert.equal(result.legacy.trackingQuality, "good");
    assert.equal(result.next.trackingQuality, "good");
  });
});
