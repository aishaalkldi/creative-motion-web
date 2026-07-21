/**
 * Run: npx tsx --test app/lib/interactive-shoulder/resolve-interactive-shoulder-side.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShoulderAbductionReachPoseDetector } from "@/app/lib/cv/shoulder-abduction-reach-pose-detector";
import { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION } from "./shoulder-abduction-reach-session-definition";
import {
  INTERACTIVE_SHOULDER_DEFAULT_SIDE,
  resolveInteractiveShoulderSide,
} from "./resolve-interactive-shoulder-side";
import { createInitialTargetLifecycle, tickTargetLifecycle } from "./target-lifecycle";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "./target-generator";

describe("resolveInteractiveShoulderSide", () => {
  it("uses prescribed side when a supported left/right value is supplied", () => {
    const resolved = resolveInteractiveShoulderSide({
      prescribedSide: "left",
      blockSide: "right",
    });
    assert.equal(resolved.side, "left");
    assert.equal(resolved.source, "prescribed");
    assert.equal(resolved.usedFallback, false);
  });

  it("uses block side when prescribed side is absent", () => {
    const blockSide = SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION.blocks[0]?.side;
    const resolved = resolveInteractiveShoulderSide({ blockSide });
    assert.equal(resolved.side, "right");
    assert.equal(resolved.source, "block");
    assert.equal(resolved.usedFallback, false);
  });

  it("uses explicit fallback only when neither prescribed nor unilateral block side exists", () => {
    const resolved = resolveInteractiveShoulderSide({
      prescribedSide: null,
      blockSide: undefined,
    });
    assert.equal(resolved.side, INTERACTIVE_SHOULDER_DEFAULT_SIDE);
    assert.equal(resolved.source, "fallback");
    assert.equal(resolved.usedFallback, true);
  });

  it("treats bilateral block side as non-unilateral and falls back to the named default", () => {
    const resolved = resolveInteractiveShoulderSide({
      blockSide: "bilateral",
    });
    assert.equal(resolved.side, INTERACTIVE_SHOULDER_DEFAULT_SIDE);
    assert.equal(resolved.source, "fallback");
    assert.equal(resolved.usedFallback, true);
  });

  it("feeds the same resolved side to detector construction and target lifecycle", () => {
    const resolved = resolveInteractiveShoulderSide({
      prescribedSide: "left",
      blockSide: "right",
    });

    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} }, resolved.side);
    assert.equal(detector.getSnapshot().primarySide, resolved.side);

    const spawned = tickTargetLifecycle(createInitialTargetLifecycle(), {
      wrist: null,
      nowMs: 1_000,
      side: resolved.side,
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      random: () => 0.5,
    });
    assert.ok(spawned.state.currentTarget);
    assert.equal(resolved.side, "left");
    void spawned;
  });
});
