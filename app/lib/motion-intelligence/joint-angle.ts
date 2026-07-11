import type { JointConfidence, JointLandmark } from "./types";
import { DEFAULT_MIN_JOINT_VISIBILITY } from "./types";

export type JointAngleInput = {
  proximal: JointLandmark;
  vertex: JointLandmark;
  distal: JointLandmark;
};

export type JointAngleOptions = {
  minConfidence?: number;
  confidences?: readonly [JointConfidence, JointConfidence, JointConfidence];
};

function isFiniteCoord(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function meetsConfidenceThreshold(
  confidences: readonly [JointConfidence, JointConfidence, JointConfidence] | undefined,
  minConfidence: number,
): boolean {
  if (!confidences) return true;
  return confidences.every(
    (confidence) =>
      confidence.present && confidence.visibility >= minConfidence,
  );
}

/**
 * Compute the interior angle at `vertex` formed by proximal–vertex–distal in 2D.
 * Returns degrees in [0, 180], or null when geometry or confidence is insufficient.
 */
export function computeJointAngleDegrees(
  proximal: JointLandmark,
  vertex: JointLandmark,
  distal: JointLandmark,
  options: JointAngleOptions = {},
): number | null {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_JOINT_VISIBILITY;

  if (!meetsConfidenceThreshold(options.confidences, minConfidence)) {
    return null;
  }

  if (
    !isFiniteCoord(proximal.x) ||
    !isFiniteCoord(proximal.y) ||
    !isFiniteCoord(vertex.x) ||
    !isFiniteCoord(vertex.y) ||
    !isFiniteCoord(distal.x) ||
    !isFiniteCoord(distal.y)
  ) {
    return null;
  }

  const v1x = proximal.x - vertex.x;
  const v1y = proximal.y - vertex.y;
  const v2x = distal.x - vertex.x;
  const v2y = distal.y - vertex.y;

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 === 0 || mag2 === 0) {
    return null;
  }

  const dot = v1x * v2x + v1y * v2y;
  const cosTheta = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  const radians = Math.acos(cosTheta);
  const degrees = (radians * 180) / Math.PI;

  if (!Number.isFinite(degrees)) {
    return null;
  }

  return degrees;
}
