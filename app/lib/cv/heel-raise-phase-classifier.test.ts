/**
 * Run: npx tsx --test app/lib/cv/heel-raise-phase-classifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyHeelRaiseMovementPhase,
  createHeelRaisePhaseClassifierState,
} from "@/app/lib/cv/heel-raise-phase-classifier";
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

describe("heel raise phase classifier (rise polarity)", () => {
  it("labels baseline standing and peak raise at rise polarity extremes", () => {
    const state = createHeelRaisePhaseClassifierState();

    assert.equal(classifyHeelRaiseMovementPhase(snap({ standPhase: "up" }), state), "standing");

    const rising = classifyHeelRaiseMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(rising, "rising");

    const peak = classifyHeelRaiseMovementPhase(snap({ standPhase: "down" }), state);
    assert.equal(peak, "peak_raise");

    const lowering = classifyHeelRaiseMovementPhase(snap({ standPhase: "up" }), state);
    assert.equal(lowering, "lowering");
  });

  it("returns rest during calibration and unknown after sustained pose loss", () => {
    const calibrating = createHeelRaisePhaseClassifierState();
    assert.equal(
      classifyHeelRaiseMovementPhase(snap({ isBaselineCalibrating: true }), calibrating),
      "rest",
    );

    const lost = createHeelRaisePhaseClassifierState();
    for (let i = 0; i < 8; i += 1) {
      classifyHeelRaiseMovementPhase(snap({ trackingStatus: "pose-lost" }), lost);
    }
    assert.equal(
      classifyHeelRaiseMovementPhase(snap({ trackingStatus: "pose-lost" }), lost),
      "unknown",
    );
  });
});
