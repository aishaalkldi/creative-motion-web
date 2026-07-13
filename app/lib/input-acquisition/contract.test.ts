/**
 * Run: npx tsx --test app/lib/input-acquisition/contract.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMotionAcquisitionSourceKind,
  isPhysiologicalAcquisitionSourceKind,
  MOTION_ACQUISITION_SOURCE_KINDS,
  PHYSIOLOGICAL_ACQUISITION_SOURCE_KINDS,
} from "./contract";

describe("input acquisition source kind families", () => {
  it("keeps motion and physiological source kinds disjoint", () => {
    const overlap = MOTION_ACQUISITION_SOURCE_KINDS.filter((kind) =>
      (PHYSIOLOGICAL_ACQUISITION_SOURCE_KINDS as readonly string[]).includes(kind),
    );
    assert.deepEqual(overlap, []);
  });

  it("recognizes web_camera_pose as a motion source kind", () => {
    assert.equal(isMotionAcquisitionSourceKind("web_camera_pose"), true);
  });

  it("recognizes reserved motion source kinds without an adapter", () => {
    assert.equal(isMotionAcquisitionSourceKind("imu_sensor"), true);
    assert.equal(isMotionAcquisitionSourceKind("reference_sensor"), true);
    assert.equal(isMotionAcquisitionSourceKind("xr_input"), true);
  });

  it("does not classify physiological or unknown kinds as motion", () => {
    assert.equal(isMotionAcquisitionSourceKind("rasq_watch"), false);
    assert.equal(isMotionAcquisitionSourceKind("speech_ai"), false);
    assert.equal(isMotionAcquisitionSourceKind("force_plate"), false);
    assert.equal(isMotionAcquisitionSourceKind(123), false);
  });

  it("recognizes reserved physiological source kinds", () => {
    assert.equal(isPhysiologicalAcquisitionSourceKind("rasq_watch"), true);
    assert.equal(isPhysiologicalAcquisitionSourceKind("emg_sensor"), true);
    assert.equal(isPhysiologicalAcquisitionSourceKind("eeg_sensor"), true);
  });

  it("does not classify motion or unknown kinds as physiological", () => {
    assert.equal(isPhysiologicalAcquisitionSourceKind("web_camera_pose"), false);
    assert.equal(isPhysiologicalAcquisitionSourceKind("force_plate"), false);
  });
});
