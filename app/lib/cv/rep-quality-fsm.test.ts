/**
 * MQ-REP-1 — RepQualityFsm unit tests (node:test).
 * Run: npx tsx --test app/lib/cv/rep-quality-fsm.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_REP_QUALITY_FSM_CONFIG,
  RepQualityFsm,
  simulateLegacyRepCount,
  type RepQualityFsmConfig,
  type RepQualityTickInput,
} from "./rep-quality-fsm";

const BASELINE_HIP = 0.55;
const STAND_DELTA = 0.06;
const RESET_DELTA = 0.03;
const STAND_THRESHOLD = BASELINE_HIP - STAND_DELTA;
const SEATED_THRESHOLD = BASELINE_HIP - RESET_DELTA;

function tick(
  fsm: RepQualityFsm,
  hipY: number,
  nowMs: number,
  overrides: Partial<RepQualityTickInput> = {},
): void {
  fsm.tick({
    hipY,
    nowMs,
    standThreshold: STAND_THRESHOLD,
    seatedThreshold: SEATED_THRESHOLD,
    standDelta: STAND_DELTA,
    returnDelta: RESET_DELTA,
    hipVisibilitySum: 1.2,
    posePresent: true,
    canCount: true,
    ...overrides,
  });
}

function fastConfig(): RepQualityFsmConfig {
  return {
    ...DEFAULT_REP_QUALITY_FSM_CONFIG,
    minRepDurationMs: 1200,
    repTimeoutMs: 5_000,
  };
}

describe("RepQualityFsm", () => {
  it("captures a normal complete sit-to-stand cycle", () => {
    const fsm = new RepQualityFsm(fastConfig());
    tick(fsm, 0.54, 0);
    tick(fsm, 0.51, 500);
    tick(fsm, 0.48, 1000);
    tick(fsm, 0.5, 1500);
    tick(fsm, 0.53, 2200);

    assert.equal(fsm.getReps().length, 1);
    const rep = fsm.getReps()[0]!;
    assert.equal(rep.completedCycle, true);
    assert.ok(rep.captureFlags.includes("complete_rep"));
    assert.equal(rep.unclearReason, null);
    assert.equal(fsm.getState(), "completed_rep");
  });

  it("flags incomplete_stand when peak threshold is never reached", () => {
    const fsm = new RepQualityFsm(fastConfig());
    tick(fsm, 0.54, 0);
    tick(fsm, 0.51, 400);
    tick(fsm, 0.505, 800);
    tick(fsm, 0.53, 1200);

    assert.equal(fsm.getReps().length, 1);
    const rep = fsm.getReps()[0]!;
    assert.equal(rep.completedCycle, false);
    assert.ok(rep.captureFlags.includes("incomplete_stand"));
    assert.ok(!rep.captureFlags.includes("complete_rep"));
  });

  it("flags incomplete_return when seated return is missing", () => {
    const fsm = new RepQualityFsm({
      ...fastConfig(),
      repTimeoutMs: 2_000,
    });
    tick(fsm, 0.54, 0);
    tick(fsm, 0.51, 400);
    tick(fsm, 0.48, 900);
    tick(fsm, 0.5, 1500);
    tick(fsm, 0.51, 3_500);

    const rep = fsm.getReps()[0]!;
    assert.equal(rep.completedCycle, false);
    assert.ok(rep.captureFlags.includes("incomplete_return"));
    assert.equal(rep.unclearReason, "timeout_no_return");
  });

  it("flags too_fast for a short full cycle", () => {
    const fsm = new RepQualityFsm({
      ...DEFAULT_REP_QUALITY_FSM_CONFIG,
      minRepDurationMs: 1200,
      repTimeoutMs: 5_000,
    });
    tick(fsm, 0.54, 0);
    tick(fsm, 0.51, 150);
    tick(fsm, 0.48, 300);
    tick(fsm, 0.5, 450);
    tick(fsm, 0.53, 900);

    const rep = fsm.getReps()[0]!;
    assert.ok(rep.captureFlags.includes("too_fast"));
    assert.ok(!rep.captureFlags.includes("complete_rep"));
  });

  it("flags unclear_visibility when landmark visibility is limited", () => {
    const fsm = new RepQualityFsm(fastConfig());
    const lowVis = { hipVisibilitySum: 0.4 };
    tick(fsm, 0.54, 0, lowVis);
    tick(fsm, 0.51, 500, lowVis);
    tick(fsm, 0.48, 1000, lowVis);
    tick(fsm, 0.5, 1500, lowVis);
    tick(fsm, 0.53, 2200, lowVis);

    const rep = fsm.getReps()[0]!;
    assert.ok(rep.captureFlags.includes("unclear_visibility"));
    assert.ok(!rep.captureFlags.includes("complete_rep"));
  });

  it("finalizes unclear rep on pose lost mid-rep", () => {
    const fsm = new RepQualityFsm(fastConfig());
    tick(fsm, 0.54, 0);
    tick(fsm, 0.51, 500);
    fsm.handlePoseLost(800);

    const rep = fsm.getReps()[0]!;
    assert.equal(rep.unclearReason, "pose_lost");
    assert.equal(rep.completedCycle, false);
    assert.equal(fsm.getState(), "unclear_rep");
  });

  it("does not expose repCount increment — legacy counter stays independent", () => {
    const samples = [
      { hipY: 0.54, nowMs: 0 },
      { hipY: 0.51, nowMs: 900 },
      { hipY: 0.48, nowMs: 1000 },
      { hipY: 0.5, nowMs: 1500 },
      { hipY: 0.53, nowMs: 2200 },
      { hipY: 0.54, nowMs: 4000 },
      { hipY: 0.51, nowMs: 4900 },
      { hipY: 0.47, nowMs: 5000 },
      { hipY: 0.5, nowMs: 5500 },
      { hipY: 0.53, nowMs: 6200 },
    ];

    const legacyCount = simulateLegacyRepCount(samples, {
      standThreshold: STAND_THRESHOLD,
      seatedThreshold: SEATED_THRESHOLD,
      minMsBetweenReps: 800,
    });

    const fsm = new RepQualityFsm(fastConfig());
    for (const s of samples) {
      tick(fsm, s.hipY, s.nowMs);
    }

    assert.equal(legacyCount, 2);
    assert.equal(fsm.getReps().length, 2);
    assert.equal(
      (fsm as unknown as { repCount?: number }).repCount,
      undefined,
      "FSM must not own legacy repCount",
    );

    const summary = fsm.buildSessionSummary({
      legacyRepCount: legacyCount,
      sessionDurationS: 10,
      framesWithPose: 100,
      framesTotal: 110,
      trackingQualityLast: "fair",
    });
    assert.equal(summary.legacyRepCount, 2);
    assert.equal(summary.schemaVersion, "mq-rep-1");
  });
});
