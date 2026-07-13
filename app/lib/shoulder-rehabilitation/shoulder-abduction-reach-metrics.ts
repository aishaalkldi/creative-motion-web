/**
 * Shoulder Abduction Reach — per-frame metrics (v0).
 *
 * Pure geometry over an already-normalized `NormalizedMotionFrame`. Every
 * computation here is a direct call into existing Motion Intelligence Core
 * primitives (`computeJointAngleDegrees`, `computeRelativeJointOffset`) —
 * no new geometry, confidence, or validation logic is introduced.
 *
 * Angle convention: `computeJointAngleDegrees(hip, shoulder, elbow)` reads
 * the interior angle at the shoulder between the shoulder→hip vector (the
 * trunk reference line) and the shoulder→elbow vector (the upper arm). At
 * rest the arm hangs roughly parallel to the trunk (small angle); raised to
 * horizontal it is roughly perpendicular (~90°); raised further it
 * approaches 180°. This is a technical geometric observation from a single
 * camera view, not a clinical goniometric measurement.
 */

import {
  computeJointAngleDegrees,
  computeRelativeJointOffset,
  type NormalizedMotionFrame,
  type RelativeJointOffset,
} from "@/app/lib/motion-intelligence";
import {
  SHOULDER_ABDUCTION_REACH_BONUS_JOINTS,
  SHOULDER_ABDUCTION_REACH_CORE_JOINTS,
  type ShoulderAbductionReachSide,
} from "./shoulder-abduction-reach-contract";

export type ShoulderAbductionReachSideMetrics = {
  side: ShoulderAbductionReachSide;
  /** Degrees in [0, 180], or null when a required joint is missing/absent or below confidence. */
  abductionAngleDegrees: number | null;
  /** Wrist position relative to the shoulder — negative deltaY means wrist above shoulder. Bonus-joint observation, not required for the angle. */
  wristOffsetFromShoulder: RelativeJointOffset | null;
};

/**
 * Compute one side's abduction angle. Confidence gating is delegated
 * entirely to `computeJointAngleDegrees`'s own `confidences` option — this
 * function does not re-implement a confidence check.
 */
export function computeShoulderAbductionAngle(
  frame: NormalizedMotionFrame,
  side: ShoulderAbductionReachSide,
  minConfidence: number,
): number | null {
  const { hip, shoulder, elbow } = SHOULDER_ABDUCTION_REACH_CORE_JOINTS[side];
  const hipJoint = frame.joints[hip];
  const shoulderJoint = frame.joints[shoulder];
  const elbowJoint = frame.joints[elbow];

  if (!hipJoint || !shoulderJoint || !elbowJoint) {
    return null;
  }

  return computeJointAngleDegrees(hipJoint.landmark, shoulderJoint.landmark, elbowJoint.landmark, {
    minConfidence,
    confidences: [hipJoint.confidence, shoulderJoint.confidence, elbowJoint.confidence],
  });
}

/**
 * Bonus-joint observation: wrist position relative to the shoulder. Not
 * required for angle computation or phase/rep tracking — a secondary
 * "how far did the reach travel" signal only, reported when available.
 */
export function computeShoulderAbductionWristOffset(
  frame: NormalizedMotionFrame,
  side: ShoulderAbductionReachSide,
  minConfidence: number,
): RelativeJointOffset | null {
  const { wrist } = SHOULDER_ABDUCTION_REACH_BONUS_JOINTS[side];
  const { shoulder } = SHOULDER_ABDUCTION_REACH_CORE_JOINTS[side];
  // computeRelativeJointOffset(frame, fromJoint, toJoint) returns to - from,
  // so fromJoint=shoulder, toJoint=wrist yields wrist relative to shoulder.
  return computeRelativeJointOffset(frame, shoulder, wrist, { minVisibility: minConfidence });
}

export function computeShoulderAbductionReachSideMetrics(
  frame: NormalizedMotionFrame,
  side: ShoulderAbductionReachSide,
  minConfidence: number,
): ShoulderAbductionReachSideMetrics {
  return {
    side,
    abductionAngleDegrees: computeShoulderAbductionAngle(frame, side, minConfidence),
    wristOffsetFromShoulder: computeShoulderAbductionWristOffset(frame, side, minConfidence),
  };
}

/**
 * Plain numeric difference between two independently computed side angles.
 * Not `computeBilateralSymmetryDifference` (that diffs raw landmark
 * coordinates on one axis) — comparing two already-computed angle values is
 * arithmetic, not a geometry primitive that needs its own core function.
 */
export function computeBilateralAbductionAngleDifference(
  leftAngleDegrees: number | null,
  rightAngleDegrees: number | null,
): number | null {
  if (leftAngleDegrees === null || rightAngleDegrees === null) {
    return null;
  }
  return leftAngleDegrees - rightAngleDegrees;
}
