/**
 * Shoulder Abduction Reach — contract (v0).
 *
 * First Shoulder Rehabilitation detector built entirely on Motion
 * Intelligence Core (`app/lib/motion-intelligence`) and the Input
 * Acquisition Layer (`app/lib/input-acquisition`), rather than the legacy
 * per-exercise pattern used by the other seven `app/lib/cv/*` detectors
 * (raw BlazePose index access, `sagittal-hip-rep-core.ts` baseline
 * calibration, shared `SitToStandDetectorSnapshot` coupling). This module
 * does not import from, depend on, or modify any of those.
 *
 * Descriptive only: angle numbers, presence/confidence flags, rep counts,
 * and peak values. No pass/fail, no severity labels, no "normal range of
 * motion" comparison, no diagnosis — consistent with
 * `motion-metrics.ts`'s existing "not a clinical range-of-motion
 * measurement" framing, which this module inherits.
 */

import { DEFAULT_MIN_JOINT_VISIBILITY, type JointId } from "@/app/lib/motion-intelligence";

export type ShoulderAbductionReachSide = "left" | "right";

export const SHOULDER_ABDUCTION_REACH_SIDES: readonly ShoulderAbductionReachSide[] = [
  "left",
  "right",
];

/** Joints required to compute the abduction angle for one side. */
export type ShoulderAbductionReachCoreJoints = {
  hip: JointId;
  shoulder: JointId;
  elbow: JointId;
};

/** Joint used for the secondary, non-required reach-extent observation. */
export type ShoulderAbductionReachBonusJoints = {
  wrist: JointId;
};

export const SHOULDER_ABDUCTION_REACH_CORE_JOINTS: Record<
  ShoulderAbductionReachSide,
  ShoulderAbductionReachCoreJoints
> = {
  left: { hip: "left_hip", shoulder: "left_shoulder", elbow: "left_elbow" },
  right: { hip: "right_hip", shoulder: "right_shoulder", elbow: "right_elbow" },
};

export const SHOULDER_ABDUCTION_REACH_BONUS_JOINTS: Record<
  ShoulderAbductionReachSide,
  ShoulderAbductionReachBonusJoints
> = {
  left: { wrist: "left_wrist" },
  right: { wrist: "right_wrist" },
};

export type ShoulderAbductionReachPhase =
  | "resting"
  | "raising"
  | "peak_abduction"
  | "lowering"
  | "unknown";

export type ShoulderAbductionReachThresholds = {
  /** Minimum per-joint confidence for hip/shoulder/elbow to trust an angle. */
  minJointConfidence: number;
  /** Minimum valid frames required before a session-level check is trusted. */
  minFrameCount: number;
  /** Angle at/below which the arm is considered at rest. */
  restingMaxAngleDegrees: number;
  /** Angle at/above which the arm is considered to have reached a peak raise. */
  peakMinAngleDegrees: number;
  /** Hysteresis below peakMinAngleDegrees before leaving "peak_abduction" — avoids threshold jitter. */
  peakLowerHysteresisDegrees: number;
  /** Consecutive frames with no usable angle before phase becomes "unknown". */
  poseLostUnknownMinTicks: number;
};

/** Technical v0 defaults — not derived from any clinical normal-ROM standard. */
export const DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS: ShoulderAbductionReachThresholds = {
  minJointConfidence: DEFAULT_MIN_JOINT_VISIBILITY,
  minFrameCount: 1,
  restingMaxAngleDegrees: 20,
  peakMinAngleDegrees: 70,
  peakLowerHysteresisDegrees: 10,
  poseLostUnknownMinTicks: 8,
};
