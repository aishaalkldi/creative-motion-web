import { isJointConfident } from "./frame-validation";
import {
  DEFAULT_MIN_JOINT_VISIBILITY,
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointId,
  type JointLandmark,
  type MotionFrameJoint,
  type NormalizedMotionFrame,
} from "./types";

export type RelativeJointOffset = {
  deltaX: number;
  deltaY: number;
};

export type BilateralJointPair = {
  left: JointId;
  right: JointId;
};

export const BILATERAL_KNEE_PAIR: BilateralJointPair = {
  left: "left_knee",
  right: "right_knee",
};

export type MotionMetricsOptions = {
  minVisibility?: number;
};

export type JointDistanceOptions = MotionMetricsOptions & {
  use3D?: boolean;
};

function isFiniteCoord(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getConfidentJoint(
  frame: NormalizedMotionFrame,
  jointId: JointId,
  minVisibility: number,
): MotionFrameJoint | null {
  const joint = frame.joints[jointId];
  if (!joint || !isJointConfident(joint.confidence, minVisibility)) {
    return null;
  }
  return joint;
}

function getConfidentLandmark(
  frame: NormalizedMotionFrame,
  jointId: JointId,
  minVisibility: number,
): JointLandmark | null {
  const joint = getConfidentJoint(frame, jointId, minVisibility);
  if (!joint) return null;

  const { x, y, z } = joint.landmark;
  if (!isFiniteCoord(x) || !isFiniteCoord(y)) {
    return null;
  }

  return z !== undefined && Number.isFinite(z)
    ? { x, y, z }
    : { x, y };
}

/**
 * Euclidean distance between two joints in normalized coordinate space.
 */
export function computeJointDistance(
  frame: NormalizedMotionFrame,
  jointA: JointId,
  jointB: JointId,
  options: JointDistanceOptions = {},
): number | null {
  const minVisibility = options.minVisibility ?? DEFAULT_MIN_JOINT_VISIBILITY;
  const landmarkA = getConfidentLandmark(frame, jointA, minVisibility);
  const landmarkB = getConfidentLandmark(frame, jointB, minVisibility);

  if (!landmarkA || !landmarkB) {
    return null;
  }

  const dx = landmarkB.x - landmarkA.x;
  const dy = landmarkB.y - landmarkA.y;

  if (options.use3D) {
    if (!isFiniteCoord(landmarkA.z) || !isFiniteCoord(landmarkB.z)) {
      return null;
    }
    const dz = landmarkB.z! - landmarkA.z!;
    return Math.hypot(dx, dy, dz);
  }

  return Math.hypot(dx, dy);
}

/**
 * Relative offset between two joints in the same frame (not temporal displacement).
 */
export function computeRelativeJointOffset(
  frame: NormalizedMotionFrame,
  fromJoint: JointId,
  toJoint: JointId,
  options: MotionMetricsOptions = {},
): RelativeJointOffset | null {
  const minVisibility = options.minVisibility ?? DEFAULT_MIN_JOINT_VISIBILITY;
  const from = getConfidentLandmark(frame, fromJoint, minVisibility);
  const to = getConfidentLandmark(frame, toJoint, minVisibility);

  if (!from || !to) {
    return null;
  }

  return {
    deltaX: to.x - from.x,
    deltaY: to.y - from.y,
  };
}

/**
 * Absolute difference between left and right joint coordinates on one axis.
 * Geometric comparison only — not a clinical symmetry score.
 */
export function computeBilateralSymmetryDifference(
  frame: NormalizedMotionFrame,
  pair: BilateralJointPair,
  axis: "x" | "y",
  options: MotionMetricsOptions = {},
): number | null {
  const minVisibility = options.minVisibility ?? DEFAULT_MIN_JOINT_VISIBILITY;
  const left = getConfidentLandmark(frame, pair.left, minVisibility);
  const right = getConfidentLandmark(frame, pair.right, minVisibility);

  if (!left || !right) {
    return null;
  }

  const leftValue = axis === "x" ? left.x : left.y;
  const rightValue = axis === "x" ? right.x : right.y;

  return Math.abs(leftValue - rightValue);
}

/**
 * Normalized coordinate span for one joint across a frame sequence.
 * Not a clinical range-of-motion measurement.
 */
export function computeJointCoordinateSpan(
  frames: readonly NormalizedMotionFrame[],
  jointId: JointId,
  axis: "x" | "y",
  options: MotionMetricsOptions = {},
): number | null {
  const minVisibility = options.minVisibility ?? DEFAULT_MIN_JOINT_VISIBILITY;
  const values: number[] = [];

  for (const frame of frames) {
    const landmark = getConfidentLandmark(frame, jointId, minVisibility);
    if (!landmark) continue;
    values.push(axis === "x" ? landmark.x : landmark.y);
  }

  if (values.length < 2) {
    return null;
  }

  return Math.max(...values) - Math.min(...values);
}
