/**
 * Run: npx tsx --test app/lib/input-acquisition/registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BLAZEPOSE_ACQUISITION_ADAPTER } from "./adapters/motion/blazepose-acquisition-adapter";
import {
  getMotionAcquisitionAdapter,
  getMotionAcquisitionAdapterOrNull,
  isRegisteredMotionAcquisitionSourceKind,
  listMotionAcquisitionAdapters,
} from "./registry";

describe("motion acquisition registry", () => {
  it("resolves the BlazePose adapter for web_camera_pose", () => {
    assert.equal(getMotionAcquisitionAdapter("web_camera_pose"), BLAZEPOSE_ACQUISITION_ADAPTER);
  });

  it("reports web_camera_pose as registered", () => {
    assert.equal(isRegisteredMotionAcquisitionSourceKind("web_camera_pose"), true);
  });

  it("reports reserved-but-unimplemented source kinds as not registered", () => {
    assert.equal(isRegisteredMotionAcquisitionSourceKind("imu_sensor"), false);
    assert.equal(isRegisteredMotionAcquisitionSourceKind("reference_sensor"), false);
    assert.equal(isRegisteredMotionAcquisitionSourceKind("xr_input"), false);
    assert.equal(isRegisteredMotionAcquisitionSourceKind("depth_camera"), false);
    assert.equal(isRegisteredMotionAcquisitionSourceKind("phone_camera"), false);
  });

  it("returns null (not throw) for an unregistered kind via the OrNull lookup", () => {
    assert.equal(getMotionAcquisitionAdapterOrNull("imu_sensor"), null);
  });

  it("returns null for an unknown string that is not a source kind at all", () => {
    assert.equal(getMotionAcquisitionAdapterOrNull("not_a_real_source"), null);
  });

  it("throws a descriptive error for an unregistered kind via the strict lookup", () => {
    assert.throws(
      () => getMotionAcquisitionAdapter("imu_sensor"),
      /No motion acquisition adapter registered for source kind "imu_sensor"/,
    );
  });

  it("lists exactly the registered adapters", () => {
    const adapters = listMotionAcquisitionAdapters();
    assert.equal(adapters.length, 1);
    assert.equal(adapters[0], BLAZEPOSE_ACQUISITION_ADAPTER);
  });
});
