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

  it("labels rising on down→up even when rep count increments on the same tick", () => {
    const state = createStsPhaseClassifierState();
    classifyStsMovementPhase({ ...BASE, standPhase: "down" }, state);
    assert.equal(
      classifyStsMovementPhase(
        { ...BASE, standPhase: "up", repCount: 1 },
        state,
      ),
      "rising",
    );
  });

  it("keeps last stable phase during brief pose loss", () => {
    const state = createStsPhaseClassifierState();
    classifyStsMovementPhase({ ...BASE, standPhase: "up" }, state);
    const briefLoss = classifyStsMovementPhase(
      { ...BASE, trackingStatus: "pose-lost" },
      state,
    );
    assert.equal(briefLoss, "standing");
  });

  it("returns unknown only after sustained pose loss", () => {
    const state = createStsPhaseClassifierState();
    classifyStsMovementPhase({ ...BASE, standPhase: "up" }, state);
    let phase: ReturnType<typeof classifyStsMovementPhase> = "standing";
    for (let i = 0; i < 8; i += 1) {
      phase = classifyStsMovementPhase(
        { ...BASE, trackingStatus: "pose-lost" },
        state,
      );
    }
    assert.equal(phase, "unknown");
  });
});
