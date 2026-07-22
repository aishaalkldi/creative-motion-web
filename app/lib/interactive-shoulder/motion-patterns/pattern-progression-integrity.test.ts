/**
 * Run: npx tsx --test app/lib/interactive-shoulder/motion-patterns/pattern-progression-integrity.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { samplePathAtProgress } from "./bezier-path";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./d1-inspired-diagonal-reach-pattern";
import { resolveActiveMotionPattern } from "./motion-pattern-registry";
import { resolveMotionPatternPath } from "./motion-pattern-types";
import { D1_INSPIRED_DIAGONAL_REACH_PATTERN } from "./d1-inspired-diagonal-reach-pattern";
import {
  createInitialPatternLifecycle,
  tickPatternLifecycle,
  type PatternLifecycleState,
} from "./pattern-lifecycle";
import { tickPatternLifecycleIfActive } from "./pattern-lifecycle-gating";
import { resetPatternLifecycleForBlock } from "./pattern-lifecycle-gating";
import { REACH_THE_LIGHT_HIT_EXIT_MS } from "../reach-the-light-motion";

const T0 = 8_000_000;

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
    const ticked = tickPatternLifecycle(next, {
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

describe("pattern progression integrity", () => {
  it("1. first wrist sample near the final point does not advance or complete", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    const ticked = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.98),
      nowMs: T0,
      pattern,
    });
    state = ticked.state;
    assert.equal(ticked.completionEvent, null);
    assert.equal(state.hasAcquiredStart, false);
    assert.equal(state.furthestProgress, 0);
    assert.equal(state.pathProgress, 0);
  });

  it("2. a large jump from early progress to late progress is rejected", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.08),
      nowMs: T0,
      pattern,
    }).state;
    assert.equal(state.hasAcquiredStart, true);

    const jumped = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.92),
      nowMs: T0 + 100,
      pattern,
    });
    assert.equal(jumped.completionEvent, null);
    assert.equal(jumped.state.awaitingReacquisition, true);
    assert.ok(jumped.state.furthestProgress < 0.2);
  });

  it("3. holding the wrist at the final point after a rejected jump does not gradually complete", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.08),
      nowMs: T0,
      pattern,
    }).state;
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.22),
      nowMs: T0 + 50,
      pattern,
    }).state;
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.95),
      nowMs: T0 + 100,
      pattern,
    }).state;

    for (let i = 0; i < 40; i += 1) {
      const ticked = tickPatternLifecycle(state, {
        wrist: wristAt(pattern, 0.98),
        nowMs: T0 + 200 + i * 40,
        pattern,
      });
      state = ticked.state;
      assert.equal(ticked.completionEvent, null);
    }
    assert.ok(state.furthestProgress < pattern.progression.completionProgress);
  });

  it("4. valid sequential movement completes the pattern", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    const walked = advanceSequentially(state, pattern, 0.05, 0.98, 24);
    assert.equal(walked.completionCount, 1);
    assert.equal(walked.state.interaction.patternsCompleted, 1);
    assert.equal(walked.state.interaction.patternsCompleted, walked.state.interaction.patternsCompleted);
  });

  it("5. off-path wrist movement does not advance progress", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.08),
      nowMs: T0,
      pattern,
    }).state;
    const before = state.furthestProgress;
    state = tickPatternLifecycle(state, {
      wrist: { x: 0.05, y: 0.05 },
      nowMs: T0 + 50,
      pattern,
    }).state;
    assert.equal(state.furthestProgress, before);
  });

  it("6. reverse movement does not falsely advance or complete", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    const forward = advanceSequentially(state, pattern, 0.05, 0.45, 10);
    state = forward.state;
    const furthest = state.furthestProgress;
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.1),
      nowMs: T0 + 2_000,
      pattern,
    }).state;
    assert.equal(state.furthestProgress, furthest);
    assert.equal(state.pathProgress, furthest);
  });

  it("7. pause after partial progress freezes progress", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.35, 8).state;
    const frozen = state.furthestProgress;
    const paused = tickPatternLifecycleIfActive("paused", state, {
      wrist: wristAt(pattern, 0.9),
      nowMs: T0 + 5_000,
      pattern,
    });
    assert.equal(paused.ticked, false);
    assert.equal(paused.state.furthestProgress, frozen);
    assert.equal(paused.completionEvent, null);
  });

  it("8. safety hold after partial progress freezes progress", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.35, 8).state;
    const frozen = state.furthestProgress;
    const held = tickPatternLifecycleIfActive("safetyHold", state, {
      wrist: wristAt(pattern, 0.9),
      nowMs: T0 + 5_000,
      pattern,
    });
    assert.equal(held.ticked, false);
    assert.equal(held.state.furthestProgress, frozen);
  });

  it("9. tracker loss freezes progress", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.4, 10).state;
    const frozen = state.furthestProgress;
    state = tickPatternLifecycle(state, {
      wrist: null,
      nowMs: T0 + 3_000,
      pattern,
    }).state;
    assert.equal(state.furthestProgress, frozen);
    assert.equal(state.awaitingReacquisition, true);
  });

  it("10. reacquisition near the final point is rejected", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.25, 6).state;
    state = tickPatternLifecycle(state, { wrist: null, nowMs: T0 + 1_000, pattern }).state;
    const reacquired = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.97),
      nowMs: T0 + 1_100,
      pattern,
    });
    assert.equal(reacquired.completionEvent, null);
    assert.equal(reacquired.state.awaitingReacquisition, true);
    assert.ok(reacquired.state.furthestProgress < pattern.progression.completionProgress);
  });

  it("11. reacquisition near the previously accepted section resumes safely", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    state = advanceSequentially(state, pattern, 0.05, 0.35, 8).state;
    const checkpoint = state.furthestProgress;
    state = tickPatternLifecycle(state, { wrist: null, nowMs: T0 + 2_000, pattern }).state;
    state = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, checkpoint),
      nowMs: T0 + 2_100,
      pattern,
    }).state;
    assert.equal(state.awaitingReacquisition, false);
    const resumed = advanceSequentially(state, pattern, checkpoint, 0.98, 16, T0 + 2_200);
    assert.equal(resumed.completionCount, 1);
  });

  it("12. completion emits exactly once", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    let completions = 0;
    for (let step = 0; step <= 30; step += 1) {
      const progress = 0.05 + step * 0.03;
      const ticked = tickPatternLifecycle(state, {
        wrist: wristAt(pattern, Math.min(0.99, progress)),
        nowMs: T0 + step * 40,
        pattern,
        completionExitTransitionMs: 0,
      });
      state = ticked.state;
      if (ticked.completionEvent) completions += 1;
    }
    assert.equal(completions, 1);
  });

  it("13. exit lock prevents duplicate completion", () => {
    const pattern = rightPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    let completionEvent: ReturnType<typeof tickPatternLifecycle>["completionEvent"] = null;
    for (let step = 0; step <= 24; step += 1) {
      const ticked = tickPatternLifecycle(state, {
        wrist: wristAt(pattern, 0.05 + step * 0.04),
        nowMs: T0 + step * 40,
        pattern,
        completionExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      });
      state = ticked.state;
      if (ticked.completionEvent) completionEvent = ticked.completionEvent;
    }
    assert.ok(completionEvent);
    const duringExit = tickPatternLifecycle(state, {
      wrist: wristAt(pattern, 0.99),
      nowMs: T0 + 2_000,
      pattern,
      completionExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
    });
    assert.equal(duringExit.completionEvent, null);
    assert.equal(duringExit.state.interaction.patternsCompleted, 1);
  });

  it("14. left-side mirrored traversal completes correctly", () => {
    const pattern = leftPattern();
    let state = createInitialPatternLifecycle(pattern.id);
    const walked = advanceSequentially(state, pattern, 0.05, 0.98, 24);
    assert.equal(walked.completionCount, 1);
    assert.equal(walked.state.interaction.patternsCompleted, 1);
  });

  it("15. Arabic RTL does not mirror clinical coordinates — only side mirroring applies", () => {
    const right = resolveMotionPatternPath(D1_INSPIRED_DIAGONAL_REACH_PATTERN, "right");
    const left = resolveMotionPatternPath(D1_INSPIRED_DIAGONAL_REACH_PATTERN, "left");
    const rightStart = samplePathAtProgress(right, 0);
    const leftStart = samplePathAtProgress(left, 0);
    assert.ok(Math.abs(rightStart.x - (1 - leftStart.x)) < 0.001);
    assert.equal(rightStart.y, leftStart.y);
  });

  it("22. sequential pattern → Reach the Light block transition does not leak lifecycle state", () => {
    const pattern = rightPattern();
    let state = advanceSequentially(createInitialPatternLifecycle(pattern.id), pattern, 0.05, 0.5, 12).state;
    assert.ok(state.furthestProgress > 0.2);
    const reset = resetPatternLifecycleForBlock("d1-inspired-diagonal-reach");
    assert.equal(reset.furthestProgress, 0);
    assert.equal(reset.hasAcquiredStart, false);
    assert.equal(reset.awaitingReacquisition, false);
    assert.equal(reset.interaction.patternsCompleted, 0);
  });
});
