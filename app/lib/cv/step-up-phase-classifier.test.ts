/**
 * Run: npx tsx --test app/lib/cv/step-up-phase-classifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyStepUpMovementPhase,
  createStepUpPhaseClassifierState,
} from "@/app/lib/cv/step-up-phase-classifier";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

function snap(
  overrides: Partial<SitToStandDetectorSnapshot> = {},
): SitToStandDetectorSnapshot {
  return {
    trackingStatus: "pose-found",
    trackingQuality: "good",
    poseReadiness: "ready",
    bodyFramingState: "good_distance",
    repCount: 0,
    sessionSeconds: 5,
    movementDetected: true,
    standPhase: "up",
    isBaselineCalibrating: false,
    initPhase: null,
    ...overrides,
  };
}

describe("step up phase classifier (rise polarity on hip Y)", () => {
  it("labels baseline standing and top position at rise polarity extremes", () => {
    const state = createStepUpPhaseClassifierState();

    assert.equal(classifyStepUpMovementPhase(snap({ standPhase: "up" }), state), "standing");

    const ascent = classifyStepUpMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(ascent, "step_ascent");

    const top = classifyStepUpMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(top, "top_position");

    const descent = classifyStepUpMovementPhase(snap({ standPhase: "up" }), state);
    assert.equal(descent, "step_descent");
  });

  it("returns rest during calibration and unknown after sustained pose loss", () => {
    const calibrating = createStepUpPhaseClassifierState();
    assert.equal(
      classifyStepUpMovementPhase(snap({ isBaselineCalibrating: true }), calibrating),
      "rest",
    );

    const lost = createStepUpPhaseClassifierState();
    for (let i = 0; i < 8; i += 1) {
      classifyStepUpMovementPhase(snap({ trackingStatus: "pose-lost" }), lost);
    }
    assert.equal(
      classifyStepUpMovementPhase(snap({ trackingStatus: "pose-lost" }), lost),
      "unknown",
    );
  });
});
