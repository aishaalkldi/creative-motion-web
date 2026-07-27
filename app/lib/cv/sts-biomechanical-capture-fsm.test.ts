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
  samples: Array<{
    hipY: number;
    nowMs: number;
    posePresent?: boolean;
    canCount?: boolean;
  }>,
): void {
  for (const sample of samples) {
    fsm.tick(state, {
      hipY: sample.hipY,
      nowMs: sample.nowMs,
      torsoSpan: 0.25,
      canCollectBaseline: true,
      canCount: sample.canCount ?? true,
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
    assert.ok(thresholds.returnTrigger < thresholds.seatConfirm);
    assert.ok(thresholds.returnTrigger > thresholds.standConfirm);
  });

  it("keeps returnTrigger below seatConfirm when stand band is narrow (PR88)", () => {
    const narrowConfig = baselineConfigFromSts({
      baselineStandDelta: 0.03,
      baselineResetDelta: 0.03,
      baselineScaleByTorso: true,
      baselineStandDeltaRatio: 0.08,
      baselineResetDeltaRatio: 0.08,
      baselineStandDeltaMin: 0.02,
      baselineResetDeltaMin: 0.015,
    });
    const thresholds = resolveStsAdaptiveThresholds(
      0.55,
      narrowConfig,
      0.22,
      "limited",
      CAPTURE_CONFIG,
    );
    assert.ok(thresholds.returnTrigger < thresholds.seatConfirm);
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
      ...frames(520, 3, 0.502, 40),
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
      ...frames(520, 3, 0.502, 40),
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
      ...frames(520, 3, 0.502, 40),
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

describe("StsBiomechanicalCaptureFsm — PR88 returning / seated-return", () => {
  const HOME_CONFIG = {
    ...PATIENT_STS_BIOMECH_CAPTURE_CONFIG,
    minCompleteCycleMs: 500,
    minMsBetweenReps: 400,
    baselineDurationMs: 100,
  };

  it("counts complete rep when standing is confirmed then hipY returns to baseline", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, homeStsCycle(400));

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
    assert.equal(state.attempts[0]!.standingReached, true);
    assert.equal(state.attempts[0]!.returningDetected, true);
    assert.equal(state.attempts[0]!.seatedReturnReached, true);
  });

  it("detects returning after standing hold then seated descent", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 4, 0.54, 40),
      ...frames(600, 4, 0.49, 50),
      ...frames(820, 3, 0.47, 50),
      ...frames(970, 8, 0.47, 50),
      ...frames(1_320, 5, 0.54, 50),
    ]);

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts[0]!.returningDetected, true);
    assert.equal(state.attempts[0]!.seatedReturnReached, true);
  });

  it("counts complete rep with narrow stand/seat band (returnTrigger clamp)", () => {
    const narrowBaseline = baselineConfigFromSts({
      baselineStandDelta: 0.03,
      baselineResetDelta: 0.03,
      baselineScaleByTorso: true,
      baselineStandDeltaRatio: 0.08,
      baselineResetDeltaRatio: 0.08,
      baselineStandDeltaMin: 0.02,
      baselineResetDeltaMin: 0.015,
      minMsBetweenReps: 400,
      fallbackSeatedHipY: 0.55,
    });
    const fsm = new StsBiomechanicalCaptureFsm(narrowBaseline, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 4, 0.54, 40),
      ...frames(600, 4, 0.51, 50),
      ...frames(820, 3, 0.49, 50),
      ...frames(970, 6, 0.49, 50),
      ...frames(1_270, 5, 0.54, 50),
    ]);

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
    assert.equal(state.attempts[0]!.returningDetected, true);
    assert.equal(state.attempts[0]!.seatedReturnReached, true);
  });

  it("does not count partial rise without standing", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 3, 0.54, 40),
      ...frames(520, 3, 0.502, 40),
      ...frames(640, 4, 0.54, 40),
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts[0]!.standingReached, false);
    assert.equal(state.attempts[0]!.returningDetected, false);
  });

  it("keeps standing-without-return as partial", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, [
      ...frames(400, 4, 0.54, 40),
      ...frames(600, 4, 0.49, 50),
      ...frames(820, 10, 0.47, 50),
    ]);
    fsm.finalizeSession(state, 2_000);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts[0]!.attemptType, "partial");
    assert.equal(state.attempts[0]!.standingReached, true);
    assert.equal(state.attempts[0]!.returningDetected, false);
    assert.equal(state.attempts[0]!.seatedReturnReached, false);
  });

  it("does not count seated jitter as rep", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, HOME_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(
      fsm,
      state,
      Array.from({ length: 30 }, (_, i) => ({
        hipY: 0.54 + (i % 2 === 0 ? 0.004 : -0.004),
        nowMs: 400 + i * 40,
      })),
    );

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 0);
  });
});

