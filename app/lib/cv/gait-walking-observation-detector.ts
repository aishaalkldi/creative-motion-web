/**
 * Gait Assessment v1 — bounded walking observation engine.
 * Duration, movement detection, optional step estimate. Therapist review only — not diagnostic.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import { GAIT_WALKING_OBSERVATION_EXERCISE_ID } from "@/app/lib/cv/gait-assessment-exercise-ids";
import { evaluateBodyFraming, type BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import { STANDING_SAGITTAL_REP_FRAMING_PROFILE } from "@/app/lib/cv/body-framing-profiles";
import {
  emptyVisibilityLabelCounts,
  evaluateTrackingQualityFromHipVisSum,
  summarizeSessionVisibility,
  type VisibilityLabel,
  type VisibilityLabelCounts,
} from "@/app/lib/cv/session-visibility-summary";
import {
  computeHipMidY,
  computeTorsoSpan,
  hipsMeetMinVisibility,
  type PoseLandmark,
} from "@/app/lib/cv/sagittal-hip-rep-core";

export type GaitWalkingDerivedMetrics = {
  exerciseId: typeof GAIT_WALKING_OBSERVATION_EXERCISE_ID;
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type GaitWalkingConfig = {
  minHipVisibility: number;
  visibilityGood: number;
  visibilityFair: number;
  minSaveDurationS: number;
  maxSessionDurationS: number;
  /** Min hip-Y swing to count a step half-cycle. */
  minStepSwingRatio: number;
  stepDebounceMs: number;
};

export const ASSESSMENT_GAIT_WALKING_CONFIG: GaitWalkingConfig = {
  minHipVisibility: 0.35,
  visibilityGood: 1.0,
  visibilityFair: 0.6,
  minSaveDurationS: 5,
  maxSessionDurationS: 30,
  minStepSwingRatio: 0.012,
  stepDebounceMs: 250,
};

export type GaitWalkingDetectorSnapshot = {
  repCount: number;
  sessionSeconds: number;
  movementDetected: boolean;
  trackingStatus: "idle" | "detecting" | "pose-found" | "pose-lost";
  trackingQuality: VisibilityLabel | null;
  bodyFramingState: BodyFramingState;
  framesWithPose: number;
  framesTotal: number;
  bilateralVisible: boolean;
};

export class GaitWalkingObservationEngine {
  private readonly config: GaitWalkingConfig;
  private sessionStartMs: number | null = null;
  private sessionEndMs: number | null = null;
  private lastFrameMs = 0;
  private framesWithPose = 0;
  private framesTotal = 0;
  private hipVisSamples: number[] = [];
  private visibilityLabelCounts: VisibilityLabelCounts = emptyVisibilityLabelCounts();
  private lastTrackingQuality: VisibilityLabel | null = null;
  private bodyFramingState: BodyFramingState = "checking";
  private movementDetected = false;
  private stepCount = 0;
  private lastHipY: number | null = null;
  private lastStepMs = 0;
  private swingMin: number | null = null;
  private swingMax: number | null = null;
  private lastSwingDirection: "up" | "down" | null = null;
  private bilateralVisibleFrames = 0;

  constructor(config: GaitWalkingConfig = ASSESSMENT_GAIT_WALKING_CONFIG) {
    this.config = config;
  }

  reset(): void {
    this.sessionStartMs = null;
    this.sessionEndMs = null;
    this.lastFrameMs = 0;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.hipVisSamples = [];
    this.visibilityLabelCounts = emptyVisibilityLabelCounts();
    this.lastTrackingQuality = null;
    this.bodyFramingState = "checking";
    this.movementDetected = false;
    this.stepCount = 0;
    this.lastHipY = null;
    this.lastStepMs = 0;
    this.swingMin = null;
    this.swingMax = null;
    this.lastSwingDirection = null;
    this.bilateralVisibleFrames = 0;
  }

  endSession(nowMs: number): void {
    this.sessionEndMs = nowMs;
  }

