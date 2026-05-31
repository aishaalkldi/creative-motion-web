/**
 * Single-Leg Stance hold detector unit tests.
 * Run: npx tsx --test app/lib/cv/single-leg-stance-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LAB_SLS_HOLD_CONFIG,
  mockSingleLegStanceLandmarks,
  SingleLegStanceHoldDetector,
} from "./single-leg-stance-detector";

const FAST_OPTIONS = { useReadinessGates: false } as const;
const BILATERAL_Y = 0.75;
const LIFTED_Y = 0.55;

function bilateral(stanceLeg: "left" | "right" = "left") {
  return mockSingleLegStanceLandmarks(stanceLeg, {
    liftAnkleY: BILATERAL_Y,
    stanceAnkleY: BILATERAL_Y,
  });
}

function lifted(stanceLeg: "left" | "right" = "left") {
  return mockSingleLegStanceLandmarks(stanceLeg, {
    liftAnkleY: LIFTED_Y,
    stanceAnkleY: BILATERAL_Y,
  });
}

function runBaseline(detector: SingleLegStanceHoldDetector, startMs: number): void {
  const end = startMs + LAB_SLS_HOLD_CONFIG.baselineDurationMs;
  for (let t = startMs; t <= end; t += 100) {
    detector.driveFrame(bilateral(), t);
  }
}

function confirmHoldStart(
  detector: SingleLegStanceHoldDetector,
  startMs: number,
  stanceLeg: "left" | "right" = "left",
): void {
  const end = startMs + LAB_SLS_HOLD_CONFIG.holdStartConfirmMs;
  for (let t = startMs; t <= end; t += 50) {
    detector.driveFrame(lifted(stanceLeg), t);
  }
}

describe("SingleLegStanceHoldDetector", () => {
  it("starts in calibrating phase with zero hold metrics", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    detector.startSession(0);
    const snap = detector.getSnapshot();
    assert.equal(snap.holdPhase, "calibrating");
    assert.equal(snap.accumulatedHoldMs, 0);
    assert.equal(snap.interruptionCount, 0);
    assert.equal(snap.recoveryCount, 0);
    assert.equal(snap.movementDetected, false);
  });

  it("transitions calibrating → ready after baseline window", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    assert.equal(detector.getSnapshot().holdPhase, "ready");
    assert.equal(detector.getSnapshot().isBaselineCalibrating, false);
  });

  it("starts hold after sustained lift confirmation", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);
    assert.equal(detector.getSnapshot().holdPhase, "hold_active");
  });

  it("accumulates hold time while lift is maintained", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);

    for (let t = 2_700; t <= 5_700; t += 100) {
      detector.driveFrame(lifted(), t);
    }

    const snap = detector.getSnapshot();
    assert.ok(snap.accumulatedHoldMs >= 2_900);
    assert.ok(snap.longestContinuousHoldMs >= 2_900);
  });

  it("sets movementDetected when accumulated hold ≥ minSaveHoldS", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);

    for (let t = 2_700; t <= 6_000; t += 100) {
      detector.driveFrame(lifted(), t);
    }

    const metrics = detector.getDerivedMetrics();
    assert.equal(metrics.movementDetected, true);
    assert.equal(metrics.repCount, 0);
    assert.equal(metrics.exerciseId, "single-leg-stance");
    assert.ok(metrics.sessionDurationS >= 3);
  });

  it("registers interruption on sustained foot-down", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);

    for (let t = 2_700; t <= 4_000; t += 100) {
      detector.driveFrame(lifted(), t);
    }

    const footDownStart = 4_100;
    const footDownEnd =
      footDownStart + LAB_SLS_HOLD_CONFIG.interruptionConfirmMs + 100;
    for (let t = footDownStart; t <= footDownEnd; t += 50) {
      detector.driveFrame(bilateral(), t);
    }

    const snap = detector.getSnapshot();
    assert.equal(snap.holdPhase, "interrupted");
    assert.equal(snap.interruptionCount, 1);
    assert.ok(snap.accumulatedHoldMs > 0);
  });

  it("debounces brief foot-down jitter without interruption", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);

    for (let t = 2_700; t <= 4_000; t += 100) {
      detector.driveFrame(lifted(), t);
    }

    detector.driveFrame(bilateral(), 4_100);
    detector.driveFrame(bilateral(), 4_200);
    detector.driveFrame(lifted(), 4_300);

    for (let t = 4_400; t <= 5_000; t += 100) {
      detector.driveFrame(lifted(), t);
    }

    assert.equal(detector.getSnapshot().interruptionCount, 0);
    assert.equal(detector.getSnapshot().holdPhase, "hold_active");
  });

  it("counts recovery after re-lift following interruption", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);

    for (let t = 2_700; t <= 3_500; t += 100) {
      detector.driveFrame(lifted(), t);
    }

    const footDownEnd = 3_600 + LAB_SLS_HOLD_CONFIG.interruptionConfirmMs + 50;
    for (let t = 3_600; t <= footDownEnd; t += 50) {
      detector.driveFrame(bilateral(), t);
    }
    assert.equal(detector.getSnapshot().holdPhase, "interrupted");

    const recoveryEnd = footDownEnd + LAB_SLS_HOLD_CONFIG.recoveryConfirmMs + 50;
    for (let t = footDownEnd + 50; t <= recoveryEnd; t += 50) {
      detector.driveFrame(lifted(), t);
    }

    const snap = detector.getSnapshot();
    assert.equal(snap.holdPhase, "hold_active");
    assert.equal(snap.interruptionCount, 1);
    assert.equal(snap.recoveryCount, 1);
  });

  it("tracks right-leg stance assignment", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, {
      ...FAST_OPTIONS,
      stanceLeg: "right",
    });
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100, "right");
    assert.equal(detector.getSnapshot().stanceLeg, "right");
    assert.equal(detector.getSnapshot().holdPhase, "hold_active");
  });

  it("getDerivedMetrics always reports repCount 0", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);
    for (let t = 2_700; t <= 6_000; t += 100) {
      detector.driveFrame(lifted(), t);
    }
    const metrics = detector.getDerivedMetrics();
    assert.equal(metrics.repCount, 0);
    assert.equal(metrics.interruptionCount, 0);
    assert.ok(metrics.longestContinuousHoldS >= 3);
  });

  it("endSession moves to end phase and preserves accumulated hold", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);
    for (let t = 2_700; t <= 5_000; t += 100) {
      detector.driveFrame(lifted(), t);
    }
    const holdBefore = detector.getSnapshot().accumulatedHoldMs;
    detector.endSession();
    assert.equal(detector.getSnapshot().holdPhase, "end");
    assert.equal(detector.getSnapshot().accumulatedHoldMs, holdBefore);
  });

  it("reset clears hold state", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    runBaseline(detector, 0);
    confirmHoldStart(detector, 2_100);
    detector.reset();
    const snap = detector.getSnapshot();
    assert.equal(snap.holdPhase, "calibrating");
    assert.equal(snap.accumulatedHoldMs, 0);
    assert.equal(snap.interruptionCount, 0);
  });

  it("uses LAB config defaults from spec", () => {
    assert.equal(LAB_SLS_HOLD_CONFIG.baselineDurationMs, 2_000);
    assert.equal(LAB_SLS_HOLD_CONFIG.holdStartConfirmMs, 500);
    assert.equal(LAB_SLS_HOLD_CONFIG.minSaveHoldS, 3);
    assert.equal(LAB_SLS_HOLD_CONFIG.interruptionConfirmMs, 350);
    assert.equal(LAB_SLS_HOLD_CONFIG.recoveryConfirmMs, 500);
  });

  it("snapshot includes tracking quality after pose frames", () => {
    const detector = new SingleLegStanceHoldDetector(LAB_SLS_HOLD_CONFIG, FAST_OPTIONS);
    detector.driveFrame(lifted(), 0);
    const snap = detector.getSnapshot();
    assert.equal(snap.trackingStatus, "pose-found");
    assert.ok(snap.trackingQuality === "good" || snap.trackingQuality === "fair");
    assert.equal(snap.framesWithPose, 1);
  });
});
