/**
 * RASQ Input Acquisition Layer — BlazePose motion acquisition adapter.
 *
 * First real implementation of `MotionAcquisitionAdapter`. Maps MediaPipe
 * BlazePose's 33-point landmark array (already flowing through every existing
 * CV detector via `PoseLandmarker.detectForVideo()`) onto Motion Intelligence
 * Core's device-agnostic `NormalizedMotionFrame` contract.
 *
 * This is the only file in the Input Acquisition Layer that imports a
 * capture-technology-specific type (`PoseLandmark`). Motion Intelligence Core
 * itself has no import of, or knowledge of, this adapter or this layer.
 *
 * BlazePose landmark index order matches Motion Intelligence Core's `JOINT_IDS`
 * order exactly (standard MediaPipe Pose topology, 0-32) — index `i` corresponds
 * to `JOINT_IDS[i]`. `z` is deliberately omitted: BlazePose's z is uncalibrated
 * relative depth, and carrying it forward would imply a 3D reliability this
 * source does not have. Sources with calibrated depth (e.g. a future Depth
 * Camera adapter) can populate `z` and use `coordinateSpace: "normalized_3d"`.
 */

import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { MIN_PRESENT_VISIBILITY } from "@/app/lib/cv/motion-quality-confidence";
import {
  JOINT_IDS,
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type NormalizedMotionFrame,
} from "@/app/lib/motion-intelligence";
import type { InputAcquisitionContext, MotionAcquisitionAdapter } from "../../contract";

function clampVisibility(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function isFiniteCoord(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Normalize a BlazePose landmark array into a `NormalizedMotionFrame`. Landmarks
 * with non-finite x/y are omitted from the frame rather than included with
 * invalid coordinates; missing/omitted joints are simply absent from the map,
 * consistent with `NormalizedMotionFrame.joints` being a `Partial` record.
 */
export function normalizeBlazePoseLandmarks(
  landmarks: readonly PoseLandmark[],
  context: InputAcquisitionContext,
): NormalizedMotionFrame {
  const joints: NormalizedMotionFrame["joints"] = {};

  JOINT_IDS.forEach((jointId, index) => {
    const landmark = landmarks[index];
    if (!landmark || !isFiniteCoord(landmark.x) || !isFiniteCoord(landmark.y)) {
      return;
    }

    const visibility = clampVisibility(landmark.visibility);
    joints[jointId] = {
      landmark: { x: landmark.x, y: landmark.y },
      confidence: {
        visibility,
        present: visibility >= MIN_PRESENT_VISIBILITY,
      },
    };
  });

  return {
    schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
    source: {
      kind: "web_camera_pose",
      capturedAtMs: context.capturedAtMs,
      frameIndex: context.frameIndex,
      coordinateSpace: "normalized_2d",
      deviceLabel: context.deviceLabel,
    },
    joints,
  };
}

export const BLAZEPOSE_ACQUISITION_ADAPTER: MotionAcquisitionAdapter<readonly PoseLandmark[]> = {
  family: "motion",
  sourceKind: "web_camera_pose",
  normalize(raw, context) {
    if (!Array.isArray(raw) || raw.length === 0) {
      return null;
    }

    const frame = normalizeBlazePoseLandmarks(raw, context);
    return Object.keys(frame.joints).length > 0 ? frame : null;
  },
};
