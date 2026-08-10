/**
 * Deterministic Posture Screen demo fixtures (Phase-2A).
 *
 * Pure TypeScript — no React, no DOM, no persistence, no clinical presentation.
 *
 * Canonical path (required):
 *   Synthetic PoseLandmark[]
 *   → BLAZEPOSE_ACQUISITION_ADAPTER.normalize(...)
 *   → NormalizedMotionFrame
 *   → analysePostureNormalizedFrame(...)
 *   → PostureCheckResult | null
 *   → aggregatePostureResults(...)
 */
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { BLAZEPOSE_ACQUISITION_ADAPTER } from "@/app/lib/input-acquisition/adapters/motion/blazepose-acquisition-adapter";
import type { InputAcquisitionContext } from "@/app/lib/input-acquisition/contract";
import type { NormalizedMotionFrame } from "@/app/lib/motion-intelligence";
import {
  aggregatePostureResults,
  type PostureAggregateResult,
  type PostureCheckResult,
} from "@/app/lib/posture-analyzer";
import { analysePostureNormalizedFrame } from "./posture-frame-bridge";

export type PostureDemoScenarioId =
  | "aligned"
  | "mildShoulderTilt"
  | "markedShoulderTilt"
  | "lowVisibility"
  | "missingRequiredJoint"
  | "mixedSequence";

export type PostureDemoScenarioResult = {
  scenarioId: PostureDemoScenarioId;
  /** Frames that successfully bridged to PostureCheckResult. */
  frameResults: PostureCheckResult[];
  /** Per-frame bridge outcomes including nulls (for low-visibility / missing). */
  bridgeOutcomes: Array<PostureCheckResult | null>;
  aggregate: PostureAggregateResult;
};

function acquisitionContext(frameIndex: number, capturedAtMs: number): InputAcquisitionContext {
  return {
    capturedAtMs,
    frameIndex,
    deviceLabel: "posture-demo-fixture",
  };
}

/**
 * Build a 33-slot MediaPipe-shaped PoseLandmark array.
 * Unspecified indices use out-of-range placeholders so the adapter omits them.
 */
export function buildPoseLandmarks(
  joints: Partial<Record<number, { x: number; y: number; visibility: number }>>
): PoseLandmark[] {
  const landmarks: PoseLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    const joint = joints[i];
    if (joint) {
      landmarks[i] = {
        x: joint.x,
        y: joint.y,
        visibility: joint.visibility,
      };
    } else {
      landmarks[i] = { x: -1, y: -1, visibility: 0 };
    }
  }
  return landmarks;
}

/** Level shoulders/hips, centred nose — Phase-1 aligned fixture. */
export function buildAlignedPoseLandmarks(
  visibility = 1
): PoseLandmark[] {
  return buildPoseLandmarks({
    0: { x: 0.5, y: 0.2, visibility },
    11: { x: 0.4, y: 0.35, visibility },
    12: { x: 0.6, y: 0.35, visibility },
    23: { x: 0.4, y: 0.65, visibility },
    24: { x: 0.6, y: 0.65, visibility },
  });
}

/** Shoulder tilt via vertical delta on right shoulder (same geometry as Phase-1 tests). */
export function buildShoulderTiltPoseLandmarks(
  tiltDeg: number,
  visibility = 1
): PoseLandmark[] {
  const halfWidth = 0.1;
  const dy = Math.tan((tiltDeg * Math.PI) / 180) * (halfWidth * 2);
  return buildPoseLandmarks({
    0: { x: 0.5, y: 0.2, visibility },
    11: { x: 0.4, y: 0.35, visibility },
    12: { x: 0.6, y: 0.35 + dy, visibility },
    23: { x: 0.4, y: 0.65, visibility },
    24: { x: 0.6, y: 0.65, visibility },
  });
}

/** Required joints present but nose visibility below posture threshold. */
export function buildLowVisibilityPoseLandmarks(): PoseLandmark[] {
  return buildAlignedPoseLandmarks(1).map((lm, index) =>
    index === 0 ? { ...lm, visibility: 0.29 } : lm
  );
}

/** Omit left hip (index 23) so the adapter does not include left_hip. */
export function buildMissingRequiredJointPoseLandmarks(): PoseLandmark[] {
  const landmarks = buildAlignedPoseLandmarks(1);
  landmarks[23] = { x: -1, y: -1, visibility: 0 };
  return landmarks;
}

/**
 * Canonical acquisition step — always uses the real BlazePose adapter.
 * Returns null when the adapter produces no joints.
 */
export function normalizePoseLandmarksForPosture(
  landmarks: readonly PoseLandmark[],
  frameIndex = 0,
  capturedAtMs = 1_000
): NormalizedMotionFrame | null {
  return BLAZEPOSE_ACQUISITION_ADAPTER.normalize(
    landmarks,
    acquisitionContext(frameIndex, capturedAtMs)
  );
}

export function runPostureAcquisitionPipeline(
  landmarks: readonly PoseLandmark[],
  frameIndex = 0,
  capturedAtMs = 1_000
): {
  frame: NormalizedMotionFrame | null;
  result: PostureCheckResult | null;
} {
  const frame = normalizePoseLandmarksForPosture(landmarks, frameIndex, capturedAtMs);
  if (!frame) {
    return { frame: null, result: null };
  }
  return { frame, result: analysePostureNormalizedFrame(frame) };
}

function collectFromLandmarkSequences(
  sequences: readonly PoseLandmark[][]
): {
  frameResults: PostureCheckResult[];
  bridgeOutcomes: Array<PostureCheckResult | null>;
} {
  const frameResults: PostureCheckResult[] = [];
  const bridgeOutcomes: Array<PostureCheckResult | null> = [];

  sequences.forEach((landmarks, index) => {
    const { result } = runPostureAcquisitionPipeline(
      landmarks,
      index,
      1_000 + index * 33
    );
    bridgeOutcomes.push(result);
    if (result) frameResults.push(result);
  });

  return { frameResults, bridgeOutcomes };
}

export function runPostureDemoScenario(
  scenarioId: PostureDemoScenarioId
): PostureDemoScenarioResult {
  let sequences: PoseLandmark[][];

  switch (scenarioId) {
    case "aligned":
      sequences = [buildAlignedPoseLandmarks()];
      break;
    case "mildShoulderTilt":
      sequences = [buildShoulderTiltPoseLandmarks(5)];
      break;
    case "markedShoulderTilt":
      sequences = [buildShoulderTiltPoseLandmarks(10)];
      break;
    case "lowVisibility":
      sequences = [buildLowVisibilityPoseLandmarks()];
      break;
    case "missingRequiredJoint":
      sequences = [buildMissingRequiredJointPoseLandmarks()];
      break;
    case "mixedSequence":
      // 100 + 88 → average 94
      sequences = [
        buildAlignedPoseLandmarks(),
        buildShoulderTiltPoseLandmarks(5),
      ];
      break;
    default: {
      const _exhaustive: never = scenarioId;
      throw new Error(`Unknown posture demo scenario: ${_exhaustive}`);
    }
  }

  const { frameResults, bridgeOutcomes } = collectFromLandmarkSequences(sequences);
  return {
    scenarioId,
    frameResults,
    bridgeOutcomes,
    aggregate: aggregatePostureResults(frameResults),
  };
}

export function listPostureDemoScenarioIds(): PostureDemoScenarioId[] {
  return [
    "aligned",
    "mildShoulderTilt",
    "markedShoulderTilt",
    "lowVisibility",
    "missingRequiredJoint",
    "mixedSequence",
  ];
}
