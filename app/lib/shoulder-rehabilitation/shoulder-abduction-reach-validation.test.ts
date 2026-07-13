/**
 * Run: npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointId,
  type NormalizedMotionFrame,
} from "@/app/lib/motion-intelligence";
import { DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS } from "./shoulder-abduction-reach-contract";
import { validateShoulderAbductionReachFrames } from "./shoulder-abduction-reach-validation";

function buildFrame(
  frameIndex: number,
  joints: Partial<Record<JointId, { x: number; y: number; visibility?: number }>>,
): NormalizedMotionFrame {
  const jointMap: NormalizedMotionFrame["joints"] = {};
  for (const [jointId, landmark] of Object.entries(joints) as [
    JointId,
    { x: number; y: number; visibility?: number },
  ][]) {
    const visibility = landmark.visibility ?? 0.9;
    jointMap[jointId] = {
      landmark: { x: landmark.x, y: landmark.y },
      confidence: { visibility, present: visibility >= 0 },
    };
  }
  return {
    schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
    source: { kind: "web_camera_pose", capturedAtMs: frameIndex * 33, frameIndex, coordinateSpace: "normalized_2d" },
    joints: jointMap,
  };
}

function fullyTrackedLeftFrame(frameIndex: number): NormalizedMotionFrame {
  return buildFrame(frameIndex, {
    left_hip: { x: 0.5, y: 0.7 },
    left_shoulder: { x: 0.5, y: 0.5 },
    left_elbow: { x: 0.7, y: 0.5 },
  });
}

describe("validateShoulderAbductionReachFrames", () => {
  it("passes when hip/shoulder/elbow are all confidently tracked", () => {
    const result = validateShoulderAbductionReachFrames(
      [fullyTrackedLeftFrame(0)],
      "left",
      DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
    );
    assert.equal(result.valid, true);
  });

  it("fails when the elbow is missing for the requested side", () => {
    const frame = buildFrame(0, {
      left_hip: { x: 0.5, y: 0.7 },
      left_shoulder: { x: 0.5, y: 0.5 },
    });
    const result = validateShoulderAbductionReachFrames(
      [frame],
      "left",
      DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
    );
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((reason) => reason.code === "missing_required_joint"));
  });

  it("is independent per side — right-side tracking does not satisfy a left-side check", () => {
    const frame = buildFrame(0, {
      right_hip: { x: 0.3, y: 0.7 },
      right_shoulder: { x: 0.3, y: 0.5 },
      right_elbow: { x: 0.5, y: 0.5 },
    });
    const result = validateShoulderAbductionReachFrames(
      [frame],
      "left",
      DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
    );
    assert.equal(result.valid, false);
  });

  it("fails below the configured confidence threshold", () => {
    const frame = buildFrame(0, {
      left_hip: { x: 0.5, y: 0.7, visibility: 0.05 },
      left_shoulder: { x: 0.5, y: 0.5, visibility: 0.05 },
      left_elbow: { x: 0.7, y: 0.5, visibility: 0.05 },
    });
    const result = validateShoulderAbductionReachFrames(
      [frame],
      "left",
      DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
    );
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((reason) => reason.code === "confidence_below_minimum"));
  });

  it("fails when fewer valid frames than minFrameCount are present", () => {
    const result = validateShoulderAbductionReachFrames(
      [fullyTrackedLeftFrame(0)],
      "left",
      { ...DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS, minFrameCount: 5 },
    );
    assert.equal(result.valid, false);
    assert.equal(result.validFrameCount, 1);
  });

  it("reports empty_sequence for an empty frame list", () => {
    const result = validateShoulderAbductionReachFrames(
      [],
      "left",
      DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
    );
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((reason) => reason.code === "empty_sequence"));
  });
});
