/**
 * Run: npx tsx --test app/lib/cv/mini-squat-phase-classifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyMiniSquatMovementPhase,
  createMiniSquatPhaseClassifierState,
} from "@/app/lib/cv/mini-squat-phase-classifier";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

function snap(partial: Partial<SitToStandDetectorSnapshot>): SitToStandDetectorSnapshot {
  return {
    repCount: 0,
    standPhase: "down",
    trackingStatus: "tracking",
    trackingQuality: "good",
    poseReadiness: "ready",
    bodyFramingState: "ok",
    initPhase: null,
    isBaselineCalibrating: false,
    ...partial,
  } as SitToStandDetectorSnapshot;
}

describe("mini squat phase classifier", () => {
  it("classifies standing, lowering, bottom, and rising for drop polarity", () => {
    const state = createMiniSquatPhaseClassifierState();

    assert.equal(classifyMiniSquatMovementPhase(snap({ standPhase: "down" }), state), "standing");
    assert.equal(classifyMiniSquatMovementPhase(snap({ standPhase: "up" }), state), "lowering");
    assert.equal(classifyMiniSquatMovementPhase(snap({ standPhase: "up" }), state), "bottom");
    assert.equal(classifyMiniSquatMovementPhase(snap({ standPhase: "down" }), state), "rising");
    assert.equal(classifyMiniSquatMovementPhase(snap({ standPhase: "down" }), state), "standing");
  });
});
