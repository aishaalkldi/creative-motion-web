/**
 * Run: npx tsx --test app/lib/input-acquisition/adapters/motion/blazepose-acquisition-adapter.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { JOINT_IDS, validateNormalizedMotionFrame } from "@/app/lib/motion-intelligence";
import {
  BLAZEPOSE_ACQUISITION_ADAPTER,
  normalizeBlazePoseLandmarks,
} from "./blazepose-acquisition-adapter";

/** Full 33-point BlazePose array with every landmark present at moderate visibility. */
function fullSyntheticLandmarks(): PoseLandmark[] {
  return JOINT_IDS.map((_, index) => ({
    x: (index % 10) / 10,
    y: ((index + 1) % 10) / 10,
    visibility: 0.9,
  }));
}

const context = { frameIndex: 3, capturedAtMs: 1_500 };

describe("normalizeBlazePoseLandmarks", () => {
  it("produces a frame that passes Motion Intelligence Core frame validation", () => {
    const frame = normalizeBlazePoseLandmarks(fullSyntheticLandmarks(), context);
    const result = validateNormalizedMotionFrame(frame);
    assert.equal(result.valid, true);
  });

  it("maps BlazePose index i to JOINT_IDS[i]", () => {
    const frame = normalizeBlazePoseLandmarks(fullSyntheticLandmarks(), context);
    assert.equal(frame.joints.left_hip?.landmark.x, 3 / 10);
    assert.equal(frame.joints.right_ankle?.landmark.x, 8 / 10);
  });

  it("passes frameIndex and capturedAtMs through unchanged", () => {
    const frame = normalizeBlazePoseLandmarks(fullSyntheticLandmarks(), context);
    assert.equal(frame.source.frameIndex, 3);
    assert.equal(frame.source.capturedAtMs, 1_500);
    assert.equal(frame.source.kind, "web_camera_pose");
    assert.equal(frame.source.coordinateSpace, "normalized_2d");
  });

  it("omits z even when BlazePose supplies it (uncalibrated depth, v0)", () => {
    const landmarks = fullSyntheticLandmarks().map((landmark) => ({ ...landmark, z: 0.42 }));
    const frame = normalizeBlazePoseLandmarks(landmarks, context);
    assert.equal(frame.joints.left_hip?.landmark.z, undefined);
  });

  it("marks a landmark below the present-visibility threshold as not present", () => {
    const landmarks = fullSyntheticLandmarks();
    const leftHipIndex = JOINT_IDS.indexOf("left_hip");
    landmarks[leftHipIndex] = { ...landmarks[leftHipIndex], visibility: 0.05 };

    const frame = normalizeBlazePoseLandmarks(landmarks, context);
    assert.equal(frame.joints.left_hip?.confidence.present, false);
    assert.equal(frame.joints.left_hip?.confidence.visibility, 0.05);
  });

  it("omits a landmark with non-finite coordinates rather than including invalid data", () => {
    const landmarks = fullSyntheticLandmarks();
    const noseIndex = JOINT_IDS.indexOf("nose");
    landmarks[noseIndex] = { x: Number.NaN, y: 0.5, visibility: 0.9 };

    const frame = normalizeBlazePoseLandmarks(landmarks, context);
    assert.equal(frame.joints.nose, undefined);
  });

  it("omits a landmark with finite but out-of-[0,1]-range coordinates (partially off-screen limb)", () => {
    const landmarks = fullSyntheticLandmarks();
    const leftWristIndex = JOINT_IDS.indexOf("left_wrist");
    landmarks[leftWristIndex] = { x: -0.03, y: 0.5, visibility: 0.9 };
    const rightWristIndex = JOINT_IDS.indexOf("right_wrist");
    landmarks[rightWristIndex] = { x: 0.5, y: 1.08, visibility: 0.9 };

    const frame = normalizeBlazePoseLandmarks(landmarks, context);
    assert.equal(frame.joints.left_wrist, undefined);
    assert.equal(frame.joints.right_wrist, undefined);
    assert.equal(
      validateNormalizedMotionFrame(frame).valid,
      true,
      "a frame with off-screen landmarks omitted must still pass core frame validation",
    );
  });

  it("omits a missing (undefined) landmark slot entirely", () => {
    const landmarks = fullSyntheticLandmarks().slice(0, 20);
    const frame = normalizeBlazePoseLandmarks(landmarks, context);
    assert.equal(frame.joints.left_heel, undefined);
    assert.ok(frame.joints.left_shoulder);
  });

  it("clamps out-of-range visibility into [0, 1]", () => {
    const landmarks = fullSyntheticLandmarks();
    const leftKneeIndex = JOINT_IDS.indexOf("left_knee");
    landmarks[leftKneeIndex] = { ...landmarks[leftKneeIndex], visibility: 1.7 };

    const frame = normalizeBlazePoseLandmarks(landmarks, context);
    assert.equal(frame.joints.left_knee?.confidence.visibility, 1);
  });
});

describe("BLAZEPOSE_ACQUISITION_ADAPTER", () => {
  it("declares the motion family and web_camera_pose source kind", () => {
    assert.equal(BLAZEPOSE_ACQUISITION_ADAPTER.family, "motion");
    assert.equal(BLAZEPOSE_ACQUISITION_ADAPTER.sourceKind, "web_camera_pose");
  });

  it("normalizes a real landmark array through the adapter interface", () => {
    const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(fullSyntheticLandmarks(), context);
    assert.ok(frame);
    assert.equal(validateNormalizedMotionFrame(frame).valid, true);
  });

  it("returns null for an empty landmark array", () => {
    assert.equal(BLAZEPOSE_ACQUISITION_ADAPTER.normalize([], context), null);
  });

  it("returns null when no landmark has finite coordinates", () => {
    const allInvalid = fullSyntheticLandmarks().map(() => ({
      x: Number.NaN,
      y: Number.NaN,
      visibility: 0.9,
    }));
    assert.equal(BLAZEPOSE_ACQUISITION_ADAPTER.normalize(allInvalid, context), null);
  });

  it("returns null for non-array input", () => {
    assert.equal(
      BLAZEPOSE_ACQUISITION_ADAPTER.normalize(null as unknown as PoseLandmark[], context),
      null,
    );
  });
});
