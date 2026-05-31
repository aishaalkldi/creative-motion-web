/**
 * Double Heel Raise rep detector unit tests (rise polarity on ankle mid-Y).
 * Run: npx tsx --test app/lib/cv/heel-raise-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeAnkleMidY,
  HeelRaiseDetector,
  HeelRaiseRepCounter,
  LAB_HEEL_RAISE_REP_CONFIG,
  mockHeelRaiseLandmarks,
} from "./heel-raise-detector";

const BASELINE_ANKLE = 0.82;
const TORSO = 0.25;

function primeFlat(counter: HeelRaiseRepCounter): void {
  counter.baselineAnkleY = BASELINE_ANKLE;
}

function fullHeelRaiseRep(counter: HeelRaiseRepCounter, startMs: number): void {
  counter.driveFrame(BASELINE_ANKLE, startMs, TORSO);
  counter.driveFrame(0.74, startMs + 800, TORSO);
  counter.driveFrame(BASELINE_ANKLE, startMs + 1_600, TORSO);
}

function runDetectorBaseline(detector: HeelRaiseDetector, startMs: number): void {
  const end = startMs + LAB_HEEL_RAISE_REP_CONFIG.baselineDurationMs;
  for (let t = startMs; t <= end; t += 100) {
    detector.driveFrame(mockHeelRaiseLandmarks(BASELINE_ANKLE), t);
  }
}

describe("HeelRaiseRepCounter", () => {
  it("starts with zero reps and rest phase", () => {
    const counter = new HeelRaiseRepCounter();
    assert.equal(counter.repCount, 0);
    assert.equal(counter.repPhase, "rest");
    assert.equal(counter.baselineAnkleY, null);
  });

  it("counts one clean double heel raise rep", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    fullHeelRaiseRep(counter, 0);
    assert.equal(counter.repCount, 1);
    assert.equal(counter.repPhase, "rest");
  });

  it("counts two reps with debounce spacing", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    fullHeelRaiseRep(counter, 0);
    fullHeelRaiseRep(counter, 1_500);
    assert.equal(counter.repCount, 2);
  });

  it("does not count rep without sufficient rise", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    counter.driveFrame(BASELINE_ANKLE, 0, TORSO);
    counter.driveFrame(0.79, 400, TORSO);
    counter.driveFrame(BASELINE_ANKLE, 1_200, TORSO);
    assert.equal(counter.repCount, 0);
  });

  it("does not count rep when rising too quickly (debounce)", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    counter.driveFrame(BASELINE_ANKLE, 0, TORSO);
    counter.driveFrame(0.74, 100, TORSO);
    counter.driveFrame(BASELINE_ANKLE, 200, TORSO);
    assert.equal(counter.repCount, 0);
  });

  it("collects baseline samples during calibration window", () => {
    const counter = new HeelRaiseRepCounter();
    counter.startBaselineWindow(0);
    counter.driveFrame(BASELINE_ANKLE, 500, TORSO);
    counter.driveFrame(BASELINE_ANKLE, 1_000, TORSO);
    assert.equal(counter.baselineAnkleY, null);
    assert.equal(counter.isBaselineCalibrating, true);
    counter.driveFrame(BASELINE_ANKLE, 3_000, TORSO);
    assert.equal(counter.baselineAnkleY, BASELINE_ANKLE);
    assert.equal(counter.isBaselineCalibrating, false);
  });

  it("resetReps clears count but keeps baseline", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    fullHeelRaiseRep(counter, 0);
    counter.resetReps();
    assert.equal(counter.repCount, 0);
    assert.equal(counter.baselineAnkleY, BASELINE_ANKLE);
  });

  it("resetBaseline clears baseline state", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    counter.resetBaseline();
    assert.equal(counter.baselineAnkleY, null);
    assert.equal(counter.repCount, 0);
  });

  it("getDerivedMetrics uses heel-raise exercise id", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    fullHeelRaiseRep(counter, 0);
    const metrics = counter.getDerivedMetrics(20, 80, 90, "good");
    assert.equal(metrics.exerciseId, "heel-raise");
    assert.equal(metrics.repCount, 1);
    assert.equal(metrics.sessionDurationS, 20);
    assert.equal(metrics.trackingQuality, "good");
    assert.equal(metrics.movementDetected, true);
  });

  it("movementDetected false when no reps counted", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    counter.driveFrame(BASELINE_ANKLE, 0, TORSO);
    const metrics = counter.getDerivedMetrics(5, 10, 10);
    assert.equal(metrics.movementDetected, false);
  });

  it("uses LAB config defaults", () => {
    assert.equal(LAB_HEEL_RAISE_REP_CONFIG.baselineDurationMs, 2_500);
    assert.equal(LAB_HEEL_RAISE_REP_CONFIG.minMsBetweenReps, 700);
    assert.ok(
      LAB_HEEL_RAISE_REP_CONFIG.baselinePrimaryDelta >
        LAB_HEEL_RAISE_REP_CONFIG.baselineResetDelta,
    );
  });

  it("three sequential reps with spacing", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    fullHeelRaiseRep(counter, 0);
    fullHeelRaiseRep(counter, 1_500);
    fullHeelRaiseRep(counter, 3_000);
    assert.equal(counter.repCount, 3);
  });

  it("snapshot reflects current state", () => {
    const counter = new HeelRaiseRepCounter();
    primeFlat(counter);
    counter.driveFrame(BASELINE_ANKLE, 0, TORSO);
    counter.driveFrame(0.74, 800, TORSO);
    const snap = counter.getSnapshot();
    assert.equal(snap.repPhase, "peak");
    assert.equal(snap.baselineAnkleY, BASELINE_ANKLE);
    assert.equal(snap.movementDetected, true);
    assert.equal(snap.repCount, 1);
  });

  it("does not increment during baseline calibration", () => {
    const counter = new HeelRaiseRepCounter();
    counter.startBaselineWindow(0);
    counter.driveFrame(0.74, 500, TORSO);
    counter.driveFrame(BASELINE_ANKLE, 1_500, TORSO);
    assert.equal(counter.repCount, 0);
  });
});

describe("HeelRaiseDetector", () => {
  it("computes ankle mid-Y from mock landmarks", () => {
    const landmarks = mockHeelRaiseLandmarks(0.8);
    assert.equal(computeAnkleMidY(landmarks), 0.8);
  });

  it("driveFrame counts reps from landmarks after baseline", () => {
    const detector = new HeelRaiseDetector();
    runDetectorBaseline(detector, 0);
    for (let t = 2_600; t <= 4_200; t += 100) {
      const ankleY = t < 3_400 ? BASELINE_ANKLE : t < 4_000 ? 0.74 : BASELINE_ANKLE;
      detector.driveFrame(mockHeelRaiseLandmarks(ankleY), t);
    }
    assert.equal(detector.getDerivedMetrics().repCount, 1);
  });

  it("getDerivedMetrics includes tracking quality from visibility frames", () => {
    const detector = new HeelRaiseDetector();
    detector.startSession(0);
    for (let t = 0; t < 2_000; t += 100) {
      detector.driveFrame(mockHeelRaiseLandmarks(BASELINE_ANKLE, 0.7), t);
    }
    detector.endSession(2_000);
    const metrics = detector.getDerivedMetrics();
    assert.equal(metrics.exerciseId, "heel-raise");
    assert.ok(["good", "fair", "poor", "unknown"].includes(metrics.trackingQuality));
    assert.ok(metrics.framesWithPose > 0);
    assert.equal(metrics.sessionDurationS, 2);
  });

  it("canSaveMetrics requires min duration and reps", () => {
    const detector = new HeelRaiseDetector();
    detector.startSession(0);
    assert.equal(detector.canSaveMetrics(), false);
  });

  it("reset clears session state", () => {
    const detector = new HeelRaiseDetector();
    detector.startSession(0);
    detector.driveFrame(mockHeelRaiseLandmarks(BASELINE_ANKLE), 100);
    detector.reset();
    const snap = detector.getSnapshot();
    assert.equal(snap.framesTotal, 0);
    assert.equal(snap.repCount, 0);
  });

  it("snapshot includes body framing state", () => {
    const detector = new HeelRaiseDetector();
    detector.driveFrame(mockHeelRaiseLandmarks(BASELINE_ANKLE), 0);
    const snap = detector.getSnapshot();
    assert.notEqual(snap.bodyFramingState, "checking");
  });
});
