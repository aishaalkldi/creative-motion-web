/**
 * Run: npx tsx --test app/lib/interactive-shoulder/block-engine/instructional-block-runner.test.ts
 *
 * Re-runs the instructional-lifecycle-gating.test.ts scenarios through
 * INSTRUCTIONAL_BLOCK_RUNNER instead of calling
 * tickInstructionalLifecycleIfActive directly — proving the wrapper
 * introduces zero behavior drift, matching the convention established by
 * target-block-runner.test.ts and pattern-block-runner.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBlockRunnerForBlockType } from "./block-runner-registry";
import {
  INSTRUCTIONAL_BLOCK_RUNNER,
  registerInstructionalBlockRunner,
  resolveInstructionalBlockRunner,
} from "./instructional-block-runner";

const T0 = 5_000_000;

describe("instructional-block-runner", () => {
  it('registers under "instructional" and resolves through the shared registry', () => {
    registerInstructionalBlockRunner();
    assert.equal(getBlockRunnerForBlockType("instructional"), INSTRUCTIONAL_BLOCK_RUNNER);
  });

  it("active → ticks, starts, and completes once blockElapsedSeconds reaches the target duration", () => {
    let state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();
    const started = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      targetDurationSeconds: 5,
    });
    assert.equal(started.ticked, true);
    state = started.state;

    const completed = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0 + 5_000,
      blockElapsedSeconds: 5,
      targetDurationSeconds: 5,
    });
    assert.equal(completed.ticked, true);
    assert.ok(completed.completionEvent);
    assert.equal(completed.completionEvent?.reason, "duration");
  });

  it("acknowledgement completes immediately regardless of blockElapsedSeconds", () => {
    const state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();
    const acknowledged = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0 + 200,
      blockElapsedSeconds: 0.2,
      targetDurationSeconds: 60,
      acknowledged: true,
    });
    assert.ok(acknowledged.completionEvent);
    assert.equal(acknowledged.completionEvent?.reason, "acknowledged");
  });

  for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
    it(`${sessionState} → not ticked, no completion, even if blockElapsedSeconds already meets the target`, () => {
      const state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();
      const result = INSTRUCTIONAL_BLOCK_RUNNER.tick(sessionState, state, {
        nowMs: T0,
        blockElapsedSeconds: 999,
        targetDurationSeconds: 1,
        acknowledged: true,
      });
      assert.equal(result.ticked, false);
      assert.equal(result.completionEvent, null);
    });
  }

  it("NO-PAUSED-TICK SCENARIO, replayed through the runner: the runner is simply never called during a 30s pause, then resumes correctly", () => {
    let state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();

    let r = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      targetDurationSeconds: 10,
    });
    state = r.state;
    r = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0 + 3_000,
      blockElapsedSeconds: 3,
      targetDurationSeconds: 10,
    });
    assert.equal(r.completionEvent, null);
    state = r.state;

    // No calls at all during the 30s pause — matching
    // InteractiveShoulderSession.tsx's existing `if (sessionState ===
    // "active")` convention, which never ticks target/pattern runners
    // outside "active" either.

    const resumed = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0 + 33_000,
      blockElapsedSeconds: 3,
      targetDurationSeconds: 10,
    });
    assert.equal(resumed.completionEvent, null, "must not complete immediately on resume");

    const completes = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", resumed.state, {
      nowMs: T0 + 33_000 + 7_000,
      blockElapsedSeconds: 10,
      targetDurationSeconds: 10,
    });
    assert.ok(completes.completionEvent, "completes once blockElapsedSeconds reaches 10, not on wall-clock time");
  });

  it("completion emits exactly once", () => {
    const state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();
    const first = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.ok(first.completionEvent);
    const second = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", first.state, {
      nowMs: T0 + 50,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.equal(second.completionEvent, null);
  });

  it("pausing after completion does not change completed state", () => {
    const state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();
    const completed = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    const pausedAfter = INSTRUCTIONAL_BLOCK_RUNNER.tick("paused", completed.state, {
      nowMs: T0 + 5_000,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.equal(pausedAfter.ticked, false);
    assert.equal(pausedAfter.completionEvent, null);
  });

  it("produces no rep count, target contact, or pattern progress field on its state or completion event", () => {
    const state = INSTRUCTIONAL_BLOCK_RUNNER.createInitialState();
    assert.deepEqual(Object.keys(state).sort(), ["completed"]);
    const ticked = INSTRUCTIONAL_BLOCK_RUNNER.tick("active", state, {
      nowMs: T0,
      blockElapsedSeconds: 0,
      acknowledged: true,
    });
    assert.deepEqual(Object.keys(ticked.completionEvent!).sort(), ["capturedAtMs", "reason"]);
  });

  it("returns null for an unregistered blockType from within this isolated process", () => {
    assert.equal(getBlockRunnerForBlockType("movement-target"), null);
    assert.equal(getBlockRunnerForBlockType("movement-pattern"), null);
  });

  it('resolveInstructionalBlockRunner resolves "instructional" and fails safely for anything else', () => {
    registerInstructionalBlockRunner();
    assert.equal(resolveInstructionalBlockRunner("instructional"), INSTRUCTIONAL_BLOCK_RUNNER);
    assert.equal(resolveInstructionalBlockRunner(undefined), null);
    assert.equal(resolveInstructionalBlockRunner("movement-target"), null);
    assert.equal(resolveInstructionalBlockRunner("movement-pattern"), null);
  });

  it("registerInstructionalBlockRunner is idempotent — a second call does not throw", () => {
    assert.doesNotThrow(() => registerInstructionalBlockRunner());
    assert.equal(resolveInstructionalBlockRunner("instructional"), INSTRUCTIONAL_BLOCK_RUNNER);
  });
});
