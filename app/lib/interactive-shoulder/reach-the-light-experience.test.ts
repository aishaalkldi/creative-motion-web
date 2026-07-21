/**
 * Run: npx tsx --test app/lib/interactive-shoulder/reach-the-light-experience.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "./target-generator";
import {
  createInitialTargetLifecycle,
  tickTargetLifecycle,
} from "./target-lifecycle";
import { tickTargetLifecycleIfActive } from "./target-lifecycle-gating";
import {
  REACH_THE_LIGHT_HIT_EXIT_MS,
  REACH_THE_LIGHT_HIT_EXIT_REDUCED_MS,
  isTargetSpawnLocked,
  resolveHitExitTransitionMs,
} from "./reach-the-light-motion";
import { interactiveShoulderUi } from "./interactive-shoulder-ui";
import { isInteractiveShoulderSessionWired } from "./interactive-shoulder-exercise-ids";

const T0 = 4_000_000;
const deterministicRandom = () => 0.42;

describe("Reach the Light — hit feedback lifecycle", () => {
  it("defers the next target spawn until the exit transition completes", () => {
    let state = createInitialTargetLifecycle();
    state = tickTargetLifecycle(state, {
      wrist: null,
      nowMs: T0,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: deterministicRandom,
    }).state;
    const firstId = state.currentTarget?.id;
    assert.ok(firstId);

    const hit = tickTargetLifecycle(state, {
      wrist: { x: state.currentTarget!.x, y: state.currentTarget!.y },
      nowMs: T0 + 600,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      random: deterministicRandom,
    });
    assert.ok(hit.hitEvent);
    assert.equal(hit.state.currentTarget, null);
    assert.ok(hit.state.exitingTarget);
    assert.equal(hit.state.interaction.targetsReached, 1);
    assert.ok(isTargetSpawnLocked(hit.state.spawnLockedUntilMs, T0 + 700));

    const duringExit = tickTargetLifecycle(hit.state, {
      wrist: { x: hit.state.exitingTarget!.x, y: hit.state.exitingTarget!.y },
      nowMs: T0 + 700,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      random: deterministicRandom,
    });
    assert.equal(duringExit.hitEvent, null);
    assert.equal(duringExit.state.interaction.targetsReached, 1);

    const afterExit = tickTargetLifecycle(duringExit.state, {
      wrist: null,
      nowMs: T0 + 600 + REACH_THE_LIGHT_HIT_EXIT_MS + 20,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      random: deterministicRandom,
    });
    assert.ok(afterExit.state.currentTarget);
    assert.notEqual(afterExit.state.currentTarget?.id, firstId);
    assert.equal(afterExit.state.exitingTarget, null);
    assert.equal(afterExit.state.interaction.targetsShown, 2);
  });
});

describe("Reach the Light — reduced motion", () => {
  it("uses an instant transition when reduced motion is preferred", () => {
    assert.equal(resolveHitExitTransitionMs(true), REACH_THE_LIGHT_HIT_EXIT_REDUCED_MS);
    assert.equal(resolveHitExitTransitionMs(false), REACH_THE_LIGHT_HIT_EXIT_MS);
  });
});

describe("Reach the Light — bilingual experience copy", () => {
  it("provides English and Arabic experience labels and completion copy", () => {
    const en = interactiveShoulderUi("en");
    const ar = interactiveShoulderUi("ar");
    assert.equal(en.experienceTitle, "Reach the Light");
    assert.ok(ar.experienceTitle.length > 0);
    assert.ok(en.targetReached.includes("Light"));
    assert.ok(ar.targetReached.length > 0);
    assert.notEqual(en.targetReached, ar.targetReached);
    assert.ok(en.blockCompleteDetailedSummary(3, 2, 90).includes("Session duration"));
    assert.ok(ar.blockCompleteDetailedSummary(3, 2, 90).includes("مدة الجلسة"));
    assert.ok(en.metricsSeparationNote.includes("separate observations"));
    assert.ok(ar.metricsSeparationNote.includes("ملاحظات منفصلة"));
  });
});

describe("Reach the Light — metric separation", () => {
  it("keeps target hits separate from measured repetitions", () => {
    let state = createInitialTargetLifecycle();
    state = tickTargetLifecycle(state, {
      wrist: null,
      nowMs: T0,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: deterministicRandom,
    }).state;

    const hitTargetId = state.currentTarget!.id;
    const hit = tickTargetLifecycle(state, {
      wrist: { x: state.currentTarget!.x, y: state.currentTarget!.y },
      nowMs: T0 + 500,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
      random: deterministicRandom,
    });

    assert.equal(hit.state.interaction.targetsReached, 1);
    assert.equal(hit.hitEvent?.targetId, hitTargetId);
    assert.equal(typeof hit.hitEvent?.reactionTimeMs, "number");
  });
});

describe("Reach the Light — active session gating", () => {
  it("allows target lifecycle ticks only while the orchestrator session is active", () => {
    let state = createInitialTargetLifecycle();
    const spawned = tickTargetLifecycleIfActive("active", state, {
      wrist: null,
      nowMs: T0,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: deterministicRandom,
      hitExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
    });
    assert.equal(spawned.ticked, true);
    state = spawned.state;

    for (const sessionState of ["paused", "safetyHold", "completed"] as const) {
      const blocked = tickTargetLifecycleIfActive(sessionState, state, {
        wrist: { x: state.currentTarget!.x, y: state.currentTarget!.y },
        nowMs: T0 + 900,
        side: "right",
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        hitExitTransitionMs: REACH_THE_LIGHT_HIT_EXIT_MS,
        random: deterministicRandom,
      });
      assert.equal(blocked.ticked, false);
      assert.equal(blocked.hitEvent, null);
    }
  });

  it("preserves unchanged patient runtime wiring for upper-limb-reaching-seated", () => {
    assert.equal(isInteractiveShoulderSessionWired("upper-limb-reaching-seated"), true);
  });
});
