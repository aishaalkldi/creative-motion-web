/**
 * Run: npx tsx --test app/lib/motion-intelligence/metric-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateMinimumConfidence,
  validateMinimumFrameCount,
  validateMotionMetricInput,
  validateRequiredJoints,
  type MotionMetricRequirement,
} from "./metric-validation";
import {
  DEFAULT_MIN_JOINT_VISIBILITY,
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointId,
  type NormalizedMotionFrame,
} from "./types";

const REQUIRED_JOINTS = [
  "left_hip",
  "left_knee",
  "left_ankle",
] as const satisfies readonly JointId[];

function buildSyntheticFrame(
  frameIndex: number,
  options: {
    visibility?: number;
    present?: boolean;
    omitJoints?: readonly JointId[];
    schemaVersion?: string;
    invalidCoordinate?: boolean;
  } = {},
): NormalizedMotionFrame {
  const visibility = options.visibility ?? 0.8;
  const present = options.present ?? true;
  const joints: NormalizedMotionFrame["joints"] = {};

  for (const jointId of REQUIRED_JOINTS) {
    if (options.omitJoints?.includes(jointId)) {
      continue;
    }

    joints[jointId] = {
      landmark: {
        x: options.invalidCoordinate ? 1.2 : 0.4,
        y: options.invalidCoordinate ? -0.1 : 0.5 + frameIndex * 0.01,
      },
      confidence: { visibility, present },
    };
  }

  return {
    schemaVersion: (options.schemaVersion ??
      MOTION_INTELLIGENCE_SCHEMA_VERSION) as NormalizedMotionFrame["schemaVersion"],
    source: {
      kind: "web_camera_pose",
      capturedAtMs: 1_000 + frameIndex,
      frameIndex,
      coordinateSpace: "normalized_2d",
    },
    joints,
  };
}

function baseRequirement(
  overrides: Partial<MotionMetricRequirement> = {},
): MotionMetricRequirement {
  return {
    requiredJoints: REQUIRED_JOINTS,
    ...overrides,
  };
}

describe("validateRequiredJoints", () => {
  it("returns no reasons when all required joints are present", () => {
    const reasons = validateRequiredJoints(buildSyntheticFrame(0), REQUIRED_JOINTS);
    assert.deepEqual(reasons, []);
  });

  it("reports missing required joints", () => {
    const reasons = validateRequiredJoints(
      buildSyntheticFrame(0, { omitJoints: ["left_knee"] }),
      REQUIRED_JOINTS,
    );

    assert.equal(reasons.length, 1);
    assert.equal(reasons[0]?.code, "missing_required_joint");
    assert.equal(reasons[0]?.jointId, "left_knee");
    assert.equal(reasons[0]?.frameIndex, 0);
  });
});

describe("validateMinimumConfidence", () => {
  it("reports joints below the minimum confidence threshold", () => {
    const reasons = validateMinimumConfidence(
      buildSyntheticFrame(1, { visibility: 0.1 }),
      REQUIRED_JOINTS,
      DEFAULT_MIN_JOINT_VISIBILITY,
    );

    assert.ok(reasons.length > 0);
    assert.ok(reasons.every((reason) => reason.code === "confidence_below_minimum"));
    assert.equal(reasons[0]?.frameIndex, 1);
    assert.equal(reasons[0]?.observed, 0.1);
    assert.equal(reasons[0]?.required, DEFAULT_MIN_JOINT_VISIBILITY);
  });
});

describe("validateMotionMetricInput", () => {
  it("accepts a valid single-frame input with default minFrameCount of 1", () => {
    const result = validateMotionMetricInput([buildSyntheticFrame(0)], baseRequirement());

    assert.equal(result.valid, true);
    assert.equal(result.validFrameCount, 1);
    assert.equal(result.totalFrameCount, 1);
    assert.deepEqual(result.reasons, []);
  });

  it("rejects frames with missing required joints", () => {
    const result = validateMotionMetricInput(
      [buildSyntheticFrame(0, { omitJoints: ["left_ankle"] })],
      baseRequirement(),
    );

    assert.equal(result.valid, false);
    assert.equal(result.validFrameCount, 0);
    assert.ok(result.reasons.some((reason) => reason.code === "missing_required_joint"));
    assert.ok(result.reasons.some((reason) => reason.code === "insufficient_frame_count"));
  });

  it("rejects frames with low confidence", () => {
    const result = validateMotionMetricInput(
      [buildSyntheticFrame(0, { visibility: 0.1 })],
      baseRequirement(),
    );

    assert.equal(result.valid, false);
    assert.equal(result.validFrameCount, 0);
    assert.ok(result.reasons.some((reason) => reason.code === "confidence_below_minimum"));
    assert.ok(result.reasons.some((reason) => reason.code === "insufficient_frame_count"));
  });

  it("rejects invalid frame contracts", () => {
    const result = validateMotionMetricInput(
      [buildSyntheticFrame(0, { schemaVersion: "mi-v0" })],
      baseRequirement(),
    );

    assert.equal(result.valid, false);
    assert.equal(result.validFrameCount, 0);
    assert.ok(result.reasons.some((reason) => reason.code === "invalid_frame_contract"));
  });

  it("rejects an empty sequence", () => {
    const result = validateMotionMetricInput([], baseRequirement());

    assert.equal(result.valid, false);
    assert.equal(result.validFrameCount, 0);
    assert.equal(result.totalFrameCount, 0);
    assert.deepEqual(result.reasons, [
      {
        code: "empty_sequence",
        message: "No frames provided for metric validation",
      },
    ]);
  });

  it("rejects when valid-frame count is below the required minimum", () => {
    const result = validateMotionMetricInput(
      [buildSyntheticFrame(0), buildSyntheticFrame(1, { visibility: 0.1 })],
      baseRequirement({ minFrameCount: 2 }),
    );

    assert.equal(result.valid, false);
    assert.equal(result.validFrameCount, 1);
    assert.equal(result.totalFrameCount, 2);
    assert.ok(result.reasons.some((reason) => reason.code === "confidence_below_minimum"));
    assert.ok(result.reasons.some((reason) => reason.code === "insufficient_frame_count"));
  });
});

describe("validateMinimumFrameCount", () => {
  it("accepts mixed sequences when enough frames pass all validations", () => {
    const frames = [
      buildSyntheticFrame(0),
      buildSyntheticFrame(1, { omitJoints: ["left_knee"] }),
      buildSyntheticFrame(2),
      buildSyntheticFrame(3, { visibility: 0.1 }),
    ];

    const result = validateMinimumFrameCount(frames, baseRequirement({ minFrameCount: 2 }));

    assert.equal(result.valid, true);
    assert.equal(result.validFrameCount, 2);
    assert.equal(result.totalFrameCount, 4);
    assert.ok(result.reasons.some((reason) => reason.code === "missing_required_joint"));
    assert.ok(result.reasons.some((reason) => reason.code === "confidence_below_minimum"));
    assert.ok(
      result.reasons.every((reason) => reason.code !== "insufficient_frame_count"),
    );
  });
});
