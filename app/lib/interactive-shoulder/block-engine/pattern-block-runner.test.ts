/**
 * Run: npx tsx --test app/lib/interactive-shoulder/block-engine/pattern-block-runner.test.ts
 *
 * Re-runs scenarios from pattern-lifecycle-gating.test.ts and
 * pattern-progression-integrity.test.ts through PATTERN_BLOCK_RUNNER
 * instead of calling tickPatternLifecycleIfActive directly — proving the
 * wrapper introduces zero behavior drift in either the session-state
 * gating or the progression-integrity guarantees.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { samplePathAtProgress } from "../motion-patterns/bezier-path";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "../motion-patterns/d1-inspired-diagonal-reach-pattern";
import { resolveActiveMotionPattern } from "../motion-patterns/motion-pattern-registry";
import type { PatternLifecycleState } from "../motion-patterns/pattern-lifecycle";
import { getBlockRunnerForBlockType, registerBlockRunner } from "./block-runner-registry";
import {
  PATTERN_BLOCK_RUNNER,
  registerPatternBlockRunner,
  resolvePatternBlockRunner,
} from "./pattern-block-runner";

const T0 = 6_000_000;

function rightPattern() {
  return resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
}

function leftPattern() {
  return resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "left")!;
}

function wristAt(pattern: ReturnType<typeof rightPattern>, progress: number) {
  return samplePathAtProgress(pattern.sampledPath, progress);
}

function advanceSequentially(
  state: PatternLifecycleState,
  pattern: ReturnType<typeof rightPattern>,
  fromProgress: number,
  toProgress: number,
  steps: number,
  startMs = T0,
): { state: PatternLifecycleState; completionCount: number } {
  let next = state;
  let completionCount = 0;
  for (let i = 0; i <= steps; i += 1) {
    const progress = fromProgress + ((toProgress - fromProgress) * i) / steps;
    const ticked = PATTERN_BLOCK_RUNNER.tick("active", next, {
      wrist: wristAt(pattern, progress),
      nowMs: startMs + i * 50,
      pattern,
      completionExitTransitionMs: 0,
    });
    next = ticked.state;
    if (ticked.completionEvent) completionCount += 1;
  }
  return { state: next, completionCount };
}

describe("pattern-block-runner", () => {
  it('registers under "movement-pattern" and resolves through the shared registry', () => {
    registerBlockRunner(PATTERN_BLOCK_RUNNER);
    assert.equal(getBlockRunnerForBlockType("movement-pattern"), PATTERN_BLOCK_RUNNER);
  });

  it("active → may advance from the path start (replays pattern-lifecycle-gating.test.ts)", () => {
    const pattern = rightPattern();
    const state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    const ticked = PATTERN_BLOCK_RUNNER.tick("active", state, {
      wrist: wristAt(pattern, 0.1),
      nowMs: T0,
      pattern,
    });
    assert.equal(ticked.ticked, true);
    assert.equal(ticked.state.hasAcquiredStart, true);
  });

  for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
    it(`${sessionState} → no pattern advancement or completion (replays pattern-lifecycle-gating.test.ts)`, () => {
      const pattern = rightPattern();
      const state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
      const ticked = PATTERN_BLOCK_RUNNER.tick(sessionState, state, {
        wrist: wristAt(pattern, 0.95),
        nowMs: T0,
        pattern,
      });
      assert.equal(ticked.ticked, false);
      assert.equal(ticked.completionEvent, null);
      assert.equal(ticked.state.pathProgress, 0);
    });
  }

  it("first sample near the final point does not advance or complete (replays pattern-progression-integrity.test.ts #1)", () => {
    const pattern = rightPattern();
    const state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    const ticked = PATTERN_BLOCK_RUNNER.tick("active", state, {
      wrist: wristAt(pattern, 0.98),
      nowMs: T0,
      pattern,
    });
    assert.equal(ticked.completionEvent, null);
    assert.equal(ticked.state.hasAcquiredStart, false);
    assert.equal(ticked.state.furthestProgress, 0);
  });

  it("a large jump from early to late progress is rejected (replays pattern-progression-integrity.test.ts #2)", () => {
    const pattern = rightPattern();
    let state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    state = PATTERN_BLOCK_RUNNER.tick("active", state, {
      wrist: wristAt(pattern, 0.08),
      nowMs: T0,
      pattern,
    }).state;
    assert.equal(state.hasAcquiredStart, true);

    const jumped = PATTERN_BLOCK_RUNNER.tick("active", state, {
      wrist: wristAt(pattern, 0.92),
      nowMs: T0 + 100,
      pattern,
    });
    assert.equal(jumped.completionEvent, null);
    assert.equal(jumped.state.awaitingReacquisition, true);
    assert.ok(jumped.state.furthestProgress < 0.2);
  });

  it("valid sequential movement completes the pattern exactly once (replays pattern-progression-integrity.test.ts #4, #12)", () => {
    const pattern = rightPattern();
    const state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    const walked = advanceSequentially(state, pattern, 0.05, 0.98, 24);
    assert.equal(walked.completionCount, 1);
    assert.equal(walked.state.interaction.patternsCompleted, 1);
  });

  it("left-side mirrored traversal completes correctly (replays pattern-progression-integrity.test.ts #14)", () => {
    const pattern = leftPattern();
    const state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    const walked = advanceSequentially(state, pattern, 0.05, 0.98, 24);
    assert.equal(walked.completionCount, 1);
    assert.equal(walked.state.interaction.patternsCompleted, 1);
  });

  it("returns null for an unregistered blockType from within this isolated process", () => {
    assert.equal(getBlockRunnerForBlockType("movement-target"), null);
    assert.equal(getBlockRunnerForBlockType("instructional"), null);
  });

  it('resolvePatternBlockRunner resolves "movement-pattern" and fails safely for anything else', () => {
    registerPatternBlockRunner();
    assert.equal(resolvePatternBlockRunner("movement-pattern"), PATTERN_BLOCK_RUNNER);

    // Never silently hands back the pattern runner for a block that isn't
    // declared movement-pattern — including undefined (no blockType set).
    assert.equal(resolvePatternBlockRunner(undefined), null);
    assert.equal(resolvePatternBlockRunner("movement-target"), null);
    assert.equal(resolvePatternBlockRunner("instructional"), null);
  });

  it("registerPatternBlockRunner is idempotent — a second call does not throw", () => {
    assert.doesNotThrow(() => registerPatternBlockRunner());
    assert.equal(resolvePatternBlockRunner("movement-pattern"), PATTERN_BLOCK_RUNNER);
  });

  it("tracking loss pauses progression, and unsafe reacquisition near the final point is rejected (replays pattern-progression-integrity.test.ts #9, #10)", () => {
    const pattern = rightPattern();
    let state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.25, 6).state;
    const frozen = state.furthestProgress;

    const lost = PATTERN_BLOCK_RUNNER.tick("active", state, { wrist: null, nowMs: T0 + 1_000, pattern });
    assert.equal(lost.state.furthestProgress, frozen, "progression is paused, not reset, during tracker loss");
    assert.equal(lost.state.awaitingReacquisition, true);

    const reacquiredUnsafely = PATTERN_BLOCK_RUNNER.tick("active", lost.state, {
      wrist: wristAt(pattern, 0.97),
      nowMs: T0 + 1_100,
      pattern,
    });
    assert.equal(reacquiredUnsafely.completionEvent, null, "reacquisition far from the frozen point cannot false-complete the pattern");
    assert.equal(reacquiredUnsafely.state.awaitingReacquisition, true);
    assert.ok(reacquiredUnsafely.state.furthestProgress < pattern.progression.completionProgress);
  });

  it("reacquisition near the previously accepted section resumes without false completion (replays pattern-progression-integrity.test.ts #11)", () => {
    const pattern = rightPattern();
    let state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.35, 8).state;
    const checkpoint = state.furthestProgress;

    state = PATTERN_BLOCK_RUNNER.tick("active", state, { wrist: null, nowMs: T0 + 2_000, pattern }).state;
    const reacquired = PATTERN_BLOCK_RUNNER.tick("active", state, {
      wrist: wristAt(pattern, checkpoint),
      nowMs: T0 + 2_100,
      pattern,
    });
    assert.equal(reacquired.completionEvent, null);
    assert.equal(reacquired.state.awaitingReacquisition, false, "reacquiring near the frozen checkpoint resumes tracking");

    const resumed = advanceSequentially(reacquired.state, pattern, checkpoint, 0.98, 16, T0 + 2_200);
    assert.equal(resumed.completionCount, 1, "the pattern can still complete normally after a safe reacquisition");
  });

  it("patternsCompleted is a distinct field, structurally separate from targetsContacted/validRepetitions", () => {
    const pattern = rightPattern();
    const state = PATTERN_BLOCK_RUNNER.createInitialState(pattern.id);
    assert.deepEqual(Object.keys(state.interaction).sort(), [
      "completionTimestampsMs",
      "patternsCompleted",
      "patternsShown",
      "reactionTimesMs",
    ]);
  });
});
