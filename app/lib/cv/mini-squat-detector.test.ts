/**
 * Mini Squat rep counter unit tests (drop polarity).
 * Run: npx tsx --test app/lib/cv/mini-squat-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LAB_MINI_SQUAT_REP_CONFIG,
  MiniSquatRepCounter,
} from "./mini-squat-detector";

const BASELINE = 0.45;
const TORSO = 0.25;

function primeStanding(counter: MiniSquatRepCounter): void {
  counter.baselineHipY = BASELINE;
}

function fullSquatRep(counter: MiniSquatRepCounter, startMs: number): void {
  counter.driveFrame(BASELINE, startMs, TORSO);
  counter.driveFrame(0.52, startMs + 400, TORSO);
  counter.driveFrame(0.44, startMs + 1_500, TORSO);
  counter.driveFrame(0.44, startMs + 1_516, TORSO);
}

describe("MiniSquatRepCounter", () => {
  it("starts with zero reps and standing phase", () => {
    const counter = new MiniSquatRepCounter();
    assert.equal(counter.repCount, 0);
    assert.equal(counter.repPhase, "rest");
    assert.equal(counter.baselineHipY, null);
  });

  it("counts one clean mini squat rep", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    fullSquatRep(counter, 0);
    assert.equal(counter.repCount, 1);
    assert.equal(counter.repPhase, "rest");
  });

  it("counts two reps with debounce spacing", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    fullSquatRep(counter, 0);
    fullSquatRep(counter, 2_000);
    assert.equal(counter.repCount, 2);
  });

  it("does not count rep without sufficient descent", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    counter.driveFrame(BASELINE, 0, TORSO);
    counter.driveFrame(0.47, 500, TORSO);
    counter.driveFrame(BASELINE, 1_500, TORSO);
    assert.equal(counter.repCount, 0);
  });

  it("does not count rep when returning too quickly (debounce)", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    counter.driveFrame(BASELINE, 0, TORSO);
    counter.driveFrame(0.52, 100, TORSO);
    counter.driveFrame(0.44, 200, TORSO);
    assert.equal(counter.repCount, 0);
  });

  it("collects baseline samples during calibration window", () => {
    const counter = new MiniSquatRepCounter();
    counter.startBaselineWindow(0);
    counter.driveFrame(0.45, 500, TORSO);
    counter.driveFrame(0.45, 1_000, TORSO);
    assert.equal(counter.baselineHipY, null);
    assert.equal(counter.isBaselineCalibrating, true);
    counter.driveFrame(0.45, 3_500, TORSO);
    assert.equal(counter.baselineHipY, 0.45);
    assert.equal(counter.isBaselineCalibrating, false);
  });

  it("resetReps clears count but keeps baseline", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    fullSquatRep(counter, 0);
    counter.resetReps();
    assert.equal(counter.repCount, 0);
    assert.equal(counter.baselineHipY, BASELINE);
  });

  it("resetBaseline clears baseline state", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    counter.resetBaseline();
    assert.equal(counter.baselineHipY, null);
    assert.equal(counter.repCount, 0);
  });

  it("getDerivedMetrics uses mini-squat exercise id", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    fullSquatRep(counter, 0);
    const metrics = counter.getDerivedMetrics(30, 100, 120);
    assert.equal(metrics.exerciseId, "mini-squat");
    assert.equal(metrics.repCount, 1);
    assert.equal(metrics.sessionDurationS, 30);
    assert.equal(metrics.movementDetected, true);
  });

  it("movementDetected false when no reps counted", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    counter.driveFrame(BASELINE, 0, TORSO);
    const metrics = counter.getDerivedMetrics(5, 10, 10);
    assert.equal(metrics.movementDetected, false);
  });

  it("handles partial bounce without extra rep", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    counter.driveFrame(BASELINE, 0, TORSO);
    counter.driveFrame(0.52, 500, TORSO);
    counter.driveFrame(0.5, 800, TORSO);
    counter.driveFrame(0.52, 1_100, TORSO);
    counter.driveFrame(0.44, 2_000, TORSO);
    counter.driveFrame(0.44, 2_016, TORSO);
    assert.equal(counter.repCount, 1);
  });

  it("uses LAB config defaults", () => {
    assert.equal(LAB_MINI_SQUAT_REP_CONFIG.baselineDurationMs, 3_000);
    assert.equal(LAB_MINI_SQUAT_REP_CONFIG.minMsBetweenReps, 1_000);
    assert.ok(LAB_MINI_SQUAT_REP_CONFIG.baselinePrimaryDelta > LAB_MINI_SQUAT_REP_CONFIG.baselineResetDelta);
  });

  it("three sequential reps with spacing", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    fullSquatRep(counter, 0);
    fullSquatRep(counter, 2_000);
    fullSquatRep(counter, 4_000);
    assert.equal(counter.repCount, 3);
  });

  it("snapshot reflects current state", () => {
    const counter = new MiniSquatRepCounter();
    primeStanding(counter);
    counter.driveFrame(BASELINE, 0, TORSO);
    counter.driveFrame(0.52, 500, TORSO);
    const snap = counter.getSnapshot();
    assert.equal(snap.repPhase, "peak");
    assert.equal(snap.baselineHipY, BASELINE);
    assert.equal(snap.movementDetected, true);
  });

  it("does not increment during baseline calibration", () => {
    const counter = new MiniSquatRepCounter();
    counter.startBaselineWindow(0);
    counter.driveFrame(0.52, 500, TORSO);
    counter.driveFrame(0.44, 1_500, TORSO);
    assert.equal(counter.repCount, 0);
  });

  it("trunk lean partial drop may not count without threshold cross", () => {
    const counter = new MiniSquatRepCounter({
      ...LAB_MINI_SQUAT_REP_CONFIG,
      baselinePrimaryDelta: 0.08,
    });
    primeStanding(counter);
    counter.driveFrame(BASELINE, 0, TORSO);
    counter.driveFrame(0.47, 500, TORSO);
    counter.driveFrame(BASELINE, 2_000, TORSO);
    assert.equal(counter.repCount, 0);
  });
});