  driveFrame(landmarks: PoseLandmark[], nowMs: number): void {
    if (this.sessionStartMs === null) {
      this.sessionStartMs = nowMs;
    }
    this.lastFrameMs = nowMs;
    this.framesTotal += 1;

    const sessionSeconds = this.resolveSessionSeconds(nowMs);
    if (sessionSeconds >= this.config.maxSessionDurationS) {
      return;
    }

    const hipVisSum = (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
    const trackingQuality = evaluateTrackingQualityFromHipVisSum(
      hipVisSum,
      this.config.visibilityGood,
      this.config.visibilityFair,
    );
    this.lastTrackingQuality = trackingQuality;
    this.bodyFramingState = evaluateBodyFraming(landmarks, STANDING_SAGITTAL_REP_FRAMING_PROFILE, {
      checking: false,
      trackingQuality,
    });

    if (!hipsMeetMinVisibility(landmarks, this.config.minHipVisibility)) {
      return;
    }

    this.framesWithPose += 1;
    this.hipVisSamples.push(hipVisSum);
    this.visibilityLabelCounts[trackingQuality] += 1;

    const leftHip = landmarks[23]?.visibility ?? 0;
    const rightHip = landmarks[24]?.visibility ?? 0;
    if (leftHip >= this.config.minHipVisibility && rightHip >= this.config.minHipVisibility) {
      this.bilateralVisibleFrames += 1;
    }

    const hipY = computeHipMidY(landmarks);
    const torsoSpan = computeTorsoSpan(landmarks) ?? 0.2;
    const minSwing = Math.max(this.config.minStepSwingRatio, torsoSpan * 0.04);

    if (this.lastHipY !== null) {
      const delta = hipY - this.lastHipY;
      if (Math.abs(delta) > minSwing * 0.25) {
        this.movementDetected = true;
      }

      this.swingMin = this.swingMin === null ? hipY : Math.min(this.swingMin, hipY);
      this.swingMax = this.swingMax === null ? hipY : Math.max(this.swingMax, hipY);
      const swing = (this.swingMax ?? hipY) - (this.swingMin ?? hipY);

      if (swing >= minSwing) {
        const direction: "up" | "down" = delta > 0 ? "down" : "up";
        if (
          this.lastSwingDirection &&
          direction !== this.lastSwingDirection &&
          nowMs - this.lastStepMs >= this.config.stepDebounceMs
        ) {
          const trackingOk =
            trackingQuality === "good" || trackingQuality === "fair";
          if (trackingOk) {
            this.stepCount += 1;
            this.lastStepMs = nowMs;
          }
        }
        if (Math.abs(delta) > minSwing * 0.15) {
          this.lastSwingDirection = delta > 0 ? "down" : "up";
        }
      }
    }
    this.lastHipY = hipY;
  }

  getSnapshot(nowMs = this.lastFrameMs): GaitWalkingDetectorSnapshot {
    return {
      repCount: this.stepCount,
      sessionSeconds: this.resolveSessionSeconds(nowMs),
      movementDetected: this.movementDetected,
      trackingStatus: this.resolveTrackingStatus(),
      trackingQuality: this.lastTrackingQuality,
      bodyFramingState: this.bodyFramingState,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
      bilateralVisible:
        this.framesWithPose > 0 &&
        this.bilateralVisibleFrames / this.framesWithPose >= 0.5,
    };
  }

  getDerivedMetrics(): GaitWalkingDerivedMetrics {
    const sessionSeconds = this.resolveSessionSeconds();
    const trackingQuality = summarizeSessionVisibility({
      hipVisSamples: this.hipVisSamples,
      labelCounts: this.visibilityLabelCounts,
      framesWithPose: this.framesWithPose,
      visibilityGood: this.config.visibilityGood,
      visibilityFair: this.config.visibilityFair,
    });

    const trackingOk = trackingQuality === "good" || trackingQuality === "fair";
    const stepEstimate =
      trackingOk && this.movementDetected ? this.stepCount : 0;

    return {
      exerciseId: GAIT_WALKING_OBSERVATION_EXERCISE_ID,
      repCount: stepEstimate,
      sessionDurationS: sessionSeconds,
      trackingQuality,
      movementDetected: this.movementDetected,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
    };
  }

  canSaveMetrics(): boolean {
    const metrics = this.getDerivedMetrics();
    return (
      metrics.sessionDurationS >= this.config.minSaveDurationS &&
      metrics.movementDetected
    );
  }

  private resolveSessionSeconds(nowMs = this.lastFrameMs): number {
    if (this.sessionStartMs === null) return 0;
    const endMs = this.sessionEndMs ?? nowMs;
    if (endMs < this.sessionStartMs) return 0;
    return Math.floor((endMs - this.sessionStartMs) / 1_000);
  }

  private resolveTrackingStatus(): GaitWalkingDetectorSnapshot["trackingStatus"] {
    if (this.sessionStartMs === null) return "idle";
    if (this.framesWithPose === 0) return "detecting";
    if (this.framesWithPose === this.framesTotal) return "pose-found";
    return "pose-lost";
  }
}
