/**
 * Run: npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-metrics.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointId,
  type NormalizedMotionFrame,
} from "@/app/lib/motion-intelligence";
import { DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS } from "./shoulder-abduction-reach-contract";
import {
  computeBilateralAbductionAngleDifference,
  computeShoulderAbductionAngle,
  computeShoulderAbductionReachSideMetrics,
  computeShoulderAbductionWristOffset,
} from "./shoulder-abduction-reach-metrics";

const MIN_CONFIDENCE = DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.minJointConfidence;

function buildFrame(
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
      confidence: { visibility, present: visibility >= MIN_CONFIDENCE },
    };
  }
  return {
    schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
    source: { kind: "web_camera_pose", capturedAtMs: 0, frameIndex: 0, coordinateSpace: "normalized_2d" },
    joints: jointMap,
  };
}

/** Shoulder at (0.5, 0.5); hip straight below it — the trunk reference vector. */
function restingLeftArmFrame(): NormalizedMotionFrame {
  return buildFrame({
    left_hip: { x: 0.5, y: 0.7 },
    left_shoulder: { x: 0.5, y: 0.5 },
    left_elbow: { x: 0.5, y: 0.68 }, // parallel to shoulder->hip: ~0 degrees
  });
}

function horizontalLeftArmFrame(): NormalizedMotionFrame {
  return buildFrame({
    left_hip: { x: 0.5, y: 0.7 },
    left_shoulder: { x: 0.5, y: 0.5 },
    left_elbow: { x: 0.7, y: 0.5 }, // perpendicular to shoulder->hip: 90 degrees
  });
}

function overheadLeftArmFrame(): NormalizedMotionFrame {
  return buildFrame({
    left_hip: { x: 0.5, y: 0.7 },
    left_shoulder: { x: 0.5, y: 0.5 },
    left_elbow: { x: 0.5, y: 0.3 }, // opposite direction to shoulder->hip: 180 degrees
  });
}

describe("computeShoulderAbductionAngle — geometry", () => {
  it("reads ~0 degrees when the arm hangs at rest", () => {
    const angle = computeShoulderAbductionAngle(restingLeftArmFrame(), "left", MIN_CONFIDENCE);
    assert.ok(angle !== null && Math.abs(angle - 0) < 1e-6);
  });

  it("reads ~90 degrees when the arm is abducted to horizontal", () => {
    const angle = computeShoulderAbductionAngle(horizontalLeftArmFrame(), "left", MIN_CONFIDENCE);
    assert.ok(angle !== null && Math.abs(angle - 90) < 1e-6);
  });

  it("reads ~180 degrees when the arm is raised overhead", () => {
    const angle = computeShoulderAbductionAngle(overheadLeftArmFrame(), "left", MIN_CONFIDENCE);
    assert.ok(angle !== null && Math.abs(angle - 180) < 1e-6);
  });

  it("returns null when a required joint is entirely absent from the frame", () => {
    const frame = buildFrame({
      left_hip: { x: 0.5, y: 0.7 },
      left_shoulder: { x: 0.5, y: 0.5 },
      // left_elbow intentionally omitted
    });
    assert.equal(computeShoulderAbductionAngle(frame, "left", MIN_CONFIDENCE), null);
  });

  it("returns null when a required joint is below the confidence threshold", () => {
    const frame = buildFrame({
      left_hip: { x: 0.5, y: 0.7 },
      left_shoulder: { x: 0.5, y: 0.5 },
      left_elbow: { x: 0.7, y: 0.5, visibility: 0.05 },
    });
    assert.equal(computeShoulderAbductionAngle(frame, "left", MIN_CONFIDENCE), null);
  });

  it("tracks left and right sides independently", () => {
    const frame = buildFrame({
      left_hip: { x: 0.5, y: 0.7 },
      left_shoulder: { x: 0.5, y: 0.5 },
      left_elbow: { x: 0.5, y: 0.68 }, // ~0 degrees
      right_hip: { x: 0.3, y: 0.7 },
      right_shoulder: { x: 0.3, y: 0.5 },
      right_elbow: { x: 0.5, y: 0.5 }, // ~90 degrees
    });

    const left = computeShoulderAbductionAngle(frame, "left", MIN_CONFIDENCE);
    const right = computeShoulderAbductionAngle(frame, "right", MIN_CONFIDENCE);

    assert.ok(left !== null && Math.abs(left - 0) < 1e-6);
    assert.ok(right !== null && Math.abs(right - 90) < 1e-6);
  });
});

describe("computeShoulderAbductionWristOffset", () => {
  it("reports a negative deltaY when the wrist is above the shoulder", () => {
    const frame = buildFrame({
      left_shoulder: { x: 0.5, y: 0.5 },
      left_wrist: { x: 0.5, y: 0.3 },
    });
    const offset = computeShoulderAbductionWristOffset(frame, "left", MIN_CONFIDENCE);
    assert.ok(offset !== null);
    assert.ok(Math.abs(offset.deltaY - -0.2) < 1e-9);
  });

  it("returns null when the wrist is not tracked", () => {
    const frame = buildFrame({ left_shoulder: { x: 0.5, y: 0.5 } });
    assert.equal(computeShoulderAbductionWristOffset(frame, "left", MIN_CONFIDENCE), null);
  });
});

describe("computeShoulderAbductionReachSideMetrics", () => {
  it("bundles angle and wrist offset for one side", () => {
    const frame = buildFrame({
      left_hip: { x: 0.5, y: 0.7 },
      left_shoulder: { x: 0.5, y: 0.5 },
      left_elbow: { x: 0.7, y: 0.5 },
      left_wrist: { x: 0.9, y: 0.5 },
    });

    const metrics = computeShoulderAbductionReachSideMetrics(frame, "left", MIN_CONFIDENCE);

    assert.equal(metrics.side, "left");
    assert.ok(metrics.abductionAngleDegrees !== null && Math.abs(metrics.abductionAngleDegrees - 90) < 1e-6);
    assert.ok(metrics.wristOffsetFromShoulder !== null);
  });
});

describe("computeBilateralAbductionAngleDifference", () => {
  it("subtracts right from left", () => {
    assert.equal(computeBilateralAbductionAngleDifference(90, 30), 60);
  });

  it("returns null when either side is null", () => {
    assert.equal(computeBilateralAbductionAngleDifference(null, 30), null);
    assert.equal(computeBilateralAbductionAngleDifference(90, null), null);
    assert.equal(computeBilateralAbductionAngleDifference(null, null), null);
  });
});
