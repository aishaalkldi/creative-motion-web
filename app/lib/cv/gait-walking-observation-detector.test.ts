/**
 * Gait walking observation engine unit tests.
 * Run: npx tsx --test app/lib/cv/gait-walking-observation-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSESSMENT_GAIT_WALKING_CONFIG,
  GaitWalkingObservationEngine,
  type GaitWalkingConfig,
} from "./gait-walking-observation-detector";
import type { PoseLandmark } from "./sagittal-hip-rep-core";

function mockWalkingLandmarks(hipY: number, visibility = 0.9): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  landmarks[11] = { x: 0.45, y: hipY - 0.15, visibility };
  landmarks[12] = { x: 0.55, y: hipY - 0.15, visibility };
  landmarks[23] = { x: 0.45, y: hipY, visibility };
  landmarks[24] = { x: 0.55, y: hipY, visibility };
  return landmarks;
}

function simulateWalking(
  engine: GaitWalkingObservationEngine,
  startMs: number,
  durationMs: number,
  stepMs = 400,
): void {
  let t = startMs;
  let hipY = 0.55;
  let direction = 1;
  while (t <= startMs + durationMs) {
    hipY += direction * 0.008;
    if (hipY >= 0.62) direction = -1;
    if (hipY <= 0.48) direction = 1;
    engine.driveFrame(mockWalkingLandmarks(hipY), t);
    t += stepMs;
  }
}

describe("GaitWalkingObservationEngine", () => {
  it("starts idle with zero steps and no movement", () => {
    const engine = new GaitWalkingObservationEngine();
    const snap = engine.getSnapshot();
    assert.equal(snap.repCount, 0);
    assert.equal(snap.movementDetected, false);
    assert.equal(snap.trackingStatus, "idle");
  });

  it("detects movement and counts step estimate during oscillating hips", () => {
    const config: GaitWalkingConfig = {
      ...ASSESSMENT_GAIT_WALKING_CONFIG,
      minSaveDurationS: 3,
      stepDebounceMs: 100,
    };
    const engine = new GaitWalkingObservationEngine(config);
    simulateWalking(engine, 0, 6_000, 200);
    engine.endSession(6_000);

    const metrics = engine.getDerivedMetrics();
    assert.equal(metrics.movementDetected, true);
    assert.ok(metrics.repCount > 0);
    assert.ok(metrics.sessionDurationS >= 3);
    assert.ok(engine.canSaveMetrics());
  });

  it("does not save when session is too short", () => {
    const config: GaitWalkingConfig = {
      ...ASSESSMENT_GAIT_WALKING_CONFIG,
      minSaveDurationS: 10,
    };
    const engine = new GaitWalkingObservationEngine(config);
    simulateWalking(engine, 0, 4_000, 200);
    engine.endSession(4_000);
    assert.equal(engine.canSaveMetrics(), false);
  });
});
