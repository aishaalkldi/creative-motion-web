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
import {
  TARGET_BLOCK_RUNNER,
  registerTargetBlockRunner,
  resolveTargetBlockRunner,
} from "./target-block-runner";

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

  it('resolveTargetBlockRunner resolves "movement-target" and fails safely for anything else', () => {
    registerTargetBlockRunner();
    assert.equal(resolveTargetBlockRunner("movement-target"), TARGET_BLOCK_RUNNER);

    // Never silently hands back the target runner for a block that isn't
    // declared movement-target — including undefined (no blockType set).
    assert.equal(resolveTargetBlockRunner(undefined), null);
    assert.equal(resolveTargetBlockRunner("movement-pattern"), null);
    assert.equal(resolveTargetBlockRunner("instructional"), null);
  });

  it("registerTargetBlockRunner is idempotent — a second call does not throw", () => {
    assert.doesNotThrow(() => registerTargetBlockRunner());
    assert.equal(resolveTargetBlockRunner("movement-target"), TARGET_BLOCK_RUNNER);
  });

  it("tracking loss (wrist: null) and recovery behave identically through the runner", () => {
    let state = TARGET_BLOCK_RUNNER.createInitialState();
    state = TARGET_BLOCK_RUNNER.tick("active", state, {
      wrist: null,
      nowMs: T0,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    }).state;
    const spawnedTarget = state.currentTarget;
    assert.ok(spawnedTarget, "a target still spawns even while the wrist is unavailable");

    // Tracker lost mid-block: no wrist sample this tick.
    const lost = TARGET_BLOCK_RUNNER.tick("active", state, {
      wrist: null,
      nowMs: T0 + 100,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(lost.ticked, true);
    assert.equal(lost.completionEvent, null);
    assert.equal(lost.state.wristInside, false);
    assert.equal(lost.state.currentTarget?.id, spawnedTarget!.id, "target is preserved, not reset, during tracker loss");

    // Tracker recovers: wrist reappears at the same target and registers a hit normally.
    const recovered = TARGET_BLOCK_RUNNER.tick("active", lost.state, {
      wrist: { x: spawnedTarget!.x, y: spawnedTarget!.y },
      nowMs: T0 + 200,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.ok(recovered.completionEvent, "recovery lets a hit register exactly as it would without the runner wrapper");
  });
});
