/**
 * Run: npx tsx --test app/lib/cv/shoulder-abduction-reach-compensation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointId,
  type NormalizedMotionFrame,
} from "@/app/lib/motion-intelligence";
import {
  createShoulderAbductionReachCompensationState,
  updateShoulderAbductionReachCompensation,
} from "./shoulder-abduction-reach-compensation";

function syntheticFrame(
  joints: Partial<Record<JointId, { x: number; y: number; visibility?: number }>>,
): NormalizedMotionFrame {
  const mapped = Object.fromEntries(
    Object.entries(joints).map(([jointId, landmark]) => [
      jointId,
      {
        landmark: { x: landmark.x, y: landmark.y },
        confidence: { visibility: landmark.visibility ?? 0.9, present: true },
      },
    ]),
  ) as NormalizedMotionFrame["joints"];

  return {
    schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
    source: { kind: "web_camera_pose", capturedAtMs: 1_000, frameIndex: 0, coordinateSpace: "normalized_2d" },
    joints: mapped,
  };
}

function frameWithHipShoulder(hipX: number, shoulderX: number): NormalizedMotionFrame {
  return syntheticFrame({
    left_hip: { x: hipX, y: 0.6 },
    left_shoulder: { x: shoulderX, y: 0.3 },
  });
}

describe("updateShoulderAbductionReachCompensation", () => {
  it("returns unavailable when required joints are missing", () => {
    const state = createShoulderAbductionReachCompensationState();
    const frame = syntheticFrame({ left_hip: { x: 0.5, y: 0.6 } });
    const status = updateShoulderAbductionReachCompensation(state, frame, "left", true);
    assert.equal(status, "unavailable");
  });

  it("captures a baseline only during the resting phase", () => {
    const state = createShoulderAbductionReachCompensationState();
    const frame = frameWithHipShoulder(0.5, 0.5);

    const notResting = updateShoulderAbductionReachCompensation(state, frame, "left", false);
    assert.equal(notResting, "unavailable");
    assert.equal(state.baselineDeltaX, null);

    const resting = updateShoulderAbductionReachCompensation(state, frame, "left", true);
    assert.equal(resting, "baseline_captured");
    assert.equal(state.baselineDeltaX, 0);
  });

  it("stays clear when drift is within threshold", () => {
    const state = createShoulderAbductionReachCompensationState();
    updateShoulderAbductionReachCompensation(state, frameWithHipShoulder(0.5, 0.5), "left", true);

    const status = updateShoulderAbductionReachCompensation(
      state,
      frameWithHipShoulder(0.5, 0.52),
      "left",
      false,
    );
    assert.equal(status, "clear");
    assert.equal(state.flagged, false);
  });

  it("flags once drift crosses the threshold, and clears with hysteresis", () => {
    const state = createShoulderAbductionReachCompensationState();
    updateShoulderAbductionReachCompensation(state, frameWithHipShoulder(0.5, 0.5), "left", true);

    const flagged = updateShoulderAbductionReachCompensation(
      state,
      frameWithHipShoulder(0.5, 0.6),
      "left",
      false,
    );
    assert.equal(flagged, "flagged");
    assert.equal(state.flagged, true);

    const stillFlagged = updateShoulderAbductionReachCompensation(
      state,
      frameWithHipShoulder(0.5, 0.58),
      "left",
      false,
    );
    assert.equal(stillFlagged, "flagged", "hysteresis keeps it flagged just below the raise threshold");

    const cleared = updateShoulderAbductionReachCompensation(
      state,
      frameWithHipShoulder(0.5, 0.51),
      "left",
      false,
    );
    assert.equal(cleared, "clear");
    assert.equal(state.flagged, false);
  });

  it("uses independent state per side", () => {
    const state = createShoulderAbductionReachCompensationState();
    updateShoulderAbductionReachCompensation(state, frameWithHipShoulder(0.5, 0.5), "left", true);
    assert.equal(state.baselineDeltaX, 0);
    // A fresh state object is required per side by callers — this test documents that
    // one state instance tracks exactly one side, not both.
  });
});
