/**
 * Run: npx tsx --test app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveActiveMotionPattern } from "./motion-pattern-registry";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./d1-inspired-diagonal-reach-pattern";
import {
  createInitialPatternLifecycle,
  tickPatternLifecycle,
} from "./pattern-lifecycle";
import { samplePathAtProgress } from "./bezier-path";
import { REACH_THE_LIGHT_HIT_EXIT_MS } from "../reach-the-light-motion";

const T0 = 5_000_000;

describe("pattern-lifecycle", () => {
  it("advances progress when the wrist sequentially follows the therapeutic path from the start", () => {
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    let state = createInitialPatternLifecycle(pattern.id);
    state = tickPatternLifecycle(state, {
      wrist: samplePathAtProgress(pattern.sampledPath, 0.08),
      nowMs: T0,
      pattern,
    }).state;
    assert.ok(state.hasAcquiredStart);
    assert.ok(state.pathProgress > 0);
  });

  it("registers one completion and locks during exit transition", () => {
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    let state = createInitialPatternLifecycle(pattern.id);

    for (let step = 0; step <= 24; step += 1) {
      const progress = 0.05 + step * 0.04;
      const wrist = samplePathAtProgress(pattern.sampledPath, Math.min(0.98, progress));
      const ticked = tickPatternLifecycle(state, {
        wrist,
        nowMs: T0 + step * 100,
        pattern,
        completionExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      });
      state = ticked.state;
      if (ticked.completionEvent) {
        assert.equal(ticked.completionEvent.patternId, "d1-inspired-diagonal-reach");
        break;
      }
    }

    assert.equal(state.interaction.patternsCompleted, 1);
    const duringExit = tickPatternLifecycle(state, {
      wrist: samplePathAtProgress(pattern.sampledPath, 0.98),
      nowMs: T0 + 500,
      pattern,
      completionExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
    });
    assert.equal(duringExit.completionEvent, null);
    assert.equal(duringExit.state.interaction.patternsCompleted, 1);
  });

  it("does not count measured repetitions in pattern interaction metrics", () => {
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    const state = createInitialPatternLifecycle(pattern.id);
    assert.equal(state.interaction.patternsCompleted, 0);
    assert.deepEqual(state.interaction.reactionTimesMs, []);
  });
});
