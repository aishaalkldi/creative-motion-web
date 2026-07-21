/**
 * Run: npx tsx --test app/lib/interactive-shoulder/clinical-motion-pattern-engine.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION,
  CLINICAL_MOTION_PATTERN_SESSION,
  INTERACTIVE_SHOULDER_DEFAULT_SESSION,
  REACH_THE_LIGHT_SESSION,
} from "./clinical-motion-pattern-session-definition";
import { PNF_D1_FLEXION_FEEDBACK_PROFILE } from "./motion-patterns/pnf-d1-flexion-pattern";
import { REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE } from "./motion-patterns/motion-pattern-registry";
import {
  mapPatternCompletionToSessionInput,
  mapTargetHitToSessionInput,
} from "@/app/lib/session-orchestrator/adapters/shoulder-session-adapter";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";

const T0 = 7_000_000;

describe("Clinical Motion Pattern Engine", () => {
  it("uses PNF D1 Flexion as the default interactive shoulder session", () => {
    assert.equal(INTERACTIVE_SHOULDER_DEFAULT_SESSION.sessionId, "clinical-motion-pattern-v1");
    assert.equal(
      INTERACTIVE_SHOULDER_DEFAULT_SESSION.blocks[0]?.feedbackProfile,
      PNF_D1_FLEXION_FEEDBACK_PROFILE,
    );
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
      PNF_D1_FLEXION_FEEDBACK_PROFILE,
    );
    assert.equal(
      CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION.blocks[1]?.feedbackProfile,
      REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
    );

    const orchestrator = new SessionOrchestrator(CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION);
    orchestrator.start(T0);
    orchestrator.beginCalibration(T0);
    orchestrator.completeCalibration(T0);
    assert.equal(orchestrator.getSnapshot(T0).currentBlock?.blockId, "pnf-d1-flexion-sequence");

    orchestrator.tick(T0 + 61_000);
    orchestrator.reportInputEvent({ type: "targetContact", capturedAtMs: T0 + 10_000 }, T0 + 10_000);
    orchestrator.tick(T0 + 66_000);
    const afterFirst = orchestrator.getSnapshot(T0 + 66_000);
    assert.equal(afterFirst.currentBlock?.blockId, "reach-the-light-sequence");
  });

  it("maps pattern completion to the same orchestrator interaction event as target hits", () => {
    const patternEvent = mapPatternCompletionToSessionInput({
      patternId: "pnf-d1-flexion",
      capturedAtMs: T0,
      reactionTimeMs: 1200,
      pathProgress: 0.95,
    });
    const targetEvent = mapTargetHitToSessionInput({
      targetId: "target-1",
      capturedAtMs: T0,
      reactionTimeMs: 1200,
    });
    assert.deepEqual(patternEvent, targetEvent);
  });

  it("keeps the production clinical session duration-driven", () => {
    assert.equal(CLINICAL_MOTION_PATTERN_SESSION.blocks[0]?.completionMode, "duration");
    assert.equal(CLINICAL_MOTION_PATTERN_SESSION.blocks[0]?.targetDurationSeconds, 90);
  });
});
