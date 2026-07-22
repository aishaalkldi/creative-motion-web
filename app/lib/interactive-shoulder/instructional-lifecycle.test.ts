/**
 * Run: npx tsx --test app/lib/interactive-shoulder/instructional-lifecycle.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialInstructionalLifecycle,
  tickInstructionalLifecycle,
} from "./instructional-lifecycle";

const T0 = 4_000_000;

describe("instructional-lifecycle", () => {
  it("does not complete before blockElapsedSeconds reaches the target duration", () => {
    const state = createInitialInstructionalLifecycle();
    const ticked = tickInstructionalLifecycle(state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      targetDurationSeconds: 10,
    });
    assert.equal(ticked.completionEvent, null);
    assert.equal(ticked.state.completed, false);
  });

  it("completes with reason 'duration' once blockElapsedSeconds reaches the target, with capturedAtMs as wall-clock time", () => {
    const state = createInitialInstructionalLifecycle();
    const completed = tickInstructionalLifecycle(state, {
      nowMs: T0 + 10_000,
      blockElapsedSeconds: 10,
      targetDurationSeconds: 10,
    });
    assert.ok(completed.completionEvent);
    assert.equal(completed.completionEvent?.reason, "duration");
    assert.equal(completed.completionEvent?.capturedAtMs, T0 + 10_000);
    assert.equal(completed.state.completed, true);
  });

  it("completes with reason 'acknowledged' regardless of blockElapsedSeconds", () => {
    const state = createInitialInstructionalLifecycle();
    const acknowledged = tickInstructionalLifecycle(state, {
      nowMs: T0 + 500,
      blockElapsedSeconds: 0.5,
      targetDurationSeconds: 60,
      acknowledged: true,
    });
    assert.ok(acknowledged.completionEvent);
    assert.equal(acknowledged.completionEvent?.reason, "acknowledged");
  });

  it("completes on acknowledgement alone when no target duration is supplied", () => {
    const state = createInitialInstructionalLifecycle();
    const acknowledged = tickInstructionalLifecycle(state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.ok(acknowledged.completionEvent);
    assert.equal(acknowledged.completionEvent?.reason, "acknowledged");
  });

  it("never completes on its own when no duration and no acknowledgement are given", () => {
    let state = createInitialInstructionalLifecycle();
    for (let i = 0; i < 20; i += 1) {
      state = tickInstructionalLifecycle(state, {
        nowMs: T0 + i * 1000,
        blockElapsedSeconds: i,
      }).state;
    }
    assert.equal(state.completed, false);
  });

  describe("REQUIREMENT 1: no-paused-tick scenario", () => {
    it("blockElapsedSeconds 0 → 3, no calls during a 30s pause, resume with blockElapsedSeconds still ~3 — does not complete; completes only when blockElapsedSeconds reaches 10", () => {
      let state = createInitialInstructionalLifecycle();

      // t=0: blockElapsedSeconds = 0
      state = tickInstructionalLifecycle(state, {
        nowMs: T0,
        blockElapsedSeconds: 0,
        targetDurationSeconds: 10,
      }).state;

      // t=3000: 3 real active seconds — this is the LAST call before the pause.
      const afterActive = tickInstructionalLifecycle(state, {
        nowMs: T0 + 3_000,
        blockElapsedSeconds: 3,
        targetDurationSeconds: 10,
      });
      assert.equal(afterActive.completionEvent, null);
      state = afterActive.state;

      // *** No calls at all for 30 real seconds — the caller simply never
      // ticks this lifecycle while paused, exactly like
      // InteractiveShoulderSession.tsx's existing convention for target/
      // pattern. Nothing here is called during that gap. ***

      // Resume: SessionOrchestrator's own blockElapsedSeconds is still ~3
      // (it excluded the pause on its own) — the caller passes that
      // unchanged value straight through.
      const resumed = tickInstructionalLifecycle(state, {
        nowMs: T0 + 33_000,
        blockElapsedSeconds: 3,
        targetDurationSeconds: 10,
      });
      assert.equal(
        resumed.completionEvent,
        null,
        "must not complete — blockElapsedSeconds is still only 3 of 10, wall-clock nowMs is irrelevant",
      );
      state = resumed.state;

      // Real activity resumes and blockElapsedSeconds climbs normally.
      const almostThere = tickInstructionalLifecycle(state, {
        nowMs: T0 + 33_000 + 6_900,
        blockElapsedSeconds: 9.9,
        targetDurationSeconds: 10,
      });
      assert.equal(almostThere.completionEvent, null);

      const completesNow = tickInstructionalLifecycle(almostThere.state, {
        nowMs: T0 + 33_000 + 7_000,
        blockElapsedSeconds: 10,
        targetDurationSeconds: 10,
      });
      assert.ok(completesNow.completionEvent, "completes once blockElapsedSeconds reaches 10");
      assert.equal(completesNow.completionEvent?.reason, "duration");
    });

    it("REQUIREMENT 2: identical result whether the gap is a pause or a safetyHold — this lifecycle takes no session-state input at all", () => {
      // The raw lifecycle has no notion of "paused" vs "safetyHold" — it
      // only ever sees blockElapsedSeconds. Session-state gating (if any)
      // happens one layer up, in instructional-lifecycle-gating.ts, and is
      // exercised there. This test documents that the underlying duration
      // math cannot distinguish the two, by construction.
      let state = createInitialInstructionalLifecycle();
      state = tickInstructionalLifecycle(state, {
        nowMs: T0,
        blockElapsedSeconds: 3,
        targetDurationSeconds: 10,
      }).state;
      const resumed = tickInstructionalLifecycle(state, {
        nowMs: T0 + 999_000,
        blockElapsedSeconds: 3,
        targetDurationSeconds: 10,
      });
      assert.equal(resumed.completionEvent, null);
    });

    it("REQUIREMENT 3: multiple pause/resume gaps do not affect completion while blockElapsedSeconds is unchanged", () => {
      let state = createInitialInstructionalLifecycle();
      state = tickInstructionalLifecycle(state, {
        nowMs: 0,
        blockElapsedSeconds: 2,
        targetDurationSeconds: 6,
      }).state;

      // Simulate three separate "still paused" observations at wildly
      // different wall-clock times, all reporting the same frozen
      // blockElapsedSeconds — as SessionOrchestrator's own pause-aware
      // value would.
      for (const nowMs of [50_000, 200_000, 1_000_000]) {
        const r = tickInstructionalLifecycle(state, {
          nowMs,
          blockElapsedSeconds: 2,
          targetDurationSeconds: 6,
        });
        assert.equal(r.completionEvent, null, "unchanged blockElapsedSeconds must never trigger completion");
        state = r.state;
      }

      const completes = tickInstructionalLifecycle(state, {
        nowMs: 1_000_100,
        blockElapsedSeconds: 6,
        targetDurationSeconds: 6,
      });
      assert.ok(completes.completionEvent);
    });

    it("REQUIREMENT 4: nowMs may advance significantly while blockElapsedSeconds stays fixed — must not progress duration", () => {
      const state = createInitialInstructionalLifecycle();
      const farFuture = tickInstructionalLifecycle(state, {
        nowMs: T0 + 100_000_000,
        blockElapsedSeconds: 1,
        targetDurationSeconds: 10,
      });
      assert.equal(farFuture.completionEvent, null, "a huge nowMs jump with blockElapsedSeconds=1 must not complete a 10s block");
    });
  });

  it("REQUIREMENT 5: duration completion fires exactly once", () => {
    const state = createInitialInstructionalLifecycle();
    const first = tickInstructionalLifecycle(state, {
      nowMs: T0,
      blockElapsedSeconds: 5,
      targetDurationSeconds: 5,
    });
    assert.ok(first.completionEvent);
    const second = tickInstructionalLifecycle(first.state, {
      nowMs: T0 + 1_000,
      blockElapsedSeconds: 6,
      targetDurationSeconds: 5,
    });
    assert.equal(second.completionEvent, null);
  });

  it("REQUIREMENT 6: acknowledgement completes exactly once — a duplicate acknowledged tick after completion is a no-op", () => {
    const state = createInitialInstructionalLifecycle();
    const first = tickInstructionalLifecycle(state, { nowMs: T0, blockElapsedSeconds: 0, acknowledged: true });
    assert.ok(first.completionEvent);

    const second = tickInstructionalLifecycle(first.state, {
      nowMs: T0 + 100,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.equal(second.completionEvent, null);
    assert.equal(second.state, first.state, "state reference is returned unchanged once completed");
  });

  it("REQUIREMENT 7: acknowledgement before duration prevents a later duration completion event", () => {
    const state = createInitialInstructionalLifecycle();
    const ack = tickInstructionalLifecycle(state, {
      nowMs: T0,
      blockElapsedSeconds: 1,
      targetDurationSeconds: 10,
      acknowledged: true,
    });
    assert.equal(ack.completionEvent?.reason, "acknowledged");

    const later = tickInstructionalLifecycle(ack.state, {
      nowMs: T0 + 20_000,
      blockElapsedSeconds: 20,
      targetDurationSeconds: 10,
    });
    assert.equal(later.completionEvent, null, "already completed via acknowledgement — no second, 'duration' event");
  });

  describe("REQUIREMENT 8: missing or invalid blockElapsedSeconds fails safely", () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      it(`blockElapsedSeconds = ${invalid} never triggers false completion and never falls back to nowMs`, () => {
        const state = createInitialInstructionalLifecycle();
        const ticked = tickInstructionalLifecycle(state, {
          nowMs: T0 + 999_999,
          blockElapsedSeconds: invalid,
          targetDurationSeconds: 1,
        });
        assert.equal(ticked.completionEvent, null);
        assert.equal(ticked.state.completed, false);
      });
    }
  });

  it("REQUIREMENT 9: produces no movement repetition, target contact, or pattern progress fields — timing and reason only", () => {
    const state = createInitialInstructionalLifecycle();
    assert.deepEqual(Object.keys(state).sort(), ["completed"]);
    const ticked = tickInstructionalLifecycle(state, { nowMs: T0, blockElapsedSeconds: 0, acknowledged: true });
    assert.ok(ticked.completionEvent);
    assert.deepEqual(Object.keys(ticked.completionEvent!).sort(), ["capturedAtMs", "reason"]);
    assert.deepEqual(Object.keys(ticked.state).sort(), ["completed"]);
  });
});
