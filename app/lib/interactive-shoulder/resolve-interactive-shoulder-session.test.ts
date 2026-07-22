/**
 * Run: npx tsx --test app/lib/interactive-shoulder/resolve-interactive-shoulder-session.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REACH_THE_LIGHT_SESSION } from "./clinical-motion-pattern-session-definition";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./motion-patterns/d1-inspired-diagonal-reach-pattern";
import {
  resolveInteractiveShoulderSessionDefinition,
  resolveMotionPatternsFeatureFlag,
} from "./resolve-interactive-shoulder-session";

describe("resolveInteractiveShoulderSession", () => {
  it("20. feature flag disabled selects Reach the Light", () => {
    assert.equal(resolveMotionPatternsFeatureFlag(undefined), false);
    assert.equal(resolveMotionPatternsFeatureFlag("false"), false);
    assert.equal(resolveMotionPatternsFeatureFlag(""), false);
    const session = resolveInteractiveShoulderSessionDefinition(false);
    assert.equal(session.sessionId, REACH_THE_LIGHT_SESSION.sessionId);
    assert.notEqual(session.blocks[0]?.feedbackProfile, D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE);
  });

  it("21. feature flag enabled selects the diagonal pattern", () => {
    assert.equal(resolveMotionPatternsFeatureFlag("true"), true);
    const session = resolveInteractiveShoulderSessionDefinition(true);
    assert.equal(session.sessionId, "clinical-motion-pattern-v1");
    assert.equal(session.blocks[0]?.feedbackProfile, D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE);
    assert.equal(session.blocks[0]?.title, "D1-Inspired Diagonal Reach");
  });
});
