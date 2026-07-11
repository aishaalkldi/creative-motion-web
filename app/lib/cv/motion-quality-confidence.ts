/**
 * RASQ Motion Intelligence Engine — per-frame motion data trust (technical v0).
 * Device-agnostic landmark confidence only; not clinical interpretation.
 */

import {
  PATIENT_POSE_ANKLE_INDICES,
  PATIENT_POSE_HIP_INDICES,
  PATIENT_POSE_KNEE_INDICES,
  PATIENT_POSE_SHOULDER_INDICES,
  type PoseLandmark,
} from "@/app/lib/cv/pose-landmark-overlay";

export type MotionQualityLevel = "high" | "medium" | "low";

export type MotionQualityReason =
  | "missing_required_landmarks"
  | "low_landmark_confidence"
  | "incomplete_frame";

export type JointGroupId = "shoulder" | "hip" | "knee" | "ankle";

export type JointGroupConfidence = {
  group: JointGroupId;
  avgConfidence: number;
  minConfidence: number;
  present: boolean;
};

export type LandmarkConfidenceAggregation = {
  groups: JointGroupConfidence[];
  overallConfidence: number;
};

export type RequiredLandmarkValidation = {
  valid: boolean;
  missingGroups: JointGroupId[];
};

export type FrameCompleteness = {
  score: number;
  expectedLandmarkCount: number;
  requiredSlotsPresent: number;
  requiredSlotsTotal: number;
  complete: boolean;
};

export type MotionFrameQualityResult = {
  level: MotionQualityLevel;
  confidence: LandmarkConfidenceAggregation;
  requiredLandmarks: RequiredLandmarkValidation;
  frameCompleteness: FrameCompleteness;
  reasons: MotionQualityReason[];
};

export type MotionFrameQualityInput = {
  landmarks: readonly PoseLandmark[];
  requiredGroups?: readonly JointGroupId[];
};

/** BlazePose landmark count — technical v0 default. */
export const BLAZEPOSE_LANDMARK_COUNT = 33;

/** Minimum visibility to count a landmark as present — technical v0 default. */
export const MIN_PRESENT_VISIBILITY = 0.2;

/** Aggregate confidence thresholds — technical v0 defaults, not clinical standards. */
export const HIGH_CONFIDENCE_THRESHOLD = 0.6;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.35;

/** Default groups required for trustworthy per-frame motion measurement. */
export const DEFAULT_REQUIRED_JOINT_GROUPS: readonly JointGroupId[] = ["hip", "knee"];

const JOINT_GROUP_INDICES: Record<JointGroupId, readonly number[]> = {
  shoulder: PATIENT_POSE_SHOULDER_INDICES,
  hip: PATIENT_POSE_HIP_INDICES,
  knee: PATIENT_POSE_KNEE_INDICES,
  ankle: PATIENT_POSE_ANKLE_INDICES,
};

const ALL_JOINT_GROUPS: readonly JointGroupId[] = ["shoulder", "hip", "knee", "ankle"];

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function visibilityAt(landmarks: readonly PoseLandmark[], index: number): number {
  return clampConfidence(landmarks[index]?.visibility);
}

function hasValidLandmarkSlot(landmarks: readonly PoseLandmark[], index: number): boolean {
  const lm = landmarks[index];
  if (!lm) return false;
  return Number.isFinite(lm.x) && Number.isFinite(lm.y);
}

function groupConfidence(
  landmarks: readonly PoseLandmark[],
  group: JointGroupId,
): JointGroupConfidence {
  const indices = JOINT_GROUP_INDICES[group];
  const values = indices.map((index) => visibilityAt(landmarks, index));
  const presentValues = values.filter((value) => value >= MIN_PRESENT_VISIBILITY);
  const present = presentValues.length === indices.length;

  return {
    group,
    avgConfidence:
      presentValues.length > 0
        ? presentValues.reduce((sum, value) => sum + value, 0) / presentValues.length
        : 0,
    minConfidence: values.length > 0 ? Math.min(...values) : 0,
    present,
  };
}

/**
 * Aggregate per-joint-group visibility into an overall confidence score.
 */
export function aggregateLandmarkConfidence(
  landmarks: readonly PoseLandmark[],
): LandmarkConfidenceAggregation {
  const groups = ALL_JOINT_GROUPS.map((group) => groupConfidence(landmarks, group));
  const presentGroups = groups.filter((group) => group.present);

  const overallConfidence =
    presentGroups.length > 0
      ? presentGroups.reduce((sum, group) => sum + group.avgConfidence, 0) /
        presentGroups.length
      : 0;

  return { groups, overallConfidence };
}

