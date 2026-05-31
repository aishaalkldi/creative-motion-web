/**
 * Run: npx tsx --test app/lib/cv/body-framing-evaluator.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateBodyFraming,
  FRAMING_OVERLAY_COLORS,
  type BodyFramingProfile,
} from "@/app/lib/cv/body-framing-evaluator";
import {
  SEATED_RISE_FRAMING_PROFILE,
  STANDING_SAGITTAL_REP_FRAMING_PROFILE,
} from "@/app/lib/cv/body-framing-profiles";
import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";

function emptyLandmarks(): PoseLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
}

function seatedGoodLandmarks(): PoseLandmark[] {
  const lm = emptyLandmarks();
  lm[11] = { x: 0.42, y: 0.28, visibility: 0.9 };
  lm[12] = { x: 0.58, y: 0.28, visibility: 0.9 };
  lm[23] = { x: 0.42, y: 0.48, visibility: 0.9 };
  lm[24] = { x: 0.58, y: 0.48, visibility: 0.9 };
  lm[25] = { x: 0.42, y: 0.68, visibility: 0.85 };
  lm[26] = { x: 0.58, y: 0.68, visibility: 0.85 };
  lm[27] = { x: 0.42, y: 0.78, visibility: 0.8 };
  lm[28] = { x: 0.58, y: 0.78, visibility: 0.8 };
  return lm;
}

function standingGoodLandmarks(): PoseLandmark[] {
  const lm = seatedGoodLandmarks();
  lm[0] = { x: 0.5, y: 0.12, visibility: 0.9 };
  lm[11] = { x: 0.42, y: 0.22, visibility: 0.9 };
  lm[12] = { x: 0.58, y: 0.22, visibility: 0.9 };
  lm[23] = { x: 0.42, y: 0.42, visibility: 0.9 };
  lm[24] = { x: 0.58, y: 0.42, visibility: 0.9 };
  lm[25] = { x: 0.42, y: 0.62, visibility: 0.85 };
  lm[26] = { x: 0.58, y: 0.62, visibility: 0.85 };
  return lm;
}

function evaluate(
  landmarks: PoseLandmark[],
  profile: BodyFramingProfile,
  trackingQuality: "good" | "fair" | "poor" = "good",
  checking = false,
) {
  return evaluateBodyFraming(landmarks, profile, { checking, trackingQuality });
}

describe("evaluateBodyFraming", () => {
  it("returns checking while the readiness window is active", () => {
    assert.equal(
      evaluate(seatedGoodLandmarks(), SEATED_RISE_FRAMING_PROFILE, "good", true),
      "checking",
    );
  });

  it("returns good_distance for seated-rise when framing is valid", () => {
    assert.equal(
      evaluate(seatedGoodLandmarks(), SEATED_RISE_FRAMING_PROFILE),
      "good_distance",
    );
  });

  it("returns good_distance for standing-sagittal-rep when head-to-knee is visible", () => {
    assert.equal(
      evaluate(standingGoodLandmarks(), STANDING_SAGITTAL_REP_FRAMING_PROFILE),
      "good_distance",
    );
  });

  it("returns move_back when torso span is too large", () => {
    const lm = seatedGoodLandmarks();
    lm[11] = { x: 0.42, y: 0.08, visibility: 0.9 };
    lm[12] = { x: 0.58, y: 0.08, visibility: 0.9 };
    lm[23] = { x: 0.42, y: 0.72, visibility: 0.9 };
    lm[24] = { x: 0.58, y: 0.72, visibility: 0.9 };
    assert.equal(evaluate(lm, SEATED_RISE_FRAMING_PROFILE), "move_back");
  });

  it("returns move_closer when torso span is too small", () => {
    const lm = seatedGoodLandmarks();
    lm[11] = { x: 0.42, y: 0.44, visibility: 0.9 };
    lm[12] = { x: 0.58, y: 0.44, visibility: 0.9 };
    lm[23] = { x: 0.42, y: 0.48, visibility: 0.9 };
    lm[24] = { x: 0.58, y: 0.48, visibility: 0.9 };
    assert.equal(evaluate(lm, SEATED_RISE_FRAMING_PROFILE), "move_closer");
  });

  it("returns move_back when a landmark is clipped vertically", () => {
    const lm = seatedGoodLandmarks();
    lm[0] = { x: 0.5, y: 0.01, visibility: 0.9 };
    assert.equal(evaluate(lm, SEATED_RISE_FRAMING_PROFILE), "move_back");
  });

  it("returns adjust_camera_angle when a landmark is clipped horizontally", () => {
    const lm = seatedGoodLandmarks();
    lm[11] = { x: 0.01, y: 0.28, visibility: 0.9 };
    assert.equal(evaluate(lm, SEATED_RISE_FRAMING_PROFILE), "adjust_camera_angle");
  });

  it("returns low_visibility when hips are weak and tracking is poor", () => {
    const lm = seatedGoodLandmarks();
    lm[23] = { x: 0.42, y: 0.48, visibility: 0.1 };
    lm[24] = { x: 0.58, y: 0.48, visibility: 0.1 };
    assert.equal(evaluate(lm, SEATED_RISE_FRAMING_PROFILE, "poor"), "low_visibility");
  });

  it("returns low_visibility when standing profile lacks nose visibility", () => {
    const lm = standingGoodLandmarks();
    lm[0] = { x: 0.5, y: 0.12, visibility: 0.05 };
    assert.equal(evaluate(lm, STANDING_SAGITTAL_REP_FRAMING_PROFILE), "low_visibility");
  });

  it("uses green overlay color only for good_distance", () => {
    assert.equal(FRAMING_OVERLAY_COLORS.good, "#1D9E75");
    assert.equal(FRAMING_OVERLAY_COLORS.amber, "#F59E0B");
  });
});
