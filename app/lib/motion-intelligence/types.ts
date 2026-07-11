/**
 * RASQ Motion Intelligence Engine — device-agnostic frame contract (v1).
 * Pure types only. No CV detector imports. No clinical interpretation.
 */

export const MOTION_INTELLIGENCE_SCHEMA_VERSION = "mi-v1" as const;

export type MotionIntelligenceSchemaVersion = typeof MOTION_INTELLIGENCE_SCHEMA_VERSION;

/**
 * Motion capture source kinds.
 * v0 runtime: web_camera_pose only. Others are reserved for future adapters.
 */
export type MotionCaptureSourceKind =
  | "web_camera_pose"
  | "depth_camera"
  | "phone_camera";

export const DEFERRED_MOTION_CAPTURE_SOURCE_KINDS = [
  "depth_camera",
  "phone_camera",
] as const satisfies readonly MotionCaptureSourceKind[];

export type CoordinateSpace = "normalized_2d" | "normalized_3d";

export type MotionFrameSourceMetadata = {
  kind: MotionCaptureSourceKind;
  /** Monotonic capture timestamp in milliseconds. */
  capturedAtMs: number;
  /** Zero-based frame sequence index within a capture session. */
  frameIndex: number;
  coordinateSpace: CoordinateSpace;
  /** Optional non-PHI device label for debugging. */
  deviceLabel?: string;
};

/**
 * Strongly typed joint identifiers for normalized motion frames.
 * Names follow anatomical left/right convention.
 */
export type JointId =
  | "nose"
  | "left_eye_inner"
  | "left_eye"
  | "left_eye_outer"
  | "right_eye_inner"
  | "right_eye"
  | "right_eye_outer"
  | "left_ear"
  | "right_ear"
  | "mouth_left"
  | "mouth_right"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_pinky"
  | "right_pinky"
  | "left_index"
  | "right_index"
  | "left_thumb"
  | "right_thumb"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"
  | "left_heel"
  | "right_heel"
  | "left_foot_index"
  | "right_foot_index";

export const JOINT_IDS = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const satisfies readonly JointId[];

export type JointLandmark = {
  /** Normalized horizontal coordinate (0–1). */
  x: number;
  /** Normalized vertical coordinate (0–1). */
  y: number;
  /** Optional normalized depth for 3D sources. */
  z?: number;
};

export type JointConfidence = {
  /** Per-joint visibility or detection confidence (0–1). */
  visibility: number;
  /** Whether the source reported this joint as present. */
  present: boolean;
};

export type MotionFrameJoint = {
  landmark: JointLandmark;
  confidence: JointConfidence;
};

export type NormalizedMotionFrame = {
  schemaVersion: MotionIntelligenceSchemaVersion;
  source: MotionFrameSourceMetadata;
  joints: Partial<Record<JointId, MotionFrameJoint>>;
};

export const DEFAULT_MIN_JOINT_VISIBILITY = 0.35;

export function isJointId(value: unknown): value is JointId {
  return typeof value === "string" && (JOINT_IDS as readonly string[]).includes(value);
}

export function isMotionCaptureSourceKind(value: unknown): value is MotionCaptureSourceKind {
  return (
    value === "web_camera_pose" ||
    value === "depth_camera" ||
    value === "phone_camera"
  );
}
