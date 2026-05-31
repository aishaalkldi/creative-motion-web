/**
 * sagittal-hip-rep-core unit tests.
 * Run: npx tsx --test app/lib/cv/sagittal-hip-rep-core.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baselineConfigFromSts,
  createSagittalHipRepState,
  repPhaseToStandPhase,
  resolveBaselineDeltas,
  resolveBaselineThresholds,
  standPhaseToRepPhase,
  tickSagittalHipRepAbsolute,
  tickSagittalHipRepBaseline,
} from "./sagittal-hip-rep-core";

const TORSO = 0.25;

function stsBaselineConfig() {
  return baselineConfigFromSts({
    baselineStandDelta: 0.06,
    baselineResetDelta: 0.03,
    minMsBetweenReps: 800,
    fallbackSeatedHipY: 0.55,
    baselineScaleByTorso: false,
  });
}

function miniSquatConfig() {
  return baselineConfigFromSts({
    baselineStandDelta: 0.06,
    baselineResetDelta: 0.03,
    minMsBetweenReps: 800,
    fallbackSeatedHipY: 0.45,
    baselineScaleByTorso: false,
  });
}

describe("sagittal-hip-rep-core", () => {
  it("maps stand phase to rep phase for STS", () => {
    assert.equal(standPhaseToRepPhase("down"), "rest");
    assert.equal(standPhaseToRepPhase("up"), "peak");
    assert.equal(repPhaseToStandPhase("rest"), "down");
    assert.equal(repPhaseToStandPhase("peak"), "up");
  });

  it("resolveBaselineThresholds inverts for drop polarity", () => {
    const rise = resolveBaselineThresholds("rise", 0.55, 0.06, 0.03);
    assert.ok(Math.abs(rise.enterPeak - 0.49) < 1e-9);
    assert.ok(Math.abs(rise.returnRest - 0.52) < 1e-9);

    const drop = resolveBaselineThresholds("drop", 0.45, 0.06, 0.03);
    assert.equal(drop.enterPeak, 0.51);
    assert.equal(drop.returnRest, 0.48);
  });

  it("counts STS rise reps on baseline mode", () => {
    const state = createSagittalHipRepState();
    state.baselineHipY = 0.55;
    state.repPhase = "rest";

    tickSagittalHipRepBaseline({
      state,
      polarity: "rise",
      hipY: 0.48,
      nowMs: 1_000,
      torsoSpan: TORSO,
      config: stsBaselineConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    assert.equal(state.repCount, 1);
    assert.equal(state.repPhase, "peak");

    tickSagittalHipRepBaseline({
      state,
      polarity: "rise",
      hipY: 0.54,
      nowMs: 1_500,
      torsoSpan: TORSO,
      config: stsBaselineConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    assert.equal(state.repPhase, "rest");
  });

  it("counts mini squat drop reps on return to standing", () => {
    const state = createSagittalHipRepState();
    state.baselineHipY = 0.45;
    state.repPhase = "rest";

    tickSagittalHipRepBaseline({
      state,
      polarity: "drop",
      hipY: 0.52,
      nowMs: 500,
      torsoSpan: TORSO,
      config: miniSquatConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    assert.equal(state.repCount, 0);
    assert.equal(state.repPhase, "peak");

    tickSagittalHipRepBaseline({
      state,
      polarity: "drop",
      hipY: 0.44,
      nowMs: 1_500,
      torsoSpan: TORSO,
      config: miniSquatConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    assert.equal(state.repCount, 1);
    assert.equal(state.repPhase, "rest");
  });

  it("respects minMsBetweenReps debounce", () => {
    const state = createSagittalHipRepState();
    state.baselineHipY = 0.55;
    state.repPhase = "rest";

    tickSagittalHipRepBaseline({
      state,
      polarity: "rise",
      hipY: 0.48,
      nowMs: 1_000,
      torsoSpan: TORSO,
      config: stsBaselineConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    tickSagittalHipRepBaseline({
      state,
      polarity: "rise",
      hipY: 0.54,
      nowMs: 1_200,
      torsoSpan: TORSO,
      config: stsBaselineConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    tickSagittalHipRepBaseline({
      state,
      polarity: "rise",
      hipY: 0.48,
      nowMs: 1_400,
      torsoSpan: TORSO,
      config: stsBaselineConfig(),
      canCollectBaseline: false,
      canIncrementReps: () => true,
    });
    assert.equal(state.repCount, 1);
  });

  it("supports absolute rise mode (CV Lab legacy thresholds)", () => {
    const state = createSagittalHipRepState();
    tickSagittalHipRepAbsolute({
      state,
      polarity: "rise",
      hipY: 0.4,
      config: { peakThreshold: 0.42, restThreshold: 0.58 },
    });
    assert.equal(state.repCount, 1);
    tickSagittalHipRepAbsolute({
      state,
      polarity: "rise",
      hipY: 0.6,
      config: { peakThreshold: 0.42, restThreshold: 0.58 },
    });
    assert.equal(state.repPhase, "rest");
  });

  it("caps scaled deltas at fixed values", () => {
    const config = baselineConfigFromSts({
      baselineStandDelta: 0.06,
      baselineResetDelta: 0.03,
      baselineScaleByTorso: true,
      baselineStandDeltaRatio: 0.18,
      baselineResetDeltaRatio: 0.08,
    });
    const deltas = resolveBaselineDeltas(config, 0.5);
    assert.equal(deltas.primaryDelta, 0.06);
    assert.equal(deltas.resetDelta, 0.03);
  });
});
