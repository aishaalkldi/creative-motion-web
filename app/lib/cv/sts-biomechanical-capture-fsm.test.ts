/**
 * Run: npx tsx --test app/lib/cv/sts-biomechanical-capture-fsm.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baselineConfigFromSts,
  type SagittalHipRepBaselineConfig,
} from "@/app/lib/cv/sagittal-hip-rep-core";
import {
  computeRobustSeatedBaseline,
  createStsBiomechanicalCaptureState,
  DEFAULT_STS_BIOMECH_CAPTURE_CONFIG,
  PATIENT_STS_BIOMECH_CAPTURE_CONFIG,
  resolveStsAdaptiveThresholds,
  StsBiomechanicalCaptureFsm,
  type StsBiomechanicalCaptureState,
} from "@/app/lib/cv/sts-biomechanical-capture-fsm";

const BASELINE_CONFIG: SagittalHipRepBaselineConfig = baselineConfigFromSts({
  baselineStandDelta: 0.06,
  baselineResetDelta: 0.03,
  minMsBetweenReps: 800,
  fallbackSeatedHipY: 0.55,
  baselineScaleByTorso: false,
});

const CAPTURE_CONFIG = {
  ...DEFAULT_STS_BIOMECH_CAPTURE_CONFIG,
  minCompleteCycleMs: 500,
  minMsBetweenReps: 400,
  baselineDurationMs: 100,
};

function frames(
  startMs: number,
  count: number,
  hipY: number,
  stepMs = 16,
): Array<{ hipY: number; nowMs: number }> {
  return Array.from({ length: count }, (_, i) => ({
    hipY,
    nowMs: startMs + i * stepMs,
  }));
}

/** Home-camera-like timing — wider spacing so cycles meet minCompleteCycleMs. */
function homeStsCycle(startMs: number): Array<{ hipY: number; nowMs: number }> {
  return [
    ...frames(startMs, 4, 0.54, 40),
    ...frames(startMs + 200, 4, 0.49, 50),
    ...frames(startMs + 420, 3, 0.47, 50),
    ...frames(startMs + 600, 4, 0.51, 50),
    ...frames(startMs + 820, 5, 0.54, 50),
  ];
}

function tickSequence(
  fsm: StsBiomechanicalCaptureFsm,
  state: StsBiomechanicalCaptureState,
  samples: Array<{ hipY: number; nowMs: number; posePresent?: boolean }>,
): void {
  for (const sample of samples) {
    fsm.tick(state, {
      hipY: sample.hipY,
      nowMs: sample.nowMs,
      torsoSpan: 0.25,
      canCollectBaseline: true,
      canCount: true,
      posePresent: sample.posePresent ?? true,
      hipVisibilitySum: 1.2,
    });
  }
}

function calibrate(fsm: StsBiomechanicalCaptureFsm, state: StsBiomechanicalCaptureState): void {
  tickSequence(
    fsm,
    state,
    Array.from({ length: 20 }, (_, i) => ({ hipY: 0.54 + (i % 3) * 0.002, nowMs: i * 16 })),
  );
  assert.ok(state.seatedBaseline != null && Math.abs(state.seatedBaseline - 0.54) < 0.01);
  assert.equal(state.phase, "seated");
}

describe("computeRobustSeatedBaseline", () => {
  it("uses median and tolerates noisy seated samples", () => {
    const samples = [0.56, 0.55, 0.54, 0.57, 0.55, 0.54, 0.55, 0.56, 0.54, 0.55, 0.54, 0.55];
    const result = computeRobustSeatedBaseline(samples, 0.55);
    assert.ok(Math.abs(result.baseline - 0.55) < 0.02);
    assert.equal(result.quality, "strong");
  });

  it("degrades safely when calibration samples are missing", () => {
    const result = computeRobustSeatedBaseline([], 0.55);
    assert.equal(result.baseline, 0.55);
    assert.equal(result.quality, "fallback");
  });
});

describe("resolveStsAdaptiveThresholds", () => {
  it("builds thresholds relative to seated baseline", () => {
    const thresholds = resolveStsAdaptiveThresholds(
      0.55,
      BASELINE_CONFIG,
      0.25,
      "strong",
      CAPTURE_CONFIG,
    );
    assert.equal(thresholds.seatedBaseline, 0.55);
    assert.ok(thresholds.standConfirm < thresholds.seatedBaseline);
    assert.ok(thresholds.seatConfirm < thresholds.seatedBaseline);
    assert.ok(thresholds.riseTrigger < thresholds.seatConfirm);
  });
});

