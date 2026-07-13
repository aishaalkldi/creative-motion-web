/**
 * STS shadow-mode comparison (Input Acquisition Layer validation, v0).
 *
 * Runs the Input Acquisition Layer + Motion Intelligence Core on the exact
 * same raw landmarks the live Sit-to-Stand detector already receives per
 * frame, and compares the result against the detector's own existing
 * hip-visibility tracking-quality signal.
 *
 * This module does not modify, call into, subclass, or depend on
 * `SitToStandDetector` in any way. It reuses the detector's existing
 * exported pure functions (`evaluateHipTrackingQuality`) and the shared
 * visibility classifier (`evaluateTrackingQualityFromHipVisSum`) as the
 * "legacy" side of the comparison rather than re-implementing
 * tracking-quality classification — per RASQ's "do not duplicate measured
 * metrics or business logic" constraint.
 *
 * Nothing here is wired into the live capture loop, any component, any API
 * route, or the database. It is an internal validation harness: feed it
 * recorded or synthetic landmark sequences, get a comparison report. See
 * `docs/sts-shadow-mode-validation.md` for the full design rationale and the
 * deferred live-wiring plan.
 */

import { DEFAULT_STS_CONFIG } from "@/app/lib/cv/bio-0-contracts";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { evaluateTrackingQualityFromHipVisSum } from "@/app/lib/cv/session-visibility-summary";
import {
  evaluateHipTrackingQuality,
  type SitToStandTrackingQuality,
} from "@/app/lib/cv/sit-to-stand-detector";
import {
  BLAZEPOSE_ACQUISITION_ADAPTER,
  type InputAcquisitionContext,
} from "@/app/lib/input-acquisition";
import { validateNormalizedMotionFrame } from "@/app/lib/motion-intelligence";

export type StsShadowVisibilityThresholds = {
  visibilityGood: number;
  visibilityFair: number;
};

/** Mirrors the live detector's DEFAULT_STS_CONFIG thresholds — not a new default. */
export const DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS: StsShadowVisibilityThresholds = {
  visibilityGood: DEFAULT_STS_CONFIG.visibilityGood,
  visibilityFair: DEFAULT_STS_CONFIG.visibilityFair,
};

export type StsShadowDivergenceReason =
  | "tracking_quality_mismatch"
  | "hip_visibility_sum_delta_exceeds_tolerance"
  | "new_frame_contract_invalid"
  | "new_frame_missing_hip_joint";

export type StsShadowFrameComparison = {
  frameIndex: number;
  capturedAtMs: number;
  legacy: {
    hipVisibilitySum: number;
    trackingQuality: SitToStandTrackingQuality;
  };
  next: {
    hipVisibilitySum: number;
    trackingQuality: SitToStandTrackingQuality;
    frameContractValid: boolean;
    leftHipPresent: boolean;
    rightHipPresent: boolean;
  };
  hipVisibilitySumDelta: number;
  divergent: boolean;
  divergenceReasons: StsShadowDivergenceReason[];
};

const HIP_VISIBILITY_SUM_TOLERANCE = 1e-6;

/** Identical expression to the one already inlined in sit-to-stand-detector.ts. */
function legacyHipVisibilitySum(landmarks: readonly PoseLandmark[]): number {
  return (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
}

/**
 * Compare the legacy (raw-index) and Input Acquisition Layer paths for one
 * frame. Both paths read the exact same `landmarks` array — no new capture,
 * no altered detector state, no side effects.
 */
export function compareStsShadowFrame(
  landmarks: readonly PoseLandmark[],
  context: InputAcquisitionContext,
  thresholds: StsShadowVisibilityThresholds = DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS,
): StsShadowFrameComparison {
  const { visibilityGood, visibilityFair } = thresholds;

  const legacyHipVis = legacyHipVisibilitySum(landmarks);
  const legacyQuality = evaluateHipTrackingQuality([...landmarks], visibilityGood, visibilityFair);

  const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, context);
  const frameContractValid = frame !== null && validateNormalizedMotionFrame(frame).valid;

  const leftHipVisibility = frame?.joints.left_hip?.confidence.visibility ?? 0;
  const rightHipVisibility = frame?.joints.right_hip?.confidence.visibility ?? 0;
  const nextHipVis = leftHipVisibility + rightHipVisibility;
  const nextQuality = evaluateTrackingQualityFromHipVisSum(nextHipVis, visibilityGood, visibilityFair);

  const leftHipPresent = frame?.joints.left_hip !== undefined;
  const rightHipPresent = frame?.joints.right_hip !== undefined;
  const hipVisibilitySumDelta = nextHipVis - legacyHipVis;

  const divergenceReasons: StsShadowDivergenceReason[] = [];
  if (legacyQuality !== nextQuality) {
    divergenceReasons.push("tracking_quality_mismatch");
  }
  if (Math.abs(hipVisibilitySumDelta) > HIP_VISIBILITY_SUM_TOLERANCE) {
    divergenceReasons.push("hip_visibility_sum_delta_exceeds_tolerance");
  }
  if (!frameContractValid) {
    divergenceReasons.push("new_frame_contract_invalid");
  }
  if (legacyHipVis > 0 && (!leftHipPresent || !rightHipPresent)) {
    divergenceReasons.push("new_frame_missing_hip_joint");
  }

  return {
    frameIndex: context.frameIndex,
    capturedAtMs: context.capturedAtMs,
    legacy: {
      hipVisibilitySum: legacyHipVis,
      trackingQuality: legacyQuality,
    },
    next: {
      hipVisibilitySum: nextHipVis,
      trackingQuality: nextQuality,
      frameContractValid,
      leftHipPresent,
      rightHipPresent,
    },
    hipVisibilitySumDelta,
    divergent: divergenceReasons.length > 0,
    divergenceReasons,
  };
}
