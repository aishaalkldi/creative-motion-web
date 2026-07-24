/**
 * Run: npx tsx --test app/lib/interactive-shoulder/orchestrator-cv-block-dispatch.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerAllBlockRunners } from "./block-engine/register-all-block-runners";
import { INSTRUCTIONAL_BLOCK_RUNNER } from "./block-engine/instructional-block-runner";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./motion-patterns/d1-inspired-diagonal-reach-pattern";
import { resolveActiveMotionPattern } from "./motion-patterns/motion-pattern-registry";
import { createInitialInstructionalLifecycle } from "./instructional-lifecycle";
import { createInitialTargetLifecycle } from "./target-lifecycle";
import { createInitialPatternLifecycle } from "./motion-patterns/pattern-lifecycle";
import { samplePathAtProgress } from "./motion-patterns/bezier-path";
import { toSessionDefinition } from "@/app/lib/rehab-programs/rehab-program-runtime-adapter";
import { STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1 } from "@/app/lib/rehab-programs/stroke-upper-limb-recovery-foundation";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";
import { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION } from "./shoulder-abduction-reach-session-definition";
import {
  dispatchOrchestratorCvBlock,
  resetRunnerStatesForBlockTransition,
  resolveOrchestratorBlockType,
} from "./orchestrator-cv-block-dispatch";

const T0 = 8_000_000;

function emptyStates() {
  return {
    instructional: createInitialInstructionalLifecycle(),
    target: createInitialTargetLifecycle(),
    pattern: createInitialPatternLifecycle(""),
  };
}

function activeSnap(block = SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION.blocks[0]): SessionOrchestratorSnapshot {
  return {
    sessionState: "active",
    blockProgress: 0,
    blockElapsedSeconds: 0,
    safetyStatus: "normal",
    isPaused: false,
    patientFeedbackState: { message: null, encouragement: null },
    currentBlock: block,
    accumulatedBlockResults: [],
  } as SessionOrchestratorSnapshot;
}

describe("orchestrator-cv-block-dispatch", () => {
  registerAllBlockRunners();

  it("target mode skips dispatch until wrist data exists", () => {
    const result = dispatchOrchestratorCvBlock({
      snap: activeSnap(),
      nowMs: T0,
      wrist: null,
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
    });
    assert.equal(result.status, "skipped");
    if (result.status !== "skipped") return;
    assert.equal(result.reason, "target_wrist_required");
  });

  it("movement-pattern may tick with wrist null", () => {
    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    const patternBlock = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1).blocks[2];
    const states = resetRunnerStatesForBlockTransition({
      block: patternBlock,
      side: "right",
    }).states;
    const result = dispatchOrchestratorCvBlock({
      snap: activeSnap(patternBlock),
      nowMs: T0,
      wrist: null,
      side: "right",
      hitExitTransitionMs: 0,
      states,
      activeMotionPattern: pattern,
    });
    assert.equal(result.status, "dispatched");
  });

  it("instructional dispatch requires no wrist and produces presentation progress only", () => {
    const warmUp = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1).blocks[0];
    const result = dispatchOrchestratorCvBlock({
      snap: activeSnap(warmUp),
      nowMs: T0,
      wrist: { x: 0.9, y: 0.9 },
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
    });
    assert.equal(result.status, "dispatched");
    if (result.status !== "dispatched") return;
    assert.equal(result.targetContact, null);
    assert.equal(result.patternCompleted, null);
    assert.ok(result.presentationProgress != null);
    assert.equal(result.states.instructional.completed, false);
  });

  it("paused session state does not dispatch runners", () => {
    const snap = { ...activeSnap(), sessionState: "paused" as const };
    const result = dispatchOrchestratorCvBlock({
      snap,
      nowMs: T0,
      wrist: { x: 0.5, y: 0.5 },
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
    });
    assert.equal(result.status, "not_active");
  });

  it("safetyHold session state does not dispatch runners", () => {
    const snap = { ...activeSnap(), sessionState: "safetyHold" as const };
    const result = dispatchOrchestratorCvBlock({
      snap,
      nowMs: T0,
      wrist: { x: 0.5, y: 0.5 },
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
    });
    assert.equal(result.status, "not_active");
  });

  it("targetContact and patternCompleted never cross-map", () => {
    let states = emptyStates();
    const spawned = dispatchOrchestratorCvBlock({
      snap: activeSnap(),
      nowMs: T0,
      wrist: null,
      side: "right",
      hitExitTransitionMs: 0,
      states,
      activeMotionPattern: null,
    });
    assert.equal(spawned.status, "skipped");

    const withSpawn = dispatchOrchestratorCvBlock({
      snap: activeSnap(),
      nowMs: T0,
      wrist: { x: 0.5, y: 0.35 },
      side: "right",
      hitExitTransitionMs: 0,
      states,
      activeMotionPattern: null,
    });
    assert.equal(withSpawn.status, "dispatched");
    if (withSpawn.status !== "dispatched") return;
    states = withSpawn.states;
    const target = states.target.currentTarget!;
    const hit = dispatchOrchestratorCvBlock({
      snap: activeSnap(),
      nowMs: T0 + 500,
      wrist: { x: target.x, y: target.y },
      side: "right",
      hitExitTransitionMs: 0,
      states,
      activeMotionPattern: null,
    });
    assert.equal(hit.status, "dispatched");
    if (hit.status !== "dispatched") return;
    assert.ok(hit.targetContact);
    assert.equal(hit.patternCompleted, null);

    const pattern = resolveActiveMotionPattern(D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE, "right")!;
    const patternBlock = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1).blocks[2];
    let patternStates = resetRunnerStatesForBlockTransition({
      block: patternBlock,
      side: "right",
    }).states;
    let completionCount = 0;
    for (let i = 0; i <= 24; i += 1) {
      const progress = 0.05 + (0.93 * i) / 24;
      const ticked = dispatchOrchestratorCvBlock({
        snap: activeSnap(patternBlock),
        nowMs: T0 + i * 50,
        wrist: samplePathAtProgress(pattern.sampledPath, progress),
        side: "right",
        hitExitTransitionMs: 0,
        states: patternStates,
        activeMotionPattern: pattern,
      });
      assert.equal(ticked.status, "dispatched");
      if (ticked.status !== "dispatched") return;
      patternStates = ticked.states;
      if (ticked.patternCompleted) completionCount += 1;
      assert.equal(ticked.targetContact, null);
    }
    assert.equal(completionCount, 1);
  });

  it("null target resolver produces runner_unavailable fault", () => {
    const result = dispatchOrchestratorCvBlock({
      snap: activeSnap(),
      nowMs: T0,
      wrist: { x: 0.5, y: 0.35 },
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
      resolvers: { resolveTargetRunner: () => null },
    });
    assert.equal(result.status, "fault");
    if (result.status !== "fault") return;
    assert.equal(result.fault.kind, "runner_unavailable");
    assert.equal(result.fault.blockType, "movement-target");
  });

  it("unresolved motion pattern block produces pattern_unresolved fault on transition", () => {
    const transition = resetRunnerStatesForBlockTransition({
      block: {
        ...SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION.blocks[0],
        blockId: "broken-pattern-block",
        blockType: "movement-pattern",
        feedbackProfile: "unknown-pattern-profile",
      },
      side: "right",
    });
    assert.ok(transition.fault);
    assert.equal(transition.fault?.kind, "pattern_unresolved");
    assert.equal(transition.activeMotionPattern, null);
  });

  it("dispatch returns pattern_unresolved when activeMotionPattern is missing at runtime", () => {
    const patternBlock = {
      ...SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION.blocks[0],
      blockId: "runtime-pattern-block",
      blockType: "movement-pattern" as const,
      feedbackProfile: D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE,
    };
    const result = dispatchOrchestratorCvBlock({
      snap: activeSnap(patternBlock),
      nowMs: T0,
      wrist: { x: 0.5, y: 0.5 },
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
    });
    assert.equal(result.status, "fault");
    if (result.status !== "fault") return;
    assert.equal(result.fault.kind, "pattern_unresolved");
  });

  it("block transition resets instructional, target, and pattern runner states", () => {
    const warmUp = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1).blocks[0];
    const reach = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1).blocks[1];
    const warmTransition = resetRunnerStatesForBlockTransition({ block: warmUp, side: "right" });
    assert.equal(resolveOrchestratorBlockType(warmUp), "instructional");
    assert.equal(warmTransition.fault, null);

    const reachTransition = resetRunnerStatesForBlockTransition({ block: reach, side: "right" });
    assert.equal(resolveOrchestratorBlockType(reach), "movement-target");
    assert.equal(reachTransition.states.target.sequence, 0);
    assert.equal(reachTransition.states.instructional.completed, false);
  });

  it("injected instructional runner tick() is executed by dispatch", () => {
    let tickCalls = 0;
    const warmUp = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1).blocks[0];
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
    dispatchOrchestratorCvBlock({
      snap: activeSnap(warmUp),
      nowMs: T0,
      wrist: null,
      side: "right",
      hitExitTransitionMs: 0,
      states: emptyStates(),
      activeMotionPattern: null,
      resolvers: { resolveInstructionalRunner: () => fakeRunner },
    });
    assert.equal(tickCalls, 1);
  });
});

describe("orchestrator cv session core contract — stroke four-block session", () => {
  it("accepts Stroke ULRF Session 1 and completes through orchestrator duration simulation", () => {
    registerAllBlockRunners();
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    const orchestrator = new SessionOrchestrator(definition);
    let nowMs = T0;
    orchestrator.start(nowMs);
    orchestrator.beginCalibration(nowMs);
    orchestrator.completeCalibration(nowMs);

    for (const block of definition.blocks) {
      assert.ok(resolveOrchestratorBlockType(block));
      nowMs += (block.targetDurationSeconds ?? 0) * 1_000;
      orchestrator.tick(nowMs);
    }

    const snap = orchestrator.getSnapshot(nowMs);
    assert.equal(snap.sessionState, "completed");
    assert.equal(orchestrator.getSessionPerformanceSummary(nowMs).blocksCompleted, 4);
  });
});