describe("StsBiomechanicalCaptureFsm", () => {
  it("counts one complete attempt for one full STS cycle", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 5, 0.54),
      ...frames(480, 4, 0.49),
      ...frames(544, 4, 0.48),
      ...frames(608, 20, 0.47),
      ...frames(928, 4, 0.50),
      ...frames(992, 4, 0.52),
      ...frames(1_056, 6, 0.54),
    ]);

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
    assert.equal(state.attempts[0]!.standingReached, true);
    assert.equal(state.attempts[0]!.seatedReturnReached, true);
  });

  it("counts two complete attempts for two full STS cycles", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    const cycle = (startMs: number) => [
      ...frames(startMs, 5, 0.54),
      ...frames(startMs + 80, 4, 0.49),
      ...frames(startMs + 144, 4, 0.48),
      ...frames(startMs + 208, 20, 0.47),
      ...frames(startMs + 528, 4, 0.50),
      ...frames(startMs + 592, 4, 0.52),
      ...frames(startMs + 656, 6, 0.54),
    ];

    tickSequence(fsm, state, cycle(400));
    tickSequence(fsm, state, cycle(1_600));

    assert.equal(state.repCount, 2);
    assert.equal(state.attempts.length, 2);
    assert.equal(state.attempts.every((a) => a.attemptType === "complete"), true);
  });

  it("records partial attempt when rising does not confirm standing", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 3, 0.54, 40),
      ...frames(520, 3, 0.501, 40),
      ...frames(640, 4, 0.54, 40),
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 1);
    assert.ok(
      state.attempts[0]!.attemptType === "partial" ||
        state.attempts[0]!.attemptType === "unclear",
    );
    assert.equal(state.attempts[0]!.risingDetected, true);
    assert.equal(state.attempts[0]!.standingReached, false);
  });

  it("records partial attempt when standing is reached without seated return", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 5, 0.54),
      ...frames(480, 4, 0.49),
      ...frames(544, 4, 0.48),
      ...frames(608, 12, 0.47),
    ]);
    fsm.finalizeSession(state, 2_000);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "partial");
    assert.equal(state.attempts[0]!.standingReached, true);
    assert.equal(state.attempts[0]!.seatedReturnReached, false);
  });

  it("does not count seated jitter as an attempt", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(
      fsm,
      state,
      Array.from({ length: 30 }, (_, i) => ({
        hipY: 0.54 + (i % 2 === 0 ? 0.005 : -0.005),
        nowMs: 400 + i * 16,
      })),
    );

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 0);
  });

  it("does not count multiple reps during standing hold", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      { hipY: 0.54, nowMs: 400 },
      { hipY: 0.49, nowMs: 500 },
      { hipY: 0.48, nowMs: 600 },
      { hipY: 0.47, nowMs: 700 },
      { hipY: 0.46, nowMs: 900 },
      { hipY: 0.46, nowMs: 1_100 },
      { hipY: 0.46, nowMs: 1_300 },
      { hipY: 0.46, nowMs: 1_500 },
      { hipY: 0.46, nowMs: 1_700 },
      { hipY: 0.46, nowMs: 1_900 },
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 0);
    assert.equal(state.phase, "standing");
  });
});

describe("StsBiomechanicalCaptureFsm — PR87 home-camera tolerance", () => {
  const HOME_CONFIG = {
    ...PATIENT_STS_BIOMECH_CAPTURE_CONFIG,
    minCompleteCycleMs: 500,
    minMsBetweenReps: 400,
    baselineDurationMs: 100,
  };

  it("counts first rep without cooldown blocking", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, homeStsCycle(400));

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
  });

  it("counts home-camera-like full STS sequence once", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, homeStsCycle(400));

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
    assert.equal(state.attempts[0]!.standingReached, true);
    assert.equal(state.attempts[0]!.seatedReturnReached, true);
  });

  it("counts two home-camera STS cycles", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, homeStsCycle(400));
    tickSequence(fsm, state, homeStsCycle(1_900));

    assert.equal(state.repCount, 2);
    assert.equal(state.attempts.length, 2);
    assert.equal(state.attempts.every((a) => a.attemptType === "complete"), true);
  });

  it("counts brief standing phase when rise and return are clear", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, homeStsCycle(400));

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
    assert.equal(state.attempts[0]!.seatedReturnReached, true);
  });

  it("does not count partial rise without enough displacement", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 3, 0.54, 40),
      ...frames(520, 3, 0.501, 40),
      ...frames(640, 4, 0.54, 40),
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 1);
    assert.ok(
      state.attempts[0]!.attemptType === "partial" ||
        state.attempts[0]!.attemptType === "unclear",
    );
    assert.equal(state.attempts[0]!.standingReached, false);
  });

  it("preserves partial and unclear attempts alongside complete reps", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 3, 0.54, 40),
      ...frames(520, 3, 0.501, 40),
      ...frames(640, 4, 0.54, 40),
      ...homeStsCycle(1_200),
    ]);

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 2);
    assert.ok(
      state.attempts[0]!.attemptType === "partial" ||
        state.attempts[0]!.attemptType === "unclear",
    );
    assert.equal(state.attempts[1]!.attemptType, "complete");
  });
});
