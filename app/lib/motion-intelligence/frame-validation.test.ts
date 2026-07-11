/**
 * Run: npx tsx --test app/lib/motion-intelligence/frame-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJointConfident, validateNormalizedMotionFrame } from "./frame-validation";
import {
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type NormalizedMotionFrame,
} from "./types";

function validFrame(): NormalizedMotionFrame {
  return {
    schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
    source: {
      kind: "web_camera_pose",
      capturedAtMs: 1_000,
      frameIndex: 0,
      coordinateSpace: "normalized_2d",
    },
    joints: {
      left_hip: {
        landmark: { x: 0.4, y: 0.5 },
        confidence: { visibility: 0.8, present: true },
      },
      left_knee: {
        landmark: { x: 0.4, y: 0.7 },
        confidence: { visibility: 0.75, present: true },
      },
    },
  };
}

describe("validateNormalizedMotionFrame", () => {
  it("accepts a valid frame", () => {
    const result = validateNormalizedMotionFrame(validFrame());
    assert.equal(result.valid, true);
  });

  it("rejects invalid schema version", () => {
    const frame = { ...validFrame(), schemaVersion: "mic-0" };
    const result = validateNormalizedMotionFrame(frame);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.errors.join(" "), /mi-v1/);
    }
  });

  it("rejects unknown joint ids", () => {
    const frame = {
      ...validFrame(),
      joints: {
        left_knee_cap: {
          landmark: { x: 0.4, y: 0.7 },
          confidence: { visibility: 0.75, present: true },
        },
      },
    };
    const result = validateNormalizedMotionFrame(frame);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.errors.join(" "), /Unknown joint id/);
    }
  });

  it("rejects frames with no joints", () => {
    const frame = { ...validFrame(), joints: {} };
    const result = validateNormalizedMotionFrame(frame);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.errors.join(" "), /at least one joint/);
    }
  });

  it("rejects out-of-range coordinates and visibility", () => {
    const frame: NormalizedMotionFrame = {
      ...validFrame(),
      joints: {
        left_ankle: {
          landmark: { x: 1.2, y: -0.1 },
          confidence: { visibility: 1.5, present: true },
        },
      },
    };
    const result = validateNormalizedMotionFrame(frame);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.ok(result.errors.some((error) => error.includes("landmark.x")));
      assert.ok(result.errors.some((error) => error.includes("landmark.y")));
      assert.ok(result.errors.some((error) => error.includes("visibility")));
    }
  });
});

describe("isJointConfident", () => {
  it("returns true when present and visibility meets threshold", () => {
    assert.equal(
      isJointConfident({ visibility: 0.6, present: true }, 0.5),
      true,
    );
  });

  it("returns false when not present or below threshold", () => {
    assert.equal(
      isJointConfident({ visibility: 0.4, present: true }, 0.5),
      false,
    );
    assert.equal(
      isJointConfident({ visibility: 0.9, present: false }, 0.5),
      false,
    );
  });
});
