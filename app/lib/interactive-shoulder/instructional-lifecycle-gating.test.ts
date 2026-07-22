/**
 * Run: npx tsx --test app/lib/interactive-shoulder/instructional-lifecycle-gating.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialInstructionalLifecycle } from "./instructional-lifecycle";
import { tickInstructionalLifecycleIfActive } from "./instructional-lifecycle-gating";

const T0 = 4_500_000;

describe("instructional lifecycle session-state gating", () => {
  it("active → lifecycle may tick and complete", () => {
    const state = createInitialInstructionalLifecycle();
    const started = tickInstructionalLifecycleIfActive("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      targetDurationSeconds: 5,
    });
    assert.equal(started.ticked, true);

    const completed = tickInstructionalLifecycleIfActive("active", started.state, {
      nowMs: T0 + 5_000,
      blockElapsedSeconds: 5,
      targetDurationSeconds: 5,
    });
    assert.equal(completed.ticked, true);
    assert.ok(completed.completionEvent);
  });

  for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
    it(`${sessionState} → not ticked, no completion, even if blockElapsedSeconds already meets the target`, () => {
      const state = createInitialInstructionalLifecycle();
      const result = tickInstructionalLifecycleIfActive(sessionState, state, {
        nowMs: T0,
        blockElapsedSeconds: 999,
        targetDurationSeconds: 1,
        acknowledged: true,
      });
      assert.equal(result.ticked, false);
      assert.equal(result.completionEvent, null);
      assert.equal(result.state.completed, false);
      assert.equal(result.state, state, "state is returned unchanged — no freezing or bookkeeping needed");
    });
  }

  it("REQUIREMENT 1/2 (via the real gating wrapper): the runner is never called during a 30s pause, then resumes correctly", () => {
    let state = createInitialInstructionalLifecycle();

    let r = tickInstructionalLifecycleIfActive("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      targetDurationSeconds: 10,
    });
    state = r.state;
    r = tickInstructionalLifecycleIfActive("active", state, {
      nowMs: T0 + 3_000,
      blockElapsedSeconds: 3,
      targetDurationSeconds: 10,
    });
    assert.equal(r.completionEvent, null);
    state = r.state;

    // The gating wrapper (and therefore this lifecycle) is not called at
    // all during the pause — matching InteractiveShoulderSession.tsx's
    // existing `if (sessionState === "active")` convention. Nothing
    // happens here; there is no call to make.

    const resumed = tickInstructionalLifecycleIfActive("active", state, {
      nowMs: T0 + 33_000,
      blockElapsedSeconds: 3,
      targetDurationSeconds: 10,
    });
    assert.equal(resumed.ticked, true);
    assert.equal(resumed.completionEvent, null, "blockElapsedSeconds is still only 3 of 10");

    const completes = tickInstructionalLifecycleIfActive("active", resumed.state, {
      nowMs: T0 + 33_000 + 7_000,
      blockElapsedSeconds: 10,
      targetDurationSeconds: 10,
    });
    assert.ok(completes.completionEvent);
  });

  it("pausing after completion does not change completed state", () => {
    const state = createInitialInstructionalLifecycle();
    const completed = tickInstructionalLifecycleIfActive("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.equal(completed.state.completed, true);

    const pausedAfterCompletion = tickInstructionalLifecycleIfActive("paused", completed.state, {
      nowMs: T0 + 5_000,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.equal(pausedAfterCompletion.ticked, false);
    assert.equal(pausedAfterCompletion.state.completed, true);
    assert.equal(pausedAfterCompletion.completionEvent, null);
  });
});