/**
 * Validate that required joint groups have all landmarks present above MIN_PRESENT_VISIBILITY.
 */
export function validateRequiredLandmarks(
  landmarks: readonly PoseLandmark[],
  requiredGroups: readonly JointGroupId[] = DEFAULT_REQUIRED_JOINT_GROUPS,
): RequiredLandmarkValidation {
  const missingGroups: JointGroupId[] = [];

  for (const group of requiredGroups) {
    const stats = groupConfidence(landmarks, group);
    if (!stats.present) {
      missingGroups.push(group);
    }
  }

  return {
    valid: missingGroups.length === 0,
    missingGroups,
  };
}

/**
 * Measure whether the frame structurally includes required landmark slots (finite x/y).
 */
export function computeFrameCompleteness(
  landmarks: readonly PoseLandmark[],
  requiredGroups: readonly JointGroupId[] = DEFAULT_REQUIRED_JOINT_GROUPS,
): FrameCompleteness {
  const requiredIndices = new Set<number>();
  for (const group of requiredGroups) {
    for (const index of JOINT_GROUP_INDICES[group]) {
      requiredIndices.add(index);
    }
  }

  const indices = [...requiredIndices];
  const requiredSlotsTotal = indices.length;
  const requiredSlotsPresent = indices.filter((index) =>
    hasValidLandmarkSlot(landmarks, index),
  ).length;

  const structuralScore =
    requiredSlotsTotal > 0 ? requiredSlotsPresent / requiredSlotsTotal : 0;
  const lengthScore =
    landmarks.length >= BLAZEPOSE_LANDMARK_COUNT
      ? 1
      : landmarks.length / BLAZEPOSE_LANDMARK_COUNT;
  const score = Math.max(0, Math.min(1, structuralScore * lengthScore));

  return {
    score,
    expectedLandmarkCount: BLAZEPOSE_LANDMARK_COUNT,
    requiredSlotsPresent,
    requiredSlotsTotal,
    complete: structuralScore === 1 && landmarks.length >= BLAZEPOSE_LANDMARK_COUNT,
  };
}

export type MotionQualityClassificationInput = {
  confidence: LandmarkConfidenceAggregation;
  requiredLandmarks: RequiredLandmarkValidation;
  frameCompleteness: FrameCompleteness;
};

/**
 * Classify per-frame motion quality from aggregated technical signals.
 */
export function classifyMotionQuality(
  input: MotionQualityClassificationInput,
): { level: MotionQualityLevel; reasons: MotionQualityReason[] } {
  const reasons: MotionQualityReason[] = [];

  if (!input.frameCompleteness.complete) {
    reasons.push("incomplete_frame");
  }
  if (!input.requiredLandmarks.valid) {
    reasons.push("missing_required_landmarks");
  }
  if (input.confidence.overallConfidence < MEDIUM_CONFIDENCE_THRESHOLD) {
    reasons.push("low_landmark_confidence");
  }

  if (
    !input.frameCompleteness.complete ||
    !input.requiredLandmarks.valid ||
    input.confidence.overallConfidence < MEDIUM_CONFIDENCE_THRESHOLD
  ) {
    return { level: "low", reasons };
  }

  if (input.confidence.overallConfidence < HIGH_CONFIDENCE_THRESHOLD) {
    return { level: "medium", reasons };
  }

  return { level: "high", reasons: [] };
}

/**
 * Assess whether a single pose frame is trustworthy enough for downstream measurement.
 */
export function assessMotionFrameQuality(
  input: MotionFrameQualityInput,
): MotionFrameQualityResult {
  const requiredGroups = input.requiredGroups ?? DEFAULT_REQUIRED_JOINT_GROUPS;
  const confidence = aggregateLandmarkConfidence(input.landmarks);
  const requiredLandmarks = validateRequiredLandmarks(input.landmarks, requiredGroups);
  const frameCompleteness = computeFrameCompleteness(input.landmarks, requiredGroups);
  const { level, reasons } = classifyMotionQuality({
    confidence,
    requiredLandmarks,
    frameCompleteness,
  });

  return {
    level,
    confidence,
    requiredLandmarks,
    frameCompleteness,
    reasons,
  };
}
