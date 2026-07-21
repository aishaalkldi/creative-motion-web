/**
 * Run: npx tsx --test app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle-gating.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveActiveMotionPattern } from "./motion-pattern-registry";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./d1-inspired-diagonal-reach-pattern";
import { createInitialPatternLifecycle } from "./pattern-lifecycle";
import { tickPatternLifecycleIfActive } from "./pattern-lifecycle-gating";
import { samplePathAtProgress } from "./bezier-path";

const T0 = 6_000_000;

describe("pattern lifecycle session-state gating", () => {
  it("active → pattern lifecycle may advance from the path start", () => {
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    const state = createInitialPatternLifecycle(pattern.id);
    const wrist = samplePathAtProgress(pattern.sampledPath, 0.1);
    const ticked = tickPatternLifecycleIfActive("active", state, {
      wrist,
      nowMs: T0,
      pattern,
    });
    assert.equal(ticked.ticked, true);
    assert.equal(ticked.state.hasAcquiredStart, true);
  });

  for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
    it(`${sessionState} → no pattern advancement or completion`, () => {
      const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
      const state = createInitialPatternLifecycle(pattern.id);
      const wrist = samplePathAtProgress(pattern.sampledPath, 0.95);
      const ticked = tickPatternLifecycleIfActive(sessionState, state, {
        wrist,
        nowMs: T0,
        pattern,
      });
      assert.equal(ticked.ticked, false);
      assert.equal(ticked.completionEvent, null);
      assert.equal(ticked.state.pathProgress, 0);
    });
  }
});
