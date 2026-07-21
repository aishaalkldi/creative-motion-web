/**
 * Run: npx tsx --test app/lib/interactive-shoulder/clinical-motion-pattern-engine.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION,
  CLINICAL_MOTION_PATTERN_SESSION,
  REACH_THE_LIGHT_SESSION,
} from "./clinical-motion-pattern-session-definition";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./motion-patterns/d1-inspired-diagonal-reach-pattern";
import { REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE } from "./motion-patterns/motion-pattern-registry";
import {
  mapPatternCompletionToSessionInput,
  mapTargetHitToSessionInput,
} from "@/app/lib/session-orchestrator/adapters/shoulder-session-adapter";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import { resolveInteractiveShoulderSessionDefinition } from "./resolve-interactive-shoulder-session";

const T0 = 7_000_000;

describe("Clinical Motion Pattern Engine", () => {
  it("uses Reach the Light as the production-safe default when the feature flag is disabled", () => {
    const session = resolveInteractiveShoulderSessionDefinition(false);
    assert.equal(session.sessionId, REACH_THE_LIGHT_SESSION.sessionId);
    assert.equal(session.blocks[0]?.feedbackProfile, REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE);
  });

  it("enables D1-Inspired Diagonal Reach when the feature flag is enabled", () => {
    const session = resolveInteractiveShoulderSessionDefinition(true);
    assert.equal(session.sessionId, CLINICAL_MOTION_PATTERN_SESSION.sessionId);
    assert.equal(session.blocks[0]?.feedbackProfile, D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE);
    assert.equal(session.blocks[0]?.title, "D1-Inspired Diagonal Reach");
  });

  it("preserves the Reach the Light legacy session export", () => {
    assert.equal(
      REACH_THE_LIGHT_SESSION.blocks[0]?.feedbackProfile,
      REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
    );
  });

  it("executes sequential pattern blocks through the Session Orchestrator", () => {
    assert.equal(CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION.blocks.length, 2);
    assert.equal(
      CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION.blocks[0]?.feedbackProfile,
      D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE,
    );
    assert.equal(
      CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION.blocks[1]?.feedbackProfile,
      REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
    );

    const orchestrator = new SessionOrchestrator(CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION);
    orchestrator.start(T0);
    orchestrator.beginCalibration(T0);
    orchestrator.completeCalibration(T0);
    assert.equal(
      orchestrator.getSnapshot(T0).currentBlock?.blockId,
      "d1-inspired-diagonal-reach-sequence",
    );

    orchestrator.reportInputEvent(
      { type: "patternCompleted", patternId: "d1-inspired-diagonal-reach", capturedAtMs: T0 + 10_000 },
      T0 + 10_000,
    );
    orchestrator.tick(T0 + 61_000);
    orchestrator.tick(T0 + 66_000);
    const afterFirst = orchestrator.getSnapshot(T0 + 66_000);
    assert.equal(afterFirst.currentBlock?.blockId, "reach-the-light-sequence");
  });

  it("maps pattern completion to patternCompleted — not targetContact", () => {
    const patternEvent = mapPatternCompletionToSessionInput({
      patternId: "d1-inspired-diagonal-reach",
      capturedAtMs: T0,
      reactionTimeMs: 1200,
      pathProgress: 0.95,
    });
    const targetEvent = mapTargetHitToSessionInput({
      targetId: "target-1",
      capturedAtMs: T0,
      reactionTimeMs: 1200,
    });
    assert.deepEqual(patternEvent, {
      type: "patternCompleted",
      patternId: "d1-inspired-diagonal-reach",
      capturedAtMs: T0,
    });
    assert.deepEqual(targetEvent, { type: "targetContact", capturedAtMs: T0 });
    assert.notDeepEqual(patternEvent, targetEvent);
  });

  it("16–19. patternCompleted, targetContact, and validRepetition stay separate in orchestrator metrics", () => {
    const orchestrator = new SessionOrchestrator(CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION);
    orchestrator.start(T0);
    orchestrator.beginCalibration(T0);
    orchestrator.completeCalibration(T0);

    orchestrator.reportInputEvent(
      { type: "patternCompleted", patternId: "d1-inspired-diagonal-reach", capturedAtMs: T0 + 1_000 },
      T0 + 1_000,
    );
    orchestrator.reportInputEvent({ type: "validRepetition", capturedAtMs: T0 + 2_000 }, T0 + 2_000);
    orchestrator.tick(T0 + 61_000);
    orchestrator.tick(T0 + 66_000);

    orchestrator.reportInputEvent({ type: "targetContact", capturedAtMs: T0 + 70_000 }, T0 + 70_000);

    const snapshot = orchestrator.getSnapshot(T0 + 80_000);
    const patternBlock = snapshot.accumulatedBlockResults[0];
    const targetBlock = snapshot.accumulatedBlockResults[1];
    assert.ok(patternBlock);
    assert.ok(targetBlock);
    assert.equal(patternBlock.interaction.patternsCompleted, 1);
    assert.equal(patternBlock.interaction.targetsContacted, 0);
    assert.equal(targetBlock.interaction.targetsContacted, 1);
    assert.equal(targetBlock.interaction.patternsCompleted, 0);
    assert.equal(patternBlock.measured.validRepetitions, 1);
    assert.equal("patternsCompleted" in patternBlock.measured, false);
    assert.equal("targetsContacted" in patternBlock.measured, false);
  });

  it("keeps the clinical motion pattern session duration-driven", () => {
    assert.equal(CLINICAL_MOTION_PATTERN_SESSION.blocks[0]?.completionMode, "duration");
    assert.equal(CLINICAL_MOTION_PATTERN_SESSION.blocks[0]?.targetDurationSeconds, 90);
  });
});
