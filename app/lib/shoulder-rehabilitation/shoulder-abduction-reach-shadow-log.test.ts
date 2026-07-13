/**
 * Run: npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-shadow-log.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  ShoulderAbductionReachFrameResult,
  ShoulderAbductionReachSideResult,
} from "./shoulder-abduction-reach-detector";
import {
  createShoulderAbductionReachShadowSessionLog,
  recordShoulderAbductionReachShadowFrame,
  summarizeShoulderAbductionReachShadowSessionLog,
  type ShoulderAbductionReachShadowPreviousSnapshot,
} from "./shoulder-abduction-reach-shadow-log";

function side(overrides: Partial<ShoulderAbductionReachSideResult> = {}): ShoulderAbductionReachSideResult {
  return {
    side: "left",
    abductionAngleDegrees: 10,
    wristOffsetFromShoulder: null,
    phase: "resting",
    repCount: 0,
    peakAngleDegrees: null,
    ...overrides,
  };
}

function frame(
  frameIndex: number,
  overrides: {
    frameContractValid?: boolean;
    left?: Partial<ShoulderAbductionReachSideResult>;
    right?: Partial<ShoulderAbductionReachSideResult>;
  } = {},
): ShoulderAbductionReachFrameResult {
  return {
    frameIndex,
    capturedAtMs: frameIndex * 33,
    frameContractValid: overrides.frameContractValid ?? true,
    left: side({ side: "left", ...overrides.left }),
    right: side({ side: "right", ...overrides.right }),
    bilateralAngleDifferenceDegrees: null,
  };
}

describe("createShoulderAbductionReachShadowSessionLog", () => {
  it("starts empty", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    assert.equal(log.frameCount, 0);
    assert.equal(log.frameContractInvalidCount, 0);
    assert.deepEqual(log.repCompletedCount, { left: 0, right: 0 });
    assert.deepEqual(log.repEvents, []);
    assert.deepEqual(log.phaseChangeEvents, []);
  });
});

describe("recordShoulderAbductionReachShadowFrame", () => {
  it("counts every frame and tallies invalid frame contracts", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    const previous = recordShoulderAbductionReachShadowFrame(log, frame(0, { frameContractValid: true }), null);
    recordShoulderAbductionReachShadowFrame(log, frame(1, { frameContractValid: false }), previous);

    assert.equal(log.frameCount, 2);
    assert.equal(log.frameContractInvalidCount, 1);
  });

  it("does not record a rep or phase event on the first frame (no previous snapshot)", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    recordShoulderAbductionReachShadowFrame(
      log,
      frame(0, { left: { repCount: 1, phase: "resting" } }),
      null,
    );
    assert.equal(log.repCompletedCount.left, 0);
    assert.deepEqual(log.phaseChangeEvents, []);
  });

  it("detects a rep completion from a repCount increase between frames", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    let previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(0, { left: { repCount: 0, phase: "lowering" } }),
      null,
    );
    previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(1, { left: { repCount: 1, phase: "resting", peakAngleDegrees: 95 } }),
      previous,
    );

    assert.equal(log.repCompletedCount.left, 1);
    assert.equal(log.repEvents.length, 1);
    assert.equal(log.repEvents[0].side, "left");
    assert.equal(log.repEvents[0].repCount, 1);
    assert.equal(log.repEvents[0].peakAngleDegrees, 95);
    void previous;
  });

  it("detects a phase change independent of rep completion", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    let previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(0, { left: { phase: "resting" } }),
      null,
    );
    previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(1, { left: { phase: "raising" } }),
      previous,
    );

    assert.equal(log.phaseChangeEvents.length, 1);
    assert.equal(log.phaseChangeEvents[0].fromPhase, "resting");
    assert.equal(log.phaseChangeEvents[0].toPhase, "raising");
    assert.equal(log.repCompletedCount.left, 0);
    void previous;
  });

  it("tracks left and right sides independently", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    let previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(0, { left: { repCount: 0 }, right: { repCount: 0 } }),
      null,
    );
    previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(1, { left: { repCount: 1 }, right: { repCount: 0 } }),
      previous,
    );

    assert.equal(log.repCompletedCount.left, 1);
    assert.equal(log.repCompletedCount.right, 0);
    void previous;
  });

  it("caps the recorded event sample without capping the authoritative counters", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    let previous: ShoulderAbductionReachShadowPreviousSnapshot | null = recordShoulderAbductionReachShadowFrame(
      log,
      frame(0, { left: { repCount: 0 } }),
      null,
    );
    for (let i = 1; i <= 60; i += 1) {
      previous = recordShoulderAbductionReachShadowFrame(log, frame(i, { left: { repCount: i } }), previous);
    }

    assert.equal(log.repCompletedCount.left, 60);
    assert.equal(log.repEvents.length, 50);
  });
});

describe("summarizeShoulderAbductionReachShadowSessionLog", () => {
  it("computes a zero invalid rate for an empty log", () => {
    const summary = summarizeShoulderAbductionReachShadowSessionLog(createShoulderAbductionReachShadowSessionLog());
    assert.equal(summary.frameCount, 0);
    assert.equal(summary.frameContractInvalidRate, 0);
  });

  it("computes the invalid frame rate and rep totals across a session", () => {
    const log = createShoulderAbductionReachShadowSessionLog();
    let previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(0, { frameContractValid: true, left: { repCount: 0 } }),
      null,
    );
    previous = recordShoulderAbductionReachShadowFrame(
      log,
      frame(1, { frameContractValid: false, left: { repCount: 1 } }),
      previous,
    );
    void previous;

    const summary = summarizeShoulderAbductionReachShadowSessionLog(log);
    assert.equal(summary.frameCount, 2);
    assert.equal(summary.frameContractInvalidRate, 0.5);
    assert.equal(summary.repCompletedCount.left, 1);
  });
});
