/**
 * Run: npx tsx --test app/lib/cv/lateral-step-phase-classifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyLateralStepMovementPhase,
  createLateralStepPhaseClassifierState,
} from "@/app/lib/cv/lateral-step-phase-classifier";
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

describe("lateral step phase classifier (frontal hip X deviation)", () => {
  it("labels baseline standing and step out at shift polarity extremes", () => {
    const state = createLateralStepPhaseClassifierState();

    assert.equal(classifyLateralStepMovementPhase(snap({ standPhase: "up" }), state), "standing");

    const shift = classifyLateralStepMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(shift, "lateral_shift");

    const stepOut = classifyLateralStepMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(stepOut, "step_out");

    const returnCenter = classifyLateralStepMovementPhase(snap({ standPhase: "up" }), state);
    assert.equal(returnCenter, "return_to_center");
  });

  it("returns rest during calibration and unknown after sustained pose loss", () => {
    const calibrating = createLateralStepPhaseClassifierState();
    assert.equal(
      classifyLateralStepMovementPhase(snap({ isBaselineCalibrating: true }), calibrating),
      "rest",
    );

    const lost = createLateralStepPhaseClassifierState();
    for (let i = 0; i < 8; i += 1) {
      classifyLateralStepMovementPhase(snap({ trackingStatus: "pose-lost" }), lost);
    }
    assert.equal(
      classifyLateralStepMovementPhase(snap({ trackingStatus: "pose-lost" }), lost),
      "unknown",
    );
  });
});
