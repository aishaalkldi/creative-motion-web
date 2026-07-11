/**
 * Run: npx tsx --test app/lib/cv/motion-quality-confidence.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateLandmarkConfidence,
  assessMotionFrameQuality,
  BLAZEPOSE_LANDMARK_COUNT,
  classifyMotionQuality,
  computeFrameCompleteness,
  DEFAULT_REQUIRED_JOINT_GROUPS,
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  MIN_PRESENT_VISIBILITY,
  validateRequiredLandmarks,
  type JointGroupId,
} from "./motion-quality-confidence";
import {
  PATIENT_POSE_ANKLE_INDICES,
  PATIENT_POSE_HIP_INDICES,
  PATIENT_POSE_KNEE_INDICES,
  PATIENT_POSE_SHOULDER_INDICES,
  type PoseLandmark,
} from "./pose-landmark-overlay";

function buildSyntheticLandmarks(
  visibility: number,
  options: {
    groups?: Partial<Record<JointGroupId, number>>;
    omitIndices?: readonly number[];
    length?: number;
    invalidVisibilities?: ReadonlyArray<{ index: number; visibility: number | undefined }>;
  } = {},
): PoseLandmark[] {
  const length = options.length ?? BLAZEPOSE_LANDMARK_COUNT;
  const landmarks: PoseLandmark[] = Array.from({ length }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));

  const groupVisibility: Record<JointGroupId, number> = {
    shoulder: visibility,
    hip: visibility,
    knee: visibility,
    ankle: visibility,
    ...options.groups,
  };

  const indicesByGroup: Record<JointGroupId, readonly number[]> = {
    shoulder: PATIENT_POSE_SHOULDER_INDICES,
    hip: PATIENT_POSE_HIP_INDICES,
    knee: PATIENT_POSE_KNEE_INDICES,
    ankle: PATIENT_POSE_ANKLE_INDICES,
  };

  for (const group of Object.keys(indicesByGroup) as JointGroupId[]) {
    for (const index of indicesByGroup[group]) {
      landmarks[index] = { x: 0.5, y: 0.5, visibility: groupVisibility[group] };
    }
  }

  for (const index of options.omitIndices ?? []) {
    landmarks[index] = { x: Number.NaN, y: Number.NaN, visibility: 0 };
  }

  for (const override of options.invalidVisibilities ?? []) {
    const current = landmarks[override.index] ?? { x: 0.5, y: 0.5 };
    landmarks[override.index] = {
      ...current,
      visibility: override.visibility,
    };
  }

  return landmarks;
}

describe("aggregateLandmarkConfidence", () => {
  it("clamps invalid confidence values to the 0–1 range", () => {
    const landmarks = buildSyntheticLandmarks(0.85);
    landmarks[PATIENT_POSE_HIP_INDICES[0]!] = {
      x: 0.5,
      y: 0.5,
      visibility: -0.4,
    };
    landmarks[PATIENT_POSE_HIP_INDICES[1]!] = {
      x: 0.5,
      y: 0.5,
      visibility: 1.8,
    };
    landmarks[PATIENT_POSE_KNEE_INDICES[0]!] = {
      x: 0.5,
      y: 0.5,
      visibility: Number.NaN,
    };
    landmarks[PATIENT_POSE_KNEE_INDICES[1]!] = {
      x: 0.5,
      y: 0.5,
      visibility: undefined,
    };

    const result = aggregateLandmarkConfidence(landmarks);
    const hip = result.groups.find((group) => group.group === "hip");
    const knee = result.groups.find((group) => group.group === "knee");

    assert.equal(hip?.minConfidence, 0);
    assert.equal(knee?.minConfidence, 0);
    assert.ok(result.overallConfidence >= 0 && result.overallConfidence <= 1);
  });
});

describe("assessMotionFrameQuality", () => {
  it("returns high quality for a complete frame with strong landmark confidence", () => {
    const result = assessMotionFrameQuality({
      landmarks: buildSyntheticLandmarks(0.85),
    });

    assert.equal(result.level, "high");
    assert.equal(result.frameCompleteness.complete, true);
    assert.equal(result.requiredLandmarks.valid, true);
    assert.ok(result.confidence.overallConfidence >= HIGH_CONFIDENCE_THRESHOLD);
    assert.deepEqual(result.reasons, []);
  });

  it("returns medium quality when confidence is above medium but below high", () => {
    const result = assessMotionFrameQuality({
      landmarks: buildSyntheticLandmarks(0.45),
    });

    assert.equal(result.level, "medium");
    assert.ok(
      result.confidence.overallConfidence >= MEDIUM_CONFIDENCE_THRESHOLD &&
        result.confidence.overallConfidence < HIGH_CONFIDENCE_THRESHOLD,
    );
    assert.deepEqual(result.reasons, []);
  });

  it("returns low quality when required landmarks are missing", () => {
    const landmarks = buildSyntheticLandmarks(0.85, {
      groups: { hip: 0.05, knee: 0.05 },
    });

    const result = assessMotionFrameQuality({ landmarks });

    assert.equal(result.level, "low");
    assert.equal(result.requiredLandmarks.valid, false);
    assert.ok(result.requiredLandmarks.missingGroups.includes("hip"));
    assert.ok(result.requiredLandmarks.missingGroups.includes("knee"));
    assert.ok(result.reasons.includes("missing_required_landmarks"));
  });

  it("returns low quality when average confidence is below the medium threshold", () => {
    const result = assessMotionFrameQuality({
      landmarks: buildSyntheticLandmarks(0.1),
    });

    assert.equal(result.level, "low");
    assert.ok(result.confidence.overallConfidence < MEDIUM_CONFIDENCE_THRESHOLD);
    assert.ok(result.reasons.includes("low_landmark_confidence"));
  });

  it("returns low quality for an incomplete frame", () => {
    const landmarks = buildSyntheticLandmarks(0.85, {
      length: 20,
      omitIndices: [PATIENT_POSE_HIP_INDICES[0]!, PATIENT_POSE_KNEE_INDICES[1]!],
    });

    const result = assessMotionFrameQuality({ landmarks });

    assert.equal(result.level, "low");
    assert.equal(result.frameCompleteness.complete, false);
    assert.ok(result.reasons.includes("incomplete_frame"));
  });
});

describe("computeFrameCompleteness", () => {
  it("marks a structurally full BlazePose frame as complete", () => {
    const completeness = computeFrameCompleteness(
      buildSyntheticLandmarks(0.85),
      DEFAULT_REQUIRED_JOINT_GROUPS,
    );

    assert.equal(completeness.complete, true);
    assert.equal(completeness.score, 1);
    assert.equal(completeness.requiredSlotsPresent, completeness.requiredSlotsTotal);
  });
});

describe("validateRequiredLandmarks", () => {
  it("requires both sides of each default required group to exceed MIN_PRESENT_VISIBILITY", () => {
    const landmarks = buildSyntheticLandmarks(MIN_PRESENT_VISIBILITY + 0.01);
    const oneSided = buildSyntheticLandmarks(0.85);
    oneSided[PATIENT_POSE_KNEE_INDICES[1]!] = {
      x: 0.5,
      y: 0.5,
      visibility: 0.05,
    };

    assert.equal(validateRequiredLandmarks(landmarks).valid, true);
    assert.equal(validateRequiredLandmarks(oneSided).valid, false);
  });
});

describe("classifyMotionQuality", () => {
  it("prioritizes structural and required-joint failures as low quality", () => {
    const confidence = aggregateLandmarkConfidence(buildSyntheticLandmarks(0.85));
    const requiredLandmarks = {
      valid: false,
      missingGroups: ["knee"] as JointGroupId[],
    };
    const frameCompleteness = computeFrameCompleteness(buildSyntheticLandmarks(0.85));

    const result = classifyMotionQuality({
      confidence,
      requiredLandmarks,
      frameCompleteness,
    });

    assert.equal(result.level, "low");
    assert.ok(result.reasons.includes("missing_required_landmarks"));
  });
});
