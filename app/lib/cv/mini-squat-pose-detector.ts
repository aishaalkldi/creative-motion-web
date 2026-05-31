/**
 * Patient portal Mini Squat CV detector — drop polarity via shared pose runtime.
 * On-device only — no landmarks or video are persisted.
 */

import type { MiniSquatDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { PATIENT_MINI_SQUAT_CONFIG } from "@/app/lib/cv/cv-patient-config";
import {
  SitToStandDetector,
  type SitToStandDetectorCallbacks,
  type SitToStandDetectorSnapshot,
} from "@/app/lib/cv/sit-to-stand-detector";

export type MiniSquatDetectorSnapshot = SitToStandDetectorSnapshot;

export {
  formatSitToStandDuration as formatMiniSquatDuration,
  mapSitToStandStartError as mapMiniSquatStartError,
} from "@/app/lib/cv/sit-to-stand-detector";

export type {
  PoseReadiness,
  SitToStandInitPhase,
  SitToStandTrackingQuality,
  SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";

/**
 * Mini squat patient detector — standing baseline, hip drop rep counting.
 */
export class MiniSquatDetector extends SitToStandDetector {
  constructor(
    callbacks: SitToStandDetectorCallbacks,
    config = PATIENT_MINI_SQUAT_CONFIG,
  ) {
    super(callbacks, {
      ...config,
      repPolarity: "drop",
      metricsExerciseId: "mini-squat",
    });
  }

  override getDerivedMetrics(): MiniSquatDerivedMetrics {
    const metrics = super.getDerivedMetrics();
    return {
      exerciseId: "mini-squat",
      repCount: metrics.repCount,
      sessionDurationS: metrics.sessionDurationS,
      trackingQuality: metrics.trackingQuality,
      movementDetected: metrics.movementDetected,
      framesWithPose: metrics.framesWithPose,
      framesTotal: metrics.framesTotal,
    };
  }
}
