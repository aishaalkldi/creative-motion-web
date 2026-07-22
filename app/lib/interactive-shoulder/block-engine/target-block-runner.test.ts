/**
 * Run: npx tsx --test app/lib/interactive-shoulder/block-engine/target-block-runner.test.ts
 *
 * Re-runs the exact scenarios from target-lifecycle-gating.test.ts through
 * TARGET_BLOCK_RUNNER instead of calling tickTargetLifecycleIfActive
 * directly — proving the wrapper introduces zero behavior drift.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "../target-generator";
import { getBlockRunnerForBlockType, registerBlockRunner } from "./block-runner-registry";
import { TARGET_BLOCK_RUNNER } from "./target-block-runner";

const T0 = 3_000_000;
const WRIST_AT_TARGET = { x: 0.55, y: 0.35 };

describe("target-block-runner", () => {
  it('registers under "movement-target" and resolves through the shared registry', () => {
    registerBlockRunner(TARGET_BLOCK_RUNNER);
    assert.equal(getBlockRunnerForBlockType("movement-target"), TARGET_BLOCK_RUNNER);
  });

  it("active → may tick, spawn targets, and register hits (replays target-lifecycle-gating.test.ts)", () => {
    let state = TARGET_BLOCK_RUNNER.createInitialState();
    state = TARGET_BLOCK_RUNNER.tick("active", state, {
      wrist: null,
      nowMs: T0,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    }).state;
    assert.ok(state.currentTarget);
    assert.equal(state.interaction.targetsShown, 1);

    const hit = TARGET_BLOCK_RUNNER.tick("active", state, {
      wrist: { x: state.currentTarget!.x, y: state.currentTarget!.y },
      nowMs: T0 + 500,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(hit.ticked, true);
    assert.ok(hit.completionEvent);
    assert.equal(hit.state.interaction.targetsReached, 1);
  });

  for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
    it(`${sessionState} → no target spawn, replacement, or hit registration (replays target-lifecycle-gating.test.ts)`, () => {
      let state = TARGET_BLOCK_RUNNER.createInitialState();
      const spawned = TARGET_BLOCK_RUNNER.tick(sessionState, state, {
        wrist: null,
        nowMs: T0,
        side: "right",
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        random: () => 0.5,
      });
      assert.equal(spawned.ticked, false);
      assert.equal(spawned.state.currentTarget, null);
      assert.equal(spawned.state.interaction.targetsShown, 0);

      state = {
        ...TARGET_BLOCK_RUNNER.createInitialState(),
        currentTarget: {
          id: "seed-target",
          x: WRIST_AT_TARGET.x,
          y: WRIST_AT_TARGET.y,
          spawnedAtMs: T0,
        },
        interaction: {
          ...TARGET_BLOCK_RUNNER.createInitialState().interaction,
          targetsShown: 1,
        },
      };

      const hitAttempt = TARGET_BLOCK_RUNNER.tick(sessionState, state, {
        wrist: WRIST_AT_TARGET,
        nowMs: T0 + 500,
        side: "right",
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        random: () => 0.5,
      });
      assert.equal(hitAttempt.ticked, false);
      assert.equal(hitAttempt.completionEvent, null);
      assert.equal(hitAttempt.state.currentTarget?.id, "seed-target");
      assert.equal(hitAttempt.state.interaction.targetsReached, 0);
    });
  }

  it("returns null for an unregistered blockType from within this isolated process", () => {
    assert.equal(getBlockRunnerForBlockType("movement-pattern"), null);
    assert.equal(getBlockRunnerForBlockType("instructional"), null);
  });
});
