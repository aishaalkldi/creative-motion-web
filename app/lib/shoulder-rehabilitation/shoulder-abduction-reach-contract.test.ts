/**
 * Run: npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-contract.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
  SHOULDER_ABDUCTION_REACH_BONUS_JOINTS,
  SHOULDER_ABDUCTION_REACH_CORE_JOINTS,
  SHOULDER_ABDUCTION_REACH_SIDES,
} from "./shoulder-abduction-reach-contract";

describe("shoulder abduction reach joint groupings", () => {
  it("lists exactly left and right sides", () => {
    assert.deepEqual([...SHOULDER_ABDUCTION_REACH_SIDES], ["left", "right"]);
  });

  it("maps each side to its own ipsilateral core joints", () => {
    assert.deepEqual(SHOULDER_ABDUCTION_REACH_CORE_JOINTS.left, {
      hip: "left_hip",
      shoulder: "left_shoulder",
      elbow: "left_elbow",
    });
    assert.deepEqual(SHOULDER_ABDUCTION_REACH_CORE_JOINTS.right, {
      hip: "right_hip",
      shoulder: "right_shoulder",
      elbow: "right_elbow",
    });
  });

  it("maps each side to its own ipsilateral bonus wrist joint", () => {
    assert.deepEqual(SHOULDER_ABDUCTION_REACH_BONUS_JOINTS.left, { wrist: "left_wrist" });
    assert.deepEqual(SHOULDER_ABDUCTION_REACH_BONUS_JOINTS.right, { wrist: "right_wrist" });
  });
});

describe("default thresholds", () => {
  it("uses a peak angle strictly above the resting angle", () => {
    assert.ok(
      DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.peakMinAngleDegrees >
        DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.restingMaxAngleDegrees,
    );
  });

  it("keeps angles within the valid [0, 180] geometric range", () => {
    assert.ok(DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.restingMaxAngleDegrees >= 0);
    assert.ok(DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.peakMinAngleDegrees <= 180);
  });

  it("uses a positive hysteresis band", () => {
    assert.ok(DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.peakLowerHysteresisDegrees > 0);
  });
});
