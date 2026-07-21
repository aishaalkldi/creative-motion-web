/**
 * Run: npx tsx --test app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
  resolveActiveMotionPattern,
  resolveFeedbackInteractionMode,
  resolveMotionPatternSequenceForSession,
} from "./motion-pattern-registry";
import { PNF_D1_FLEXION_FEEDBACK_PROFILE } from "./pnf-d1-flexion-pattern";

describe("motion-pattern-registry", () => {
  it("resolves PNF D1 Flexion as a motion-pattern mode", () => {
    assert.equal(resolveFeedbackInteractionMode(PNF_D1_FLEXION_FEEDBACK_PROFILE), "motion-pattern");
    const pattern = resolveActiveMotionPattern(PNF_D1_FLEXION_FEEDBACK_PROFILE, "right");
    assert.ok(pattern);
    assert.equal(pattern.id, "pnf-d1-flexion");
    assert.ok(pattern.sampledPath.totalLength > 0);
  });

  it("preserves Reach the Light target mode for the legacy feedback profile", () => {
    assert.equal(
      resolveFeedbackInteractionMode(REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE),
      "reach-the-light-targets",
    );
    assert.equal(resolveActiveMotionPattern(REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE, "right"), null);
  });

  it("mirrors pattern paths for the left therapeutic side", () => {
    const right = resolveActiveMotionPattern(PNF_D1_FLEXION_FEEDBACK_PROFILE, "right");
    const left = resolveActiveMotionPattern(PNF_D1_FLEXION_FEEDBACK_PROFILE, "left");
    assert.ok(right && left);
    assert.notEqual(
      right.sampledPath.segments[0]!.start.x,
      left.sampledPath.segments[0]!.start.x,
    );
  });

  it("resolves sequential session patterns for orchestrator blocks", () => {
    const sequence = resolveMotionPatternSequenceForSession(
      [PNF_D1_FLEXION_FEEDBACK_PROFILE, REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE],
      "right",
    );
    assert.equal(sequence.length, 1);
    assert.equal(sequence[0]?.id, "pnf-d1-flexion");
  });
});
