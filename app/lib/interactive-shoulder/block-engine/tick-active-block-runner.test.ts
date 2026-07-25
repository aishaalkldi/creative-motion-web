/**
 * Run: npx tsx --test app/lib/interactive-shoulder/block-engine/tick-active-block-runner.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { samplePathAtProgress } from "../motion-patterns/bezier-path";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "../motion-patterns/d1-inspired-diagonal-reach-pattern";
import { resolveActiveMotionPattern } from "../motion-patterns/motion-pattern-registry";
import { createInitialPatternLifecycle } from "../motion-patterns/pattern-lifecycle";
import { createInitialInstructionalLifecycle } from "../instructional-lifecycle";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "../target-generator";
import { createInitialTargetLifecycle } from "../target-lifecycle";
import { INSTRUCTIONAL_BLOCK_RUNNER } from "./instructional-block-runner";
import { PATTERN_BLOCK_RUNNER } from "./pattern-block-runner";
import { registerAllBlockRunners } from "./register-all-block-runners";
import { TARGET_BLOCK_RUNNER } from "./target-block-runner";
import { tickActiveBlockRunner } from "./tick-active-block-runner";

const T0 = 7_000_000;

function nullPatternStates() {
  return {
    instructional: createInitialInstructionalLifecycle(),
    target: createInitialTargetLifecycle(),
    pattern: null,
  };
}

function patternStates() {
  const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
  return {
    instructional: createInitialInstructionalLifecycle(),
    target: createInitialTargetLifecycle(),
    pattern: createInitialPatternLifecycle(pattern.id),
  };
}

describe("tick-active-block-runner — missing runner", () => {
  it("produces runner_unavailable when the injected target resolver returns null", () => {
    registerAllBlockRunners();
    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-target",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states: nullPatternStates(),
      wrist: null,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      resolvers: { resolveTargetRunner: () => null },
    });
    assert.equal(result.status, "runner_unavailable");
    if (result.status !== "runner_unavailable") return;
    assert.equal(result.ticked, false);
    assert.equal(result.blockType, "movement-target");
    assert.match(result.reason, /No Block Runner registered/);
  });
});

describe("tick-active-block-runner — resolved runner is ticked", () => {
  it("calls tick() on the injected instructional runner, not a hardcoded constant", () => {
    let tickCalls = 0;
    const fakeRunner = {
      ...INSTRUCTIONAL_BLOCK_RUNNER,
      tick: () => {
        tickCalls += 1;
        return {
          state: { completed: false },
          ticked: true,
          completionEvent: null,
        };
      },
    };

    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "instructional",
      nowMs: T0,
      blockElapsedSeconds: 10,
      targetDurationSeconds: 60,
      states: nullPatternStates(),
      resolvers: { resolveInstructionalRunner: () => fakeRunner },
    });

    assert.equal(tickCalls, 1);
    assert.equal(result.status, "ticked");
  });

  it("calls tick() on the injected target runner, not a hardcoded constant", () => {
    let tickCalls = 0;
    const fakeRunner = {
      ...TARGET_BLOCK_RUNNER,
      tick: () => {
        tickCalls += 1;
        return {
          state: createInitialTargetLifecycle(),
          ticked: true,
          completionEvent: null,
        };
      },
    };

    tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-target",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states: nullPatternStates(),
      wrist: null,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      resolvers: { resolveTargetRunner: () => fakeRunner },
    });

    assert.equal(tickCalls, 1);
  });

  it("calls tick() on the injected pattern runner, not a hardcoded constant", () => {
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    let tickCalls = 0;
    const fakeRunner = {
      ...PATTERN_BLOCK_RUNNER,
      tick: () => {
        tickCalls += 1;
        return {
          state: createInitialPatternLifecycle(pattern.id),
          ticked: true,
          completionEvent: null,
        };
      },
    };

    tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-pattern",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states: patternStates(),
      wrist: null,
      pattern,
      resolvers: { resolvePatternRunner: () => fakeRunner },
    });

    assert.equal(tickCalls, 1);
  });
});

describe("tick-active-block-runner", () => {
  it("dispatch selects the instructional runner for instructional blocks", () => {
    registerAllBlockRunners();
    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "instructional",
      nowMs: T0,
      blockElapsedSeconds: 30,
      targetDurationSeconds: 60,
      states: nullPatternStates(),
    });
    assert.equal(result.status, "ticked");
    if (result.status !== "ticked") return;
    assert.equal(result.blockType, "instructional");
    assert.equal(result.presentationProgress, 0.5);
    assert.equal(result.targetContact, null);
    assert.equal(result.patternCompleted, null);
  });

  it("dispatch selects the target runner for movement-target blocks", () => {
    registerAllBlockRunners();
    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-target",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states: nullPatternStates(),
      wrist: null,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(result.status, "ticked");
    if (result.status !== "ticked") return;
    assert.equal(result.blockType, "movement-target");
    assert.ok(result.states.target.currentTarget);
    assert.equal(result.presentationProgress, null);
    assert.equal(result.patternCompleted, null);
  });

  it("dispatch selects the pattern runner for movement-pattern blocks", () => {
    registerAllBlockRunners();
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-pattern",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states: patternStates(),
      wrist: samplePathAtProgress(pattern.sampledPath, 0.05),
      pattern,
    });
    assert.equal(result.status, "ticked");
    if (result.status !== "ticked") return;
    assert.equal(result.blockType, "movement-pattern");
    assert.equal(result.targetContact, null);
    assert.equal(result.presentationProgress, null);
  });

  for (const sessionState of [
    "paused",
    "calibrating",
    "safetyHold",
    "stopped",
    "completed",
  ] as const) {
    it(`${sessionState} → not_active, ticked false`, () => {
      registerAllBlockRunners();
      const result = tickActiveBlockRunner({
        sessionState,
        blockType: "instructional",
        nowMs: T0,
        blockElapsedSeconds: 999,
        targetDurationSeconds: 1,
        states: nullPatternStates(),
      });
      assert.equal(result.status, "not_active");
      if (result.status !== "not_active") return;
      assert.equal(result.ticked, false);
      assert.equal(result.sessionState, sessionState);
    });
  }

  it("target completion maps to targetContact only — never patternCompleted", () => {
    registerAllBlockRunners();
    let states = nullPatternStates();
    const spawned = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-target",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states,
      wrist: null,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(spawned.status, "ticked");
    if (spawned.status !== "ticked") return;
    const target = spawned.states.target.currentTarget!;
    const hit = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-target",
      nowMs: T0 + 500,
      blockElapsedSeconds: 1,
      states: spawned.states,
      wrist: { x: target.x, y: target.y },
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(hit.status, "ticked");
    if (hit.status !== "ticked") return;
    assert.ok(hit.targetContact);
    assert.equal(hit.patternCompleted, null);
  });

  it("pattern completion maps to patternCompleted only — never targetContact", () => {
    registerAllBlockRunners();
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    let states = patternStates();
    let completionCount = 0;
    for (let i = 0; i <= 24; i += 1) {
      const progress = 0.05 + (0.93 * i) / 24;
      const ticked = tickActiveBlockRunner({
        sessionState: "active",
        blockType: "movement-pattern",
        nowMs: T0 + i * 50,
        blockElapsedSeconds: i,
        states,
        wrist: samplePathAtProgress(pattern.sampledPath, progress),
        pattern,
        completionExitTransitionMs: 0,
      });
      assert.equal(ticked.status, "ticked");
      if (ticked.status !== "ticked") return;
      states = ticked.states;
      if (ticked.patternCompleted) completionCount += 1;
      assert.equal(ticked.targetContact, null);
    }
    assert.equal(completionCount, 1);
  });

  it("instructional has no wrist input and never completes the block via dispatch", () => {
    registerAllBlockRunners();
    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "instructional",
      nowMs: T0,
      blockElapsedSeconds: 999,
      targetDurationSeconds: 1,
      states: nullPatternStates(),
    });
    assert.equal(result.status, "ticked");
    if (result.status !== "ticked") return;
    assert.equal(result.presentationProgress, 1);
    assert.equal(result.states.instructional.completed, false);
    assert.equal(result.targetContact, null);
    assert.equal(result.patternCompleted, null);
  });

  it("instructional and movement-target ticks accept pattern: null in shared runner states", () => {
    registerAllBlockRunners();
    const states = nullPatternStates();
    assert.equal(states.pattern, null);

    const instructional = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "instructional",
      nowMs: T0,
      blockElapsedSeconds: 5,
      targetDurationSeconds: 60,
      states,
    });
    assert.equal(instructional.status, "ticked");

    const target = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-target",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states,
      wrist: null,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.equal(target.status, "ticked");
    if (target.status !== "ticked") return;
    assert.equal(target.states.pattern, null);
  });

  it("movement-pattern tick requires non-null pattern lifecycle state at the type level", () => {
    registerAllBlockRunners();
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    const states = patternStates();
    assert.ok(states.pattern);
    assert.equal(states.pattern.patternId, pattern.id);

    const result = tickActiveBlockRunner({
      sessionState: "active",
      blockType: "movement-pattern",
      nowMs: T0,
      blockElapsedSeconds: 0,
      states,
      wrist: null,
      pattern,
    });
    assert.equal(result.status, "ticked");
  });
});
