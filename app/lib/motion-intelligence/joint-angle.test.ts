/**
 * Run: npx tsx --test app/lib/motion-intelligence/joint-angle.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeJointAngleDegrees } from "./joint-angle";
import type { JointConfidence, JointLandmark } from "./types";

function point(x: number, y: number): JointLandmark {
  return { x, y };
}

function confident(): JointConfidence {
  return { visibility: 0.9, present: true };
}

function lowConfidence(): JointConfidence {
  return { visibility: 0.1, present: true };
}

describe("computeJointAngleDegrees", () => {
  it("returns ~90 degrees for a right angle", () => {
    const angle = computeJointAngleDegrees(
      point(0, 0),
      point(0, 0.5),
      point(0.5, 0.5),
      { confidences: [confident(), confident(), confident()] },
    );
    assert.ok(angle !== null);
    assert.ok(Math.abs(angle - 90) < 0.001);
  });

  it("returns ~180 degrees for collinear points", () => {
    const angle = computeJointAngleDegrees(
      point(0.2, 0.5),
      point(0.5, 0.5),
      point(0.8, 0.5),
    );
    assert.ok(angle !== null);
    assert.ok(Math.abs(angle - 180) < 0.001);
  });

  it("returns null when confidence is below threshold", () => {
    const angle = computeJointAngleDegrees(
      point(0, 0),
      point(0, 0.5),
      point(0.5, 0.5),
      {
        minConfidence: 0.5,
        confidences: [confident(), lowConfidence(), confident()],
      },
    );
    assert.equal(angle, null);
  });

  it("returns null for degenerate zero-length segments", () => {
    const angle = computeJointAngleDegrees(
      point(0.5, 0.5),
      point(0.5, 0.5),
      point(0.8, 0.5),
    );
    assert.equal(angle, null);
  });

  it("ignores z when computing 2D angle", () => {
    const angle = computeJointAngleDegrees(
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0.5, z: 2 },
      { x: 0.5, y: 0.5, z: 3 },
    );
    assert.ok(angle !== null);
    assert.ok(Math.abs(angle - 90) < 0.001);
  });
});
