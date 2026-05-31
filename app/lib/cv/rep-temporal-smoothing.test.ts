/**
 * Run: npx tsx --test app/lib/cv/rep-temporal-smoothing.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeRepConfidence,
  createRepTemporalSmoothingState,
  pushSmoothedSignal,
  repTransitionAllowed,
  requiredConsistentFrames,
  signalStability,
  thresholdMarginRatio,
} from "@/app/lib/cv/rep-temporal-smoothing";
import {
  createSagittalHipRepState,
  tickSagittalHipRepBaseline,
} from "@/app/lib/cv/sagittal-hip-rep-core";

const TORSO = 0.25;

function stsConfig() {
  return {
    baselineDurationMs: 3_000,
    fallbackBaselineHipY: 0.55,
    baselineScaleByTorso: false,
    baselinePrimaryDelta: 0.06,
    baselineResetDelta: 0.03,
    baselinePrimaryDeltaRatio: 0.18,
    baselineResetDeltaRatio: 0.08,
    baselinePrimaryDeltaMin: 0.035,
    baselineResetDeltaMin: 0.02,
    minMsBetweenReps: 800,
  };
}

function tickRise(
  state: ReturnType<typeof createSagittalHipRepState>,
  hipY: number,
  nowMs: number,
): void {
  tickSagittalHipRepBaseline({
    state,
    polarity: "rise",
    hipY,
    nowMs,
    torsoSpan: TORSO,
    config: stsConfig(),
    canCollectBaseline: false,
    canIncrementReps: () => true,
  });
}

describe("rep-temporal-smoothing", () => {
  it("median-smooths noisy signals over a window", () => {
    const temporal = createRepTemporalSmoothingState();
    pushSmoothedSignal(temporal, 0.5, 5);
    pushSmoothedSignal(temporal, 0.52, 5);
    const smoothed = pushSmoothedSignal(temporal, 0.48, 5);
    assert.ok(Math.abs(smoothed - 0.5) < 0.02);
  });

  it("maps stability and margin to confidence bands", () => {
    assert.equal(computeRepConfidence(0.9, 0.8), "strong");
    assert.equal(computeRepConfidence(0.5, 0.4), "moderate");
    assert.equal(computeRepConfidence(0.2, 0.1), "weak");
  });

  it("requires more frames when confidence is weak", () => {
    assert.equal(requiredConsistentFrames("strong"), 2);
    assert.equal(requiredConsistentFrames("moderate"), 3);
    assert.equal(requiredConsistentFrames("weak"), 4);
    assert.equal(repTransitionAllowed(1, "strong"), false);
    assert.equal(repTransitionAllowed(2, "strong"), true);
    assert.equal(repTransitionAllowed(2, "weak", 0.25), true);
  });

  it("does not count a rep on a single-frame spike", () => {
    const state = createSagittalHipRepState();
    state.baselineHipY = 0.55;
    state.repPhase = "rest";

    tickRise(state, 0.48, 1_000);
    assert.equal(state.repCount, 0);
  });

  it("counts a rep after consistent frames above threshold", () => {
    const state = createSagittalHipRepState();
    state.baselineHipY = 0.55;
    state.repPhase = "rest";

    tickRise(state, 0.48, 1_000);
    tickRise(state, 0.47, 1_016);
    assert.equal(state.repCount, 1);
    assert.equal(state.repPhase, "peak");
  });

  it("rejects jitter that crosses threshold for one frame only", () => {
    const state = createSagittalHipRepState();
    state.baselineHipY = 0.55;
    state.repPhase = "rest";

    tickRise(state, 0.54, 900);
    tickRise(state, 0.48, 916);
    tickRise(state, 0.54, 932);
    assert.equal(state.repCount, 0);
  });

  it("computes threshold margin for rise polarity", () => {
    const margin = thresholdMarginRatio("rise", 0.47, 0.49, 0.52, 0.06);
    assert.ok(margin > 0.3);
  });

  it("reports higher stability for steady buffers", () => {
    const steady = signalStability([0.5, 0.501, 0.499, 0.5]);
    const jittery = signalStability([0.5, 0.54, 0.46, 0.52]);
    assert.ok(steady > jittery);
  });
});
