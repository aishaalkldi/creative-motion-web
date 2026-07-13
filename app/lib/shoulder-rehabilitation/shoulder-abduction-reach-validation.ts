/**
 * Shoulder Abduction Reach — session-level validation (v0).
 *
 * Wraps Motion Intelligence Core's `validateMotionMetricInput`
 * (`metric-validation.ts`, not re-exported from the barrel) with this
 * exercise's required-joint set. This is sequence-level gating — "is there
 * enough confidently-tracked data across these frames to trust a rep count
 * or reported angle for this side" — distinct from the per-frame confidence
 * gating already performed inside `computeJointAngleDegrees` itself
 * (`shoulder-abduction-reach-metrics.ts`). No validation logic is
 * duplicated between the two; this module only supplies the joint list and
 * thresholds.
 */

import {
  validateMotionMetricInput,
  type MotionMetricValidationResult,
} from "@/app/lib/motion-intelligence/metric-validation";
import type { NormalizedMotionFrame } from "@/app/lib/motion-intelligence";
import {
  SHOULDER_ABDUCTION_REACH_CORE_JOINTS,
  type ShoulderAbductionReachSide,
  type ShoulderAbductionReachThresholds,
} from "./shoulder-abduction-reach-contract";

/**
 * Validate that a sequence of frames has enough confidently-tracked
 * hip/shoulder/elbow data for one side to trust downstream angle/rep output.
 */
export function validateShoulderAbductionReachFrames(
  frames: readonly NormalizedMotionFrame[],
  side: ShoulderAbductionReachSide,
  thresholds: ShoulderAbductionReachThresholds,
): MotionMetricValidationResult {
  const { hip, shoulder, elbow } = SHOULDER_ABDUCTION_REACH_CORE_JOINTS[side];

  return validateMotionMetricInput(frames, {
    requiredJoints: [hip, shoulder, elbow],
    minJointConfidence: thresholds.minJointConfidence,
    minFrameCount: thresholds.minFrameCount,
  });
}
