/**
 * Run: npx tsx --test app/lib/cv/patient-cv-capture-readiness.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAPTURE_READINESS_STABLE_SECONDS,
  CAPTURE_SETUP_LIMITED_FLAG,
  evaluateCaptureReadiness,
  evaluateCaptureReadinessChecks,
  requiredReadinessChecksForExercise,
  resolveCaptureSetupGuidance,
  shouldAutoStartCapture,
  shouldFlagCaptureSetupLimited,
  shouldRecordCaptureTimeline,
  updateStableTrackingState,
} from "./patient-cv-capture-readiness";
import type { CaptureReadinessSnapshot } from "./patient-cv-capture-readiness";

const READY_SNAPSHOT: CaptureReadinessSnapshot = {
  trackingStatus: "pose-found",
  trackingQuality: "good",
  poseReadiness: "ready",
  bodyFramingState: "good_distance",
  previewActive: true,
};

describe("requiredReadinessChecksForExercise", () => {
  it("includes feet checks for heel raise", () => {
    const ids = requiredReadinessChecksForExercise("heel-raise");
    assert.ok(ids.includes("feet_visible"));
    assert.ok(ids.includes("correct_distance"));
  });

  it("includes upper reach for functional reach", () => {
    const ids = requiredReadinessChecksForExercise("functional-reach");
    assert.ok(ids.includes("upper_reach_visible"));
    assert.ok(!ids.includes("feet_visible"));
  });
});

describe("evaluateCaptureReadiness", () => {
  it("blocks start until tracking is stable for 3 seconds", () => {
    const eval2s = evaluateCaptureReadiness("mini-squat", READY_SNAPSHOT, 2);
    assert.equal(eval2s.minimumMet, true);
    assert.equal(eval2s.canStartTracking, false);

    const eval3s = evaluateCaptureReadiness(
      "mini-squat",
      READY_SNAPSHOT,
      CAPTURE_READINESS_STABLE_SECONDS,
    );
    assert.equal(eval3s.canStartTracking, true);
  });

  it("flags pose loss as step into frame guidance", () => {
    const guidance = resolveCaptureSetupGuidance("heel-raise", {
      ...READY_SNAPSHOT,
      trackingStatus: "pose-lost",
      poseReadiness: "not_ready",
    });
    assert.equal(guidance, "step_into_frame");
  });

  it("requires feet visibility for lateral step", () => {
    const checks = evaluateCaptureReadinessChecks("lateral-step", {
      ...READY_SNAPSHOT,
      poseReadiness: "not_ready",
    }, 3);
    const feet = checks.find((c) => c.id === "feet_visible");
    assert.ok(feet?.required);
    assert.equal(feet?.met, false);
  });
});

describe("updateStableTrackingState", () => {
  it("accumulates stable seconds when minimum checks pass", () => {
    const t0 = 1_000;
    const s1 = updateStableTrackingState(
      { stableSinceMs: null, stableSeconds: 0 },
      true,
      t0,
    );
    assert.equal(s1.stableSinceMs, t0);

    const s2 = updateStableTrackingState(s1, true, t0 + 2_500);
    assert.equal(s2.stableSeconds, 2.5);
  });

  it("resets when minimum checks fail", () => {
    const s1 = updateStableTrackingState(
      { stableSinceMs: 500, stableSeconds: 2 },
      false,
      2_000,
    );
    assert.equal(s1.stableSinceMs, null);
    assert.equal(s1.stableSeconds, 0);
  });
});

describe("shouldAutoStartCapture (PR72)", () => {
  it("auto-starts after 3s readiness when preview is active", () => {
    const evaluation = evaluateCaptureReadiness(
      "mini-squat",
      READY_SNAPSHOT,
      CAPTURE_READINESS_STABLE_SECONDS,
    );
    assert.equal(evaluation.canStartTracking, true);
    assert.equal(
      shouldAutoStartCapture({
        previewActive: true,
        trackingConfirmed: false,
        canStartTracking: evaluation.canStartTracking,
      }),
      true,
    );
  });

  it("does not auto-start before 3s stability", () => {
    const evaluation = evaluateCaptureReadiness("mini-squat", READY_SNAPSHOT, 2);
    assert.equal(
      shouldAutoStartCapture({
        previewActive: true,
        trackingConfirmed: false,
        canStartTracking: evaluation.canStartTracking,
      }),
      false,
    );
  });

  it("does not auto-start once tracking is already confirmed", () => {
    assert.equal(
      shouldAutoStartCapture({
        previewActive: true,
        trackingConfirmed: true,
        canStartTracking: true,
      }),
      false,
    );
  });
});

describe("shouldRecordCaptureTimeline (PR72)", () => {
  it("blocks timeline recording before tracking is confirmed", () => {
    assert.equal(shouldRecordCaptureTimeline(false), false);
    assert.equal(shouldRecordCaptureTimeline(true), true);
  });
});

describe("shouldFlagCaptureSetupLimited", () => {
  it("flags continue-anyway override starts", () => {
    const evaluation = evaluateCaptureReadiness("sit-to-stand", READY_SNAPSHOT, 3);
    assert.equal(
      shouldFlagCaptureSetupLimited(true, evaluation),
      true,
    );
  });

  it("flags continue-anyway even when readiness is partial", () => {
    const evaluation = evaluateCaptureReadiness("heel-raise", READY_SNAPSHOT, 1);
    assert.equal(evaluation.canStartTracking, false);
    assert.equal(shouldFlagCaptureSetupLimited(true, evaluation), true);
  });

  it("does not flag fully ready starts", () => {
    const evaluation = evaluateCaptureReadiness("sit-to-stand", READY_SNAPSHOT, 3);
    assert.equal(
      shouldFlagCaptureSetupLimited(false, evaluation),
      false,
    );
  });

  it("uses capture_setup_limited constant", () => {
    assert.equal(CAPTURE_SETUP_LIMITED_FLAG, "capture_setup_limited");
  });
});
