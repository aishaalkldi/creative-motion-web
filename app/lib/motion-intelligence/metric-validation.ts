/**
 * RASQ Motion Intelligence Engine — metric precondition validation (technical v0).
 * Pure validation only. No metric calculations or clinical interpretation.
 */

import {
  isJointConfident,
  validateNormalizedMotionFrame,
} from "./frame-validation";
import {
  DEFAULT_MIN_JOINT_VISIBILITY,
  type JointId,
  type NormalizedMotionFrame,
} from "./types";

export type MotionMetricValidationReasonCode =
  | "empty_sequence"
  | "invalid_frame_contract"
  | "missing_required_joint"
  | "confidence_below_minimum"
  | "insufficient_frame_count";

export type MotionMetricValidationReason = {
  code: MotionMetricValidationReasonCode;
  message: string;
  jointId?: JointId;
  frameIndex?: number;
  observed?: number;
  required?: number;
};

export type MotionMetricRequirement = {
  requiredJoints: readonly JointId[];
  minJointConfidence?: number;
  minFrameCount?: number;
};

export type MotionMetricValidationResult = {
  valid: boolean;
  reasons: MotionMetricValidationReason[];
  validFrameCount: number;
  totalFrameCount: number;
};

const DEFAULT_MIN_FRAME_COUNT = 1;

function frameIndexOf(frame: NormalizedMotionFrame): number {
  return frame.source.frameIndex;
}

function resolvedMinConfidence(requirement: MotionMetricRequirement): number {
  return requirement.minJointConfidence ?? DEFAULT_MIN_JOINT_VISIBILITY;
}

function resolvedMinFrameCount(requirement: MotionMetricRequirement): number {
  return requirement.minFrameCount ?? DEFAULT_MIN_FRAME_COUNT;
}

/**
 * Validate that required joints exist and are marked present on a single frame.
 */
export function validateRequiredJoints(
  frame: NormalizedMotionFrame,
  requiredJoints: readonly JointId[],
): MotionMetricValidationReason[] {
  const reasons: MotionMetricValidationReason[] = [];
  const frameIndex = frameIndexOf(frame);

  for (const jointId of requiredJoints) {
    const joint = frame.joints[jointId];
    if (!joint || !joint.confidence.present) {
      reasons.push({
        code: "missing_required_joint",
        message: `Required joint ${jointId} is missing or not present`,
        jointId,
        frameIndex,
      });
    }
  }

  return reasons;
}

/**
 * Validate that required joints meet the minimum confidence threshold on a single frame.
 */
export function validateMinimumConfidence(
  frame: NormalizedMotionFrame,
  requiredJoints: readonly JointId[],
  minConfidence: number = DEFAULT_MIN_JOINT_VISIBILITY,
): MotionMetricValidationReason[] {
  const reasons: MotionMetricValidationReason[] = [];
  const frameIndex = frameIndexOf(frame);

  for (const jointId of requiredJoints) {
    const joint = frame.joints[jointId];
    if (!joint) {
      continue;
    }

    if (!isJointConfident(joint.confidence, minConfidence)) {
      reasons.push({
        code: "confidence_below_minimum",
        message: `Joint ${jointId} visibility ${joint.confidence.visibility} below minimum ${minConfidence}`,
        jointId,
        frameIndex,
        observed: joint.confidence.visibility,
        required: minConfidence,
      });
    }
  }

  return reasons;
}

function validateFrameContract(
  frame: NormalizedMotionFrame,
): MotionMetricValidationReason[] {
  const contractResult = validateNormalizedMotionFrame(frame);
  if (contractResult.valid) {
    return [];
  }

  return [
    {
      code: "invalid_frame_contract",
      message: `Frame at index ${frameIndexOf(frame)} failed motion frame contract validation`,
      frameIndex: frameIndexOf(frame),
    },
  ];
}

function isFrameValidForMetric(
  frame: NormalizedMotionFrame,
  requirement: MotionMetricRequirement,
): { valid: boolean; reasons: MotionMetricValidationReason[] } {
  const minConfidence = resolvedMinConfidence(requirement);
  const contractReasons = validateFrameContract(frame);
  if (contractReasons.length > 0) {
    return { valid: false, reasons: contractReasons };
  }

  const requiredJointReasons = validateRequiredJoints(frame, requirement.requiredJoints);
  if (requiredJointReasons.length > 0) {
    return { valid: false, reasons: requiredJointReasons };
  }

  const confidenceReasons = validateMinimumConfidence(
    frame,
    requirement.requiredJoints,
    minConfidence,
  );
  if (confidenceReasons.length > 0) {
    return { valid: false, reasons: confidenceReasons };
  }

  return { valid: true, reasons: [] };
}

/**
 * Count frames that pass contract, required-joint, and confidence validation.
 */
export function validateMinimumFrameCount(
  frames: readonly NormalizedMotionFrame[],
  requirement: MotionMetricRequirement,
): {
  valid: boolean;
  validFrameCount: number;
  totalFrameCount: number;
  reasons: MotionMetricValidationReason[];
} {
  const minFrameCount = resolvedMinFrameCount(requirement);
  const reasons: MotionMetricValidationReason[] = [];
  let validFrameCount = 0;

  for (const frame of frames) {
    const frameResult = isFrameValidForMetric(frame, requirement);
    if (frameResult.valid) {
      validFrameCount += 1;
    } else {
      reasons.push(...frameResult.reasons);
    }
  }

  if (validFrameCount < minFrameCount) {
    reasons.push({
      code: "insufficient_frame_count",
      message: `Valid frames ${validFrameCount} below required minimum ${minFrameCount}`,
      observed: validFrameCount,
      required: minFrameCount,
    });
  }

  return {
    valid: validFrameCount >= minFrameCount,
    validFrameCount,
    totalFrameCount: frames.length,
    reasons,
  };
}

/**
 * Validate whether motion frames satisfy metric preconditions.
 * Each frame is evaluated independently; invalid frames produce reasons
 * without automatically invalidating the full sequence.
 */
export function validateMotionMetricInput(
  frames: readonly NormalizedMotionFrame[],
  requirement: MotionMetricRequirement,
): MotionMetricValidationResult {
  if (frames.length === 0) {
    return {
      valid: false,
      reasons: [
        {
          code: "empty_sequence",
          message: "No frames provided for metric validation",
        },
      ],
      validFrameCount: 0,
      totalFrameCount: 0,
    };
  }

  const frameCountResult = validateMinimumFrameCount(frames, requirement);

  return {
    valid: frameCountResult.valid,
    reasons: frameCountResult.reasons,
    validFrameCount: frameCountResult.validFrameCount,
    totalFrameCount: frameCountResult.totalFrameCount,
  };
}
