/**
 * Run: npx tsx --test app/lib/cv/sts-landmark-coverage.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateBodyFraming } from "@/app/lib/cv/body-framing-evaluator";
import { SEATED_RISE_FRAMING_PROFILE } from "@/app/lib/cv/body-framing-profiles";
import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";
import {
  computeStsLandmarkCoverage,
  isStsAdvisoryFramingState,
  isStsCoverageReady,
} from "@/app/lib/cv/sts-landmark-coverage";

function emptyLandmarks(): PoseLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
}

/** Tall user: torso span exceeds profile max (move_back) but core joints are visible. */
function tallUserLandmarks(): PoseLandmark[] {
  const lm = emptyLandmarks();
  lm[11] = { x: 0.42, y: 0.08, visibility: 0.9 };
  lm[12] = { x: 0.58, y: 0.08, visibility: 0.9 };
  lm[23] = { x: 0.42, y: 0.72, visibility: 0.9 };
  lm[24] = { x: 0.58, y: 0.72, visibility: 0.9 };
  lm[25] = { x: 0.42, y: 0.86, visibility: 0.88 };
  lm[26] = { x: 0.58, y: 0.86, visibility: 0.88 };
  lm[27] = { x: 0.42, y: 0.96, visibility: 0.85 };
  lm[28] = { x: 0.58, y: 0.96, visibility: 0.85 };
  return lm;
}

function hipLossLandmarks(): PoseLandmark[] {
  const lm = tallUserLandmarks();
  lm[23] = { x: 0.42, y: 0.38, visibility: 0.1 };
  lm[24] = { x: 0.58, y: 0.38, visibility: 0.1 };
  return lm;
}

describe("computeStsLandmarkCoverage", () => {
  it("passes tall-user landmarks with clipped ankles", () => {
    const lm = tallUserLandmarks();
    const coverage = computeStsLandmarkCoverage(lm);
    assert.equal(coverage.shouldersOk, true);
    assert.equal(coverage.hipsOk, true);
    assert.equal(coverage.kneesOk, true);
    assert.ok(coverage.score >= 80);
    assert.equal(isStsCoverageReady(coverage, "good"), true);
    assert.equal(isStsCoverageReady(coverage, "fair"), true);
  });

  it("fails when bilateral hips are below visibility floor", () => {
    const coverage = computeStsLandmarkCoverage(hipLossLandmarks());
    assert.equal(coverage.hipsOk, false);
    assert.equal(isStsCoverageReady(coverage, "good"), false);
    assert.equal(isStsCoverageReady(coverage, "fair"), false);
  });

  it("fails when knees are missing", () => {
    const lm = tallUserLandmarks();
    lm[25] = { x: 0.42, y: 0.62, visibility: 0.05 };
    lm[26] = { x: 0.58, y: 0.62, visibility: 0.05 };
    const coverage = computeStsLandmarkCoverage(lm);
    assert.equal(coverage.kneesOk, false);
    assert.equal(isStsCoverageReady(coverage, "good"), false);
  });

  it("fails when tracking quality is poor", () => {
    const coverage = computeStsLandmarkCoverage(tallUserLandmarks());
    assert.equal(isStsCoverageReady(coverage, "poor"), false);
    assert.equal(isStsCoverageReady(coverage, null), false);
  });

  it("treats ankles as bonus only", () => {
    const lm = tallUserLandmarks();
    lm[27] = { x: 0.42, y: 0.96, visibility: 0.05 };
    lm[28] = { x: 0.58, y: 0.96, visibility: 0.05 };
    const coverage = computeStsLandmarkCoverage(lm);
    assert.equal(coverage.anklesBonus, false);
    assert.equal(isStsCoverageReady(coverage, "good"), true);
  });
});

describe("STS advisory framing", () => {
  it("flags move_back as advisory only", () => {
    const lm = tallUserLandmarks();
    assert.equal(
      evaluateBodyFraming(lm, SEATED_RISE_FRAMING_PROFILE, {
        checking: false,
        trackingQuality: "good",
      }),
      "move_back",
    );
    assert.equal(isStsAdvisoryFramingState("move_back"), true);
    assert.equal(isStsAdvisoryFramingState("move_closer"), false);
    assert.equal(isStsAdvisoryFramingState("low_visibility"), false);
  });
});

describe("SitToStandDetector STS coverage readiness", () => {
  it("keeps pose readiness when move_back but STS coverage is good", async () => {
    const { PATIENT_STS_CONFIG } = await import("@/app/lib/cv/cv-patient-config");
    const { SitToStandDetector } = await import("@/app/lib/cv/sit-to-stand-detector");

    type Internals = {
      readinessCheckEndMs: number;
      trackingQuality: "good" | "fair" | "poor" | null;
      updatePoseReadiness: (nowMs: number, landmarks: PoseLandmark[]) => void;
    };

    const detector = new SitToStandDetector({ onSnapshot: () => {} }, PATIENT_STS_CONFIG);
    const d = detector as unknown as Internals;
    d.readinessCheckEndMs = 0;
    d.trackingQuality = "good";
    d.updatePoseReadiness(5_000, tallUserLandmarks());

    const snap = detector.getSnapshot();
    assert.equal(snap.bodyFramingState, "move_back");
    assert.equal(snap.stsLandmarkCoverageReady, true);
    assert.ok(snap.poseReadiness === "ready" || snap.poseReadiness === "partial");
  });

  it("blocks pose readiness when hips are lost despite move_back framing", async () => {
    const { PATIENT_STS_CONFIG } = await import("@/app/lib/cv/cv-patient-config");
    const { SitToStandDetector } = await import("@/app/lib/cv/sit-to-stand-detector");

    type Internals = {
      readinessCheckEndMs: number;
      trackingQuality: "good" | "fair" | "poor" | null;
      updatePoseReadiness: (nowMs: number, landmarks: PoseLandmark[]) => void;
    };

    const detector = new SitToStandDetector({ onSnapshot: () => {} }, PATIENT_STS_CONFIG);
    const d = detector as unknown as Internals;
    d.readinessCheckEndMs = 0;
    d.trackingQuality = "good";
    d.updatePoseReadiness(5_000, hipLossLandmarks());

    const snap = detector.getSnapshot();
    assert.equal(snap.stsLandmarkCoverageReady, false);
    assert.equal(snap.poseReadiness, "not_ready");
  });
});
