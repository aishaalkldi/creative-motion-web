/**
 * Run: npx tsx --test app/lib/cv/functional-reach-phase-classifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyFunctionalReachMovementPhase,
  createFunctionalReachPhaseClassifierState,
} from "@/app/lib/cv/functional-reach-phase-classifier";
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

describe("Functional Reach phase classifier (forward reach extent)", () => {
  it("labels baseline standing and Peak reach at shift polarity extremes", () => {
    const state = createFunctionalReachPhaseClassifierState();

    assert.equal(classifyFunctionalReachMovementPhase(snap({ standPhase: "up" }), state), "standing");

    const shift = classifyFunctionalReachMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(shift, "reaching_forward");

    const stepOut = classifyFunctionalReachMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(stepOut, "peak_reach");

    const returnCenter = classifyFunctionalReachMovementPhase(snap({ standPhase: "up" }), state);
    assert.equal(returnCenter, "returning");
  });

  it("returns rest during calibration and unknown after sustained pose loss", () => {
    const calibrating = createFunctionalReachPhaseClassifierState();
    assert.equal(
      classifyFunctionalReachMovementPhase(snap({ isBaselineCalibrating: true }), calibrating),
      "rest",
    );

    const lost = createFunctionalReachPhaseClassifierState();
    for (let i = 0; i < 8; i += 1) {
      classifyFunctionalReachMovementPhase(snap({ trackingStatus: "pose-lost" }), lost);
    }
    assert.equal(
      classifyFunctionalReachMovementPhase(snap({ trackingStatus: "pose-lost" }), lost),
      "unknown",
    );
  });
});