describe("StsBiomechanicalCaptureFsm — readiness drop tolerance", () => {
  /** Full seated -> rising -> standing -> returning -> seated cycle, matching the existing baseline test. */
  function fullCycleFrames(
    standingSegment: Array<{ hipY: number; nowMs: number; canCount?: boolean }>,
  ) {
    return [
      ...frames(400, 5, 0.54),
      ...frames(480, 4, 0.49),
      ...frames(544, 4, 0.48),
      ...standingSegment,
      ...frames(928, 4, 0.50),
      ...frames(992, 4, 0.52),
      ...frames(1_056, 6, 0.54),
    ];
  }

  function withCanCountFalseAt(
    seq: Array<{ hipY: number; nowMs: number }>,
    falseIndices: number[],
  ): Array<{ hipY: number; nowMs: number; canCount: boolean }> {
    return seq.map((sample, i) => ({
      ...sample,
      canCount: !falseIndices.includes(i),
    }));
  }

  it("counts a realistic seated -> rising -> standing -> returning -> seated cycle with no interruption", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(fsm, state, fullCycleFrames(frames(608, 20, 0.47)));

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
  });

  it("tolerates a one-frame readiness drop mid-attempt and still counts the rep", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(
      fsm,
      state,
      fullCycleFrames(withCanCountFalseAt(frames(608, 20, 0.47), [10])),
    );

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
  });

  it("tolerates a two-frame readiness drop mid-attempt and still recovers to count the rep", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    tickSequence(
      fsm,
      state,
      fullCycleFrames(withCanCountFalseAt(frames(608, 20, 0.47), [10, 11])),
    );

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
  });

  it("aborts the active attempt as unclear once a readiness drop reaches the tolerance (3 frames)", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    // Sequence ends immediately after the abort — no further frames — so we
    // assert exactly the abort outcome without any downstream re-triggering.
    tickSequence(fsm, state, [
      ...frames(400, 5, 0.54),
      ...frames(480, 4, 0.49),
      ...frames(544, 4, 0.48),
      ...withCanCountFalseAt(frames(608, 13, 0.47), [10, 11, 12]),
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "unclear");
    assert.equal(
      state.attempts[0]!.reason,
      "Readiness or calibration gate interrupted attempt evidence.",
    );
  });

  it("does not accumulate readiness drops across separate short interruptions", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    // Two separate 2-frame drops (each below the 3-frame tolerance), separated
    // by several healthy frames that must reset the streak in between.
    tickSequence(
      fsm,
      state,
      fullCycleFrames(
        withCanCountFalseAt(frames(608, 20, 0.47), [3, 4, 10, 11]),
      ),
    );

    assert.equal(state.repCount, 1);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "complete");
  });

  it("aborts immediately on posePresent=false, without applying the readiness-drop tolerance", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    // Sequence ends immediately after the single pose-lost frame.
    tickSequence(fsm, state, [
      ...frames(400, 5, 0.54),
      ...frames(480, 4, 0.49),
      ...frames(544, 4, 0.48),
      { hipY: 0.47, nowMs: 608, posePresent: false },
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "unclear");
    assert.equal(
      state.attempts[0]!.reason,
      "Unable to assess due to camera angle or limited landmark visibility.",
    );
  });

  it("does not corrupt phase durations or hip displacement when a drop is tolerated", () => {
    const baselineFsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const baselineState = createStsBiomechanicalCaptureState();
    calibrate(baselineFsm, baselineState);
    tickSequence(baselineFsm, baselineState, fullCycleFrames(frames(608, 20, 0.47)));

    const toleratedFsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const toleratedState = createStsBiomechanicalCaptureState();
    calibrate(toleratedFsm, toleratedState);
    tickSequence(
      toleratedFsm,
      toleratedState,
      fullCycleFrames(withCanCountFalseAt(frames(608, 20, 0.47), [10, 11])),
    );

    assert.equal(baselineState.repCount, 1);
    assert.equal(toleratedState.repCount, 1);

    const baselineAttempt = baselineState.attempts[0]!;
    const toleratedAttempt = toleratedState.attempts[0]!;

    assert.deepEqual(toleratedAttempt.phaseDurationsMs, baselineAttempt.phaseDurationsMs);
    assert.equal(
      toleratedAttempt.hipVerticalDisplacement,
      baselineAttempt.hipVerticalDisplacement,
    );
  });

  it("still finalizes a stalled attempt via attemptTimeoutMs, unaffected by the readiness-drop change", () => {
    const fsm = new StsBiomechanicalCaptureFsm(BASELINE_CONFIG, CAPTURE_CONFIG);
    const state = createStsBiomechanicalCaptureState();
    calibrate(fsm, state);

    // Rises just enough to leave "seated" but never reaches standConfirm and
    // never returns to seatConfirm — holds in "rising" purely on elapsed time
    // (canCount stays true throughout; only the pre-existing attemptTimeoutMs
    // check should end this, confirming the readiness-drop change didn't
    // interfere with it).
    tickSequence(fsm, state, [
      ...frames(400, 3, 0.54, 40),
      ...frames(520, 40, 0.502, 500),
    ]);

    assert.equal(state.repCount, 0);
    assert.equal(state.attempts.length, 1);
    assert.equal(state.attempts[0]!.attemptType, "unclear");
    assert.equal(
      state.attempts[0]!.reason,
      "Insufficient visibility or phase transition evidence during rising.",
    );
  });
});
