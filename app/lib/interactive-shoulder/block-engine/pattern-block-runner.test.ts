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
    assert.equal(resolvePatternBlockRunner(undefined), null);
    assert.equal(resolvePatternBlockRunner("movement-target"), null);
    assert.equal(resolvePatternBlockRunner("instructional"), null);
  });

  it("registerPatternBlockRunner is idempotent — a second call does not throw", () => {
    assert.doesNotThrow(() => registerPatternBlockRunner());
    assert.equal(resolvePatternBlockRunner("movement-pattern"), PATTERN_BLOCK_RUNNER);
  });
});
