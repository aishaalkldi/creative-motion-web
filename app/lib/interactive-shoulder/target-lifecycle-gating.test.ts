/**
 * Run: npx tsx --test app/lib/interactive-shoulder/target-lifecycle-gating.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "./target-generator";
import { createInitialTargetLifecycle } from "./target-lifecycle";
import { tickTargetLifecycleIfActive } from "./target-lifecycle-gating";

const T0 = 3_000_000;
const WRIST_AT_TARGET = { x: 0.55, y: 0.35 };

describe("target lifecycle session-state gating", () => {
  it("active → lifecycle may tick, spawn targets, and register hits", () => {
    let state = createInitialTargetLifecycle();
    state = tickTargetLifecycleIfActive("active", state, {
      wrist: null,
      nowMs: T0,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    }).state;
    assert.ok(state.currentTarget);
    assert.equal(state.interaction.targetsShown, 1);

    const hit = tickTargetLifecycleIfActive("active", state, {
      wrist: { x: state.currentTarget!.x, y: state.currentTarget!.y },
      nowMs: T0 + 500,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(hit.ticked, true);
    assert.ok(hit.hitEvent);
    assert.equal(hit.state.interaction.targetsReached, 1);
  });

  for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
    it(`${sessionState} → no target spawn, replacement, or hit registration`, () => {
      let state = createInitialTargetLifecycle();
      const spawned = tickTargetLifecycleIfActive(sessionState, state, {
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
        ...createInitialTargetLifecycle(),
        currentTarget: {
          id: "seed-target",
          x: WRIST_AT_TARGET.x,
          y: WRIST_AT_TARGET.y,
          spawnedAtMs: T0,
        },
        interaction: { ...createInitialTargetLifecycle().interaction, targetsShown: 1 },
      };

      const hitAttempt = tickTargetLifecycleIfActive(sessionState, state, {
        wrist: WRIST_AT_TARGET,
        nowMs: T0 + 500,
        side: "right",
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        random: () => 0.5,
      });
      assert.equal(hitAttempt.ticked, false);
      assert.equal(hitAttempt.hitEvent, null);
      assert.equal(hitAttempt.state.currentTarget?.id, "seed-target");
      assert.equal(hitAttempt.state.interaction.targetsReached, 0);
    });
  }
});
