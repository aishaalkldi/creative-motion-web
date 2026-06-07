/**
 * Run: npx tsx --test app/lib/cv/sts-phase-classifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import {
  classifyStsMovementPhase,
  createStsPhaseClassifierState,
} from "@/app/lib/cv/sts-phase-classifier";

const BASE: SitToStandDetectorSnapshot = {
  trackingStatus: "pose-found",
  trackingQuality: "good",
  poseReadiness: "ready",
  bodyFramingState: "good_distance",
  repCount: 0,
  sessionSeconds: 0,
  movementDetected: true,
  framesWithPose: 1,
  framesTotal: 1,
  initPhase: null,
  previewActive: true,
  trackingError: null,
  isBaselineCalibrating: false,
  standPhase: "down",
};

describe("classifyStsMovementPhase", () => {
  it("classifies a full sit-to-stand cycle across standPhase transitions", () => {
    const state = createStsPhaseClassifierState();

    assert.equal(
      classifyStsMovementPhase({ ...BASE, sessionSeconds: 0, standPhase: "down" }, state),
      "seated",
    );
    assert.equal(
      classifyStsMovementPhase({ ...BASE, sessionSeconds: 1, standPhase: "up" }, state),
      "rising",
    );
    assert.equal(
      classifyStsMovementPhase({ ...BASE, sessionSeconds: 2, standPhase: "up", repCount: 1 }, state),
      "standing",
    );
    assert.equal(
      classifyStsMovementPhase({ ...BASE, sessionSeconds: 3, standPhase: "down", repCount: 1 }, state),
      "returning",
    );
    assert.equal(
      classifyStsMovementPhase({ ...BASE, sessionSeconds: 4, standPhase: "down", repCount: 1 }, state),
      "seated",
    );
  });

  it("returns rest during baseline calibration", () => {
    const state = createStsPhaseClassifierState();
    assert.equal(
      classifyStsMovementPhase({ ...BASE, isBaselineCalibrating: true }, state),
      "rest",
    );
  });

  it("returns unknown on pose lost", () => {
    const state = createStsPhaseClassifierState();
    assert.equal(
      classifyStsMovementPhase({ ...BASE, trackingStatus: "pose-lost" }, state),
      "unknown",
    );
  });
});
