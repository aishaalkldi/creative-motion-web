/**
 * Run: npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-phase.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS } from "./shoulder-abduction-reach-contract";
import {
  createShoulderAbductionReachPhaseState,
  resetShoulderAbductionReachPhaseState,
  tickShoulderAbductionReachPhase,
} from "./shoulder-abduction-reach-phase";

const THRESHOLDS = DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS; // resting<=20, peak>=70, hysteresis 10, unknown after 8

function runSequence(angles: readonly (number | null)[]) {
  const state = createShoulderAbductionReachPhaseState();
  for (const angle of angles) {
    tickShoulderAbductionReachPhase(state, angle, THRESHOLDS);
  }
  return state;
}

describe("tickShoulderAbductionReachPhase — full rep", () => {
  it("counts one rep for resting -> raising -> peak -> lowering -> resting", () => {
    const state = runSequence([10, 30, 50, 75, 80, 55, 30, 15]);
    assert.equal(state.phase, "resting");
    assert.equal(state.repCount, 1);
    assert.equal(state.peakAngleDegrees, 80);
  });

  it("starts fresh from the initial state", () => {
    const state = createShoulderAbductionReachPhaseState();
    assert.equal(state.phase, "resting");
    assert.equal(state.repCount, 0);
    assert.equal(state.peakAngleDegrees, null);
  });
});

describe("tickShoulderAbductionReachPhase — partial attempt", () => {
  it("does not count a rep when the arm returns to rest without reaching the peak band", () => {
    const state = runSequence([10, 30, 40, 15]);
    assert.equal(state.phase, "resting");
    assert.equal(state.repCount, 0);
    assert.equal(state.peakAngleDegrees, 40);
  });
});

describe("tickShoulderAbductionReachPhase — re-raise during lowering", () => {
  it("counts exactly one rep even when the arm re-raises past the peak band before finishing", () => {
    const state = runSequence([30, 75, 50, 72, 40, 10]);
    assert.equal(state.repCount, 1);
    assert.equal(state.peakAngleDegrees, 75);
  });
});

describe("tickShoulderAbductionReachPhase — consecutive reps", () => {
  it("counts two independent reps back to back", () => {
    const state = runSequence([30, 75, 55, 15, 30, 75, 55, 15]);
    assert.equal(state.repCount, 2);
  });
});

describe("tickShoulderAbductionReachPhase — unusable frames", () => {
  it("freezes the current phase for brief dropouts under the unknown threshold", () => {
    const state = runSequence([30, 75, null, null, null]);
    assert.equal(state.phase, "peak_abduction");
  });

  it("moves to unknown after poseLostUnknownMinTicks consecutive unusable frames", () => {
    const nulls = Array.from({ length: THRESHOLDS.poseLostUnknownMinTicks }, () => null);
    const state = runSequence([30, 75, ...nulls]);
    assert.equal(state.phase, "unknown");
  });

  it("resumes tracking from unknown once a usable angle returns", () => {
    const nulls = Array.from({ length: THRESHOLDS.poseLostUnknownMinTicks }, () => null);
    const state = runSequence([10, ...nulls, 10]);
    assert.equal(state.phase, "resting");
  });

  it("resets the unusable-frame counter as soon as a usable angle arrives", () => {
    const state = createShoulderAbductionReachPhaseState();
    for (let i = 0; i < THRESHOLDS.poseLostUnknownMinTicks - 1; i += 1) {
      tickShoulderAbductionReachPhase(state, null, THRESHOLDS);
    }
    assert.equal(state.phase, "resting");
    tickShoulderAbductionReachPhase(state, 10, THRESHOLDS);
    assert.equal(state.consecutiveUnusableFrames, 0);
  });
});

describe("resetShoulderAbductionReachPhaseState", () => {
  it("restores the initial state", () => {
    const state = runSequence([10, 30, 50, 75, 80, 55, 30, 15]);
    resetShoulderAbductionReachPhaseState(state);
    assert.equal(state.phase, "resting");
    assert.equal(state.repCount, 0);
    assert.equal(state.peakAngleDegrees, null);
    assert.equal(state.hasReachedPeakThisRep, false);
    assert.equal(state.consecutiveUnusableFrames, 0);
  });
});
