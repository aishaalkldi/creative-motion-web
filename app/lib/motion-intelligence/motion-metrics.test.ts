/**
 * Run: npx tsx --test app/lib/motion-intelligence/motion-metrics.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILATERAL_KNEE_PAIR,
  computeBilateralSymmetryDifference,
  computeJointCoordinateSpan,
  computeJointDistance,
  computeRelativeJointOffset,
} from "./motion-metrics";
import {
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointId,
  type NormalizedMotionFrame,
} from "./types";

function syntheticFrame(
  joints: Partial<Record<JointId, { x: number; y: number; z?: number; visibility?: number }>>,
  frameIndex = 0,
  capturedAtMs = 1_000 + frameIndex * 33,
): NormalizedMotionFrame {
  const mapped = Object.fromEntries(
    Object.entries(joints).map(([jointId, landmark]) => [
      jointId,
      {
        landmark: {
          x: landmark.x,
          y: landmark.y,
          ...(landmark.z !== undefined ? { z: landmark.z } : {}),
        },
        confidence: {
          visibility: landmark.visibility ?? 0.9,
          present: true,
        },
      },
    ]),
  ) as NormalizedMotionFrame["joints"];

  return {
    schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
    source: {
      kind: "web_camera_pose",
      capturedAtMs,
      frameIndex,
      coordinateSpace: "normalized_2d",
    },
    joints: mapped,
  };
}

describe("computeJointDistance", () => {
  it("returns euclidean distance in normalized 2D space", () => {
    const frame = syntheticFrame({
      left_hip: { x: 0.2, y: 0.2 },
      left_knee: { x: 0.5, y: 0.6 },
    });

    const distance = computeJointDistance(frame, "left_hip", "left_knee");
    assert.ok(distance !== null);
    assert.ok(Math.abs(distance - 0.5) < 0.001);
  });

  it("returns null when a joint is missing", () => {
    const frame = syntheticFrame({ left_hip: { x: 0.2, y: 0.2 } });
    assert.equal(computeJointDistance(frame, "left_hip", "left_knee"), null);
  });

  it("supports 3D distance when z is present on both joints", () => {
    const frame = syntheticFrame({
      left_hip: { x: 0, y: 0, z: 0 },
      left_knee: { x: 0.3, y: 0.4, z: 0 },
    });

    const distance = computeJointDistance(frame, "left_hip", "left_knee", { use3D: true });
    assert.ok(distance !== null);
    assert.ok(Math.abs(distance - 0.5) < 0.001);
  });
});

describe("computeRelativeJointOffset", () => {
  it("returns signed deltaX and deltaY between two joints", () => {
    const frame = syntheticFrame({
      left_hip: { x: 0.2, y: 0.1 },
      left_knee: { x: 0.5, y: 0.5 },
    });

    const offset = computeRelativeJointOffset(frame, "left_hip", "left_knee");
    assert.deepEqual(offset, { deltaX: 0.3, deltaY: 0.4 });
  });

  it("returns null when confidence is below threshold", () => {
    const frame = syntheticFrame({
      left_hip: { x: 0.2, y: 0.1, visibility: 0.9 },
      left_knee: { x: 0.5, y: 0.5, visibility: 0.1 },
    });

    assert.equal(
      computeRelativeJointOffset(frame, "left_hip", "left_knee", { minVisibility: 0.5 }),
      null,
    );
  });
});

describe("computeBilateralSymmetryDifference", () => {
  it("returns absolute y-axis difference between paired joints", () => {
    const frame = syntheticFrame({
      left_knee: { x: 0.4, y: 0.5 },
      right_knee: { x: 0.6, y: 0.7 },
    });

    const difference = computeBilateralSymmetryDifference(
      frame,
      BILATERAL_KNEE_PAIR,
      "y",
    );
    assert.ok(difference !== null);
    assert.ok(Math.abs(difference - 0.2) < 0.001);
  });
});

describe("computeJointCoordinateSpan", () => {
  it("returns max-min coordinate span across confident frames", () => {
    const frames = [
      syntheticFrame({ left_knee: { x: 0.4, y: 0.4 } }, 0),
      syntheticFrame({ left_knee: { x: 0.4, y: 0.6 } }, 1),
      syntheticFrame({ left_knee: { x: 0.4, y: 0.5 } }, 2),
    ];

    const span = computeJointCoordinateSpan(frames, "left_knee", "y");
    assert.ok(span !== null);
    assert.ok(Math.abs(span - 0.2) < 0.001);
  });

  it("returns 0 when coordinate values are identical", () => {
    const frames = [
      syntheticFrame({ left_knee: { x: 0.4, y: 0.5 } }, 0),
      syntheticFrame({ left_knee: { x: 0.4, y: 0.5 } }, 1),
    ];

    assert.equal(computeJointCoordinateSpan(frames, "left_knee", "y"), 0);
  });

  it("returns null when fewer than two confident samples exist", () => {
    const frames = [syntheticFrame({ left_knee: { x: 0.4, y: 0.5 } }, 0)];
    assert.equal(computeJointCoordinateSpan(frames, "left_knee", "y"), null);
  });
});
