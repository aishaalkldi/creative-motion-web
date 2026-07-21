/**
 * Run: npx tsx --test app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveActiveMotionPattern } from "./motion-pattern-registry";
import { PNF_D1_FLEXION_FEEDBACK_PROFILE } from "./pnf-d1-flexion-pattern";
import {
  createInitialPatternLifecycle,
  tickPatternLifecycle,
} from "./pattern-lifecycle";
import { samplePathAtProgress } from "./bezier-path";
import { REACH_THE_LIGHT_HIT_EXIT_MS } from "../reach-the-light-motion";

const T0 = 5_000_000;

describe("pattern-lifecycle", () => {
  it("advances progress when the wrist follows the therapeutic path", () => {
    const pattern = resolveActiveMotionPattern(PNF_D1_FLEXION_FEEDBACK_PROFILE, "right")!;
    let state = createInitialPatternLifecycle(pattern.id);
    const start = samplePathAtProgress(pattern.sampledPath, 0.1);
    state = tickPatternLifecycle(state, {
      wrist: start,
      nowMs: T0,
      pattern,
    }).state;
    assert.ok(state.pathProgress > 0);
  });

  it("registers one completion and locks during exit transition", () => {
    const pattern = resolveActiveMotionPattern(PNF_D1_FLEXION_FEEDBACK_PROFILE, "right")!;
    let state = createInitialPatternLifecycle(pattern.id);
    const end = samplePathAtProgress(pattern.sampledPath, 0.98);

    for (let step = 0; step <= 10; step += 1) {
      const progress = 0.2 + step * 0.08;
      const wrist = samplePathAtProgress(pattern.sampledPath, Math.min(0.98, progress));
      const ticked = tickPatternLifecycle(state, {
        wrist,
        nowMs: T0 + step * 100,
        pattern,
        completionExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      });
      state = ticked.state;
      if (ticked.completionEvent) {
        assert.equal(ticked.completionEvent.patternId, "pnf-d1-flexion");
        break;
      }
    }

    assert.equal(state.interaction.targetsReached, 1);
    const duringExit = tickPatternLifecycle(state, {
      wrist: end,
      nowMs: T0 + 500,
      pattern,
      completionExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
    });
    assert.equal(duringExit.completionEvent, null);
    assert.equal(duringExit.state.interaction.targetsReached, 1);
  });

  it("does not count measured repetitions in interaction metrics", () => {
    const pattern = resolveActiveMotionPattern(PNF_D1_FLEXION_FEEDBACK_PROFILE, "right")!;
    const state = createInitialPatternLifecycle(pattern.id);
    assert.equal(state.interaction.targetsReached, 0);
    assert.deepEqual(state.interaction.reactionTimesMs, []);
  });
});
