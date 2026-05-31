/**
 * CV Lab / internal Single-Leg Stance hold detector (foundation only).
 * Not enabled for patient portal in SINGLE-LEG-STANCE-CV-PR-1.
 */

import {
  DEFAULT_STS_CONFIG,
  type CvTrackingQuality,
  type SitToStandCvConfig,
} from "@/app/lib/cv/bio-0-contracts";
import { evaluateBodyFraming, type BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import { STANDING_SAGITTAL_REP_FRAMING_PROFILE } from "@/app/lib/cv/body-framing-profiles";
import {
  emptyVisibilityLabelCounts,
  evaluateTrackingQualityFromHipVisSum,
  summarizeSessionVisibility,
  type VisibilityLabelCounts,
} from "@/app/lib/cv/session-visibility-summary";
import {
  evaluateHipTrackingQuality,
  evaluatePoseFrameReadiness,
  type PoseReadiness,
  type SitToStandTrackingQuality,
} from "@/app/lib/cv/sit-to-stand-detector";
import {
  computeTorsoSpan,
  hipsMeetMinVisibility,
  type PoseLandmark,
} from "@/app/lib/cv/sagittal-hip-rep-core";

export type StanceLeg = "left" | "right";

export type SlsHoldPhase =
  | "calibrating"
  | "ready"
  | "hold_active"
  | "interrupted"
  | "recovering"
  | "end";

export type SingleLegStanceHoldConfig = {
  baselineDurationMs: number;
  holdStartConfirmMs: number;
  /** Lift offset threshold as ratio × torsoSpan (stanceY − liftY). */
  liftThresholdRatio: number;
  /** Foot-down proximity as ratio × torsoSpan. */
  footDownDeltaRatio: number;
  maxSwayBreakRatio: number;
  debounceFootDownMs: number;
  interruptionConfirmMs: number;
  recoveryConfirmMs: number;
  poseGapTolerateMs: number;
  minSaveHoldS: number;
  readinessCheckMs: number;
  minHipVisibility: number;
  minAnkleVisibility: number;
  minKneeVisibility: number;
  visibilityGood: number;
  visibilityFair: number;
};

/** CV Lab starting config — separate from future patient SLS config. */
export const LAB_SLS_HOLD_CONFIG: SingleLegStanceHoldConfig = {
  baselineDurationMs: 2_000,
  holdStartConfirmMs: 500,
  liftThresholdRatio: 0.04,
  footDownDeltaRatio: 0.025,
  maxSwayBreakRatio: 0.15,
  debounceFootDownMs: 250,
  interruptionConfirmMs: 350,
  recoveryConfirmMs: 500,
  poseGapTolerateMs: 400,
  minSaveHoldS: 3,
  readinessCheckMs: 1_500,
  minHipVisibility: 0.35,
  minAnkleVisibility: 0.3,
  minKneeVisibility: 0.25,
  visibilityGood: 0.6,
  visibilityFair: 0.35,
};

const LAB_SLS_READINESS_CONFIG: SitToStandCvConfig = {
  ...DEFAULT_STS_CONFIG,
  minHipVisibility: LAB_SLS_HOLD_CONFIG.minHipVisibility,
  visibilityGood: LAB_SLS_HOLD_CONFIG.visibilityGood,
  visibilityFair: LAB_SLS_HOLD_CONFIG.visibilityFair,
};

export type SingleLegStanceDerivedMetrics = {
  exerciseId: "single-leg-stance";
  repCount: 0;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
  interruptionCount: number;
  recoveryCount: number;
  longestContinuousHoldS: number;
};

export type SingleLegStanceDetectorSnapshot = {
  trackingStatus: "idle" | "detecting" | "pose-found" | "pose-lost";
  trackingQuality: SitToStandTrackingQuality | null;
  poseReadiness: PoseReadiness;
  bodyFramingState: BodyFramingState;
  holdPhase: SlsHoldPhase;
  stanceLeg: StanceLeg;
  accumulatedHoldMs: number;
  longestContinuousHoldMs: number;
  interruptionCount: number;
  recoveryCount: number;
  movementDetected: boolean;
  sessionSeconds: number;
  framesWithPose: number;
  framesTotal: number;
  isBaselineCalibrating: boolean;
};

const L_ANKLE = 27;
const R_ANKLE = 28;
const L_KNEE = 25;
const R_KNEE = 26;

function anklesMeetMinVisibility(landmarks: PoseLandmark[], min: number): boolean {
  return (
    (landmarks[L_ANKLE]?.visibility ?? 0) >= min &&
    (landmarks[R_ANKLE]?.visibility ?? 0) >= min
  );
}

function kneesMeetMinVisibility(landmarks: PoseLandmark[], min: number): boolean {
  return (
    (landmarks[L_KNEE]?.visibility ?? 0) >= min &&
    (landmarks[R_KNEE]?.visibility ?? 0) >= min
  );
}

function mapFramingToPoseReadiness(
  framingState: BodyFramingState,
  quality: SitToStandTrackingQuality,
): PoseReadiness {
  if (framingState === "good_distance") return "ready";
  if (framingState === "low_visibility" && quality === "fair") return "partial";
  return "not_ready";
}

function evaluateSlsFrameReadiness(
  landmarks: PoseLandmark[],
  trackingQuality: SitToStandTrackingQuality,
): Exclude<PoseReadiness, "checking"> {
  if (
    !hipsMeetMinVisibility(landmarks, LAB_SLS_HOLD_CONFIG.minHipVisibility) ||
    !anklesMeetMinVisibility(landmarks, LAB_SLS_HOLD_CONFIG.minAnkleVisibility) ||
    !kneesMeetMinVisibility(landmarks, LAB_SLS_HOLD_CONFIG.minKneeVisibility) ||
    trackingQuality === "poor"
  ) {
    return "not_ready";
  }

  const base = evaluatePoseFrameReadiness(
    landmarks,
    trackingQuality,
    LAB_SLS_READINESS_CONFIG,
  );
  if (base === "not_ready") return "not_ready";
  return base;
}

function shoulderWidth(landmarks: PoseLandmark[]): number | null {
  const ls = landmarks[11];
  const rs = landmarks[12];
  if (!ls || !rs) return null;
  return Math.abs(rs.x - ls.x);
}

function hipMidX(landmarks: PoseLandmark[]): number | null {
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (!lh || !rh) return null;
  return (lh.x + rh.x) / 2;
}

export type SingleLegStanceHoldDetectorOptions = {
  stanceLeg?: StanceLeg;
  /** When false, skip readiness/framing gates (unit-test fast path). */
  useReadinessGates?: boolean;
};

/**
 * Frame-driven single-leg stance hold engine for unit tests and future CV Lab wiring.
 * Bilateral baseline → lift detection → hold accumulate with interruption/recovery.
 */
export class SingleLegStanceHoldDetector {
  private readonly config: SingleLegStanceHoldConfig;
  private readonly stanceLeg: StanceLeg;
  private readonly useReadinessGates: boolean;

  private holdPhase: SlsHoldPhase = "calibrating";
  private trackingStatus: SingleLegStanceDetectorSnapshot["trackingStatus"] = "idle";
  private trackingQuality: SitToStandTrackingQuality | null = null;
  private poseReadiness: PoseReadiness = "checking";
  private bodyFramingState: BodyFramingState = "checking";

  private sessionStartMs: number | null = null;
  private lastFrameMs = 0;
  private baselineWindowEndMs = 0;
  private isBaselineCalibrating = false;

  private accumulatedHoldMs = 0;
  private currentSegmentMs = 0;
  private longestContinuousHoldMs = 0;
  private interruptionCount = 0;
  private recoveryCount = 0;

  private liftConfirmStartMs: number | null = null;
  private footDownStartMs: number | null = null;
  private recoveryConfirmStartMs: number | null = null;
  private poseLostStartMs: number | null = null;
  private baselineHipMidX: number | null = null;

  private framesWithPose = 0;
  private framesTotal = 0;
  private hipVisSamples: number[] = [];
  private labelCounts: VisibilityLabelCounts = emptyVisibilityLabelCounts();

  constructor(
    config: SingleLegStanceHoldConfig = LAB_SLS_HOLD_CONFIG,
    options: SingleLegStanceHoldDetectorOptions = {},
  ) {
    this.config = config;
    this.stanceLeg = options.stanceLeg ?? "left";
    this.useReadinessGates = options.useReadinessGates ?? true;
  }

  get accumulatedHoldSeconds(): number {
    return Math.round(this.accumulatedHoldMs / 1_000);
  }

  reset(): void {
    this.holdPhase = "calibrating";
    this.trackingStatus = "idle";
    this.trackingQuality = null;
    this.poseReadiness = "checking";
    this.bodyFramingState = "checking";
    this.sessionStartMs = null;
    this.lastFrameMs = 0;
    this.baselineWindowEndMs = 0;
    this.isBaselineCalibrating = false;
    this.accumulatedHoldMs = 0;
    this.currentSegmentMs = 0;
    this.longestContinuousHoldMs = 0;
    this.interruptionCount = 0;
    this.recoveryCount = 0;
    this.liftConfirmStartMs = null;
    this.footDownStartMs = null;
    this.recoveryConfirmStartMs = null;
    this.poseLostStartMs = null;
    this.baselineHipMidX = null;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.hipVisSamples = [];
    this.labelCounts = emptyVisibilityLabelCounts();
  }

  startSession(nowMs: number): void {
    this.sessionStartMs = nowMs;
    this.lastFrameMs = nowMs;
    this.trackingStatus = "detecting";
    if (this.useReadinessGates) {
      this.poseReadiness = "checking";
      this.bodyFramingState = "checking";
    } else {
      this.poseReadiness = "ready";
      this.bodyFramingState = "good_distance";
      this.baselineWindowEndMs = nowMs + this.config.baselineDurationMs;
      this.isBaselineCalibrating = true;
    }
  }

  endSession(): void {
    this.flushHoldSegment();
    this.holdPhase = "end";
    this.trackingStatus = "idle";
  }

  driveFrame(landmarks: PoseLandmark[] | null, nowMs: number): void {
    if (this.sessionStartMs === null) {
      this.startSession(nowMs);
    }

    this.framesTotal++;
    const deltaMs = this.lastFrameMs > 0 ? Math.max(0, nowMs - this.lastFrameMs) : 0;
    this.lastFrameMs = nowMs;

    if (!landmarks || landmarks.length < 29) {
      this.handlePoseLost(nowMs, deltaMs);
      return;
    }

    this.poseLostStartMs = null;
    this.trackingStatus = "pose-found";
    this.framesWithPose++;

    const hipVisSum = (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
    this.hipVisSamples.push(hipVisSum);
    const frameLabel = evaluateTrackingQualityFromHipVisSum(
      hipVisSum,
      this.config.visibilityGood,
      this.config.visibilityFair,
    );
    this.labelCounts[frameLabel]++;

    this.trackingQuality = evaluateHipTrackingQuality(
      landmarks,
      this.config.visibilityGood,
      this.config.visibilityFair,
    );

    this.updateReadiness(nowMs, landmarks);

    const torsoSpan = computeTorsoSpan(landmarks) ?? 0.25;
    const liftOffset = this.computeLiftOffset(landmarks);
    const liftThreshold = this.config.liftThresholdRatio * torsoSpan;
    const footDownDelta = this.config.footDownDeltaRatio * torsoSpan;
    const isLifted = liftOffset > liftThreshold;
    const isFootDown = liftOffset <= footDownDelta;
    const readinessOk = this.isHoldReadinessOk();

    this.tickBaseline(nowMs, readinessOk, landmarks);

    if (this.holdPhase === "hold_active" && readinessOk) {
      this.accumulateHold(deltaMs);
    }

    switch (this.holdPhase) {
      case "calibrating":
        if (this.baselineWindowEndMs > 0 && nowMs >= this.baselineWindowEndMs && readinessOk) {
          this.holdPhase = "ready";
          this.isBaselineCalibrating = false;
        }
        break;

      case "ready":
        if (!readinessOk) {
          this.liftConfirmStartMs = null;
          break;
        }
        if (isLifted) {
          if (this.liftConfirmStartMs === null) {
            this.liftConfirmStartMs = nowMs;
          } else if (nowMs - this.liftConfirmStartMs >= this.config.holdStartConfirmMs) {
            this.enterHoldActive(nowMs);
          }
        } else {
          this.liftConfirmStartMs = null;
        }
        break;

      case "hold_active":
        if (this.detectSwayBreak(landmarks, torsoSpan)) {
          this.beginInterruption(nowMs);
          break;
        }
        if (isFootDown) {
          if (this.footDownStartMs === null) {
            this.footDownStartMs = nowMs;
          } else if (nowMs - this.footDownStartMs >= this.config.interruptionConfirmMs) {
            this.beginInterruption(nowMs);
          }
        } else {
          this.footDownStartMs = null;
        }
        break;

      case "interrupted":
        if (isLifted) {
          this.holdPhase = "recovering";
          this.recoveryConfirmStartMs = nowMs;
        }
        break;

      case "recovering":
        if (!isLifted) {
          this.recoveryConfirmStartMs = null;
          this.holdPhase = "interrupted";
          break;
        }
        if (
          this.recoveryConfirmStartMs !== null &&
          nowMs - this.recoveryConfirmStartMs >= this.config.recoveryConfirmMs &&
          readinessOk
        ) {
          this.recoveryCount++;
          this.enterHoldActive(nowMs);
        }
        break;

      case "end":
        break;
    }
  }

  getSnapshot(): SingleLegStanceDetectorSnapshot {
    const sessionSeconds =
      this.sessionStartMs !== null && this.lastFrameMs >= this.sessionStartMs
        ? Math.floor((this.lastFrameMs - this.sessionStartMs) / 1_000)
        : 0;

    return {
      trackingStatus: this.trackingStatus,
      trackingQuality: this.trackingQuality,
      poseReadiness: this.poseReadiness,
      bodyFramingState: this.bodyFramingState,
      holdPhase: this.holdPhase,
      stanceLeg: this.stanceLeg,
      accumulatedHoldMs: this.accumulatedHoldMs,
      longestContinuousHoldMs: this.longestContinuousHoldMs,
      interruptionCount: this.interruptionCount,
      recoveryCount: this.recoveryCount,
      movementDetected: this.accumulatedHoldMs >= this.config.minSaveHoldS * 1_000,
      sessionSeconds,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
      isBaselineCalibrating: this.isBaselineCalibrating,
    };
  }

  getDerivedMetrics(): SingleLegStanceDerivedMetrics {
    const trackingQuality = summarizeSessionVisibility({
      hipVisSamples: this.hipVisSamples,
      labelCounts: this.labelCounts,
      framesWithPose: this.framesWithPose,
      visibilityGood: this.config.visibilityGood,
      visibilityFair: this.config.visibilityFair,
    });

    return {
      exerciseId: "single-leg-stance",
      repCount: 0,
      sessionDurationS: this.accumulatedHoldSeconds,
      trackingQuality,
      movementDetected: this.accumulatedHoldMs >= this.config.minSaveHoldS * 1_000,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
      interruptionCount: this.interruptionCount,
      recoveryCount: this.recoveryCount,
      longestContinuousHoldS: Math.round(this.longestContinuousHoldMs / 1_000),
    };
  }

  private computeLiftOffset(landmarks: PoseLandmark[]): number {
    const stanceIdx = this.stanceLeg === "left" ? L_ANKLE : R_ANKLE;
    const liftIdx = this.stanceLeg === "left" ? R_ANKLE : L_ANKLE;
    const stanceY = landmarks[stanceIdx]?.y ?? 0;
    const liftY = landmarks[liftIdx]?.y ?? 0;
    return stanceY - liftY;
  }

  private isHoldReadinessOk(): boolean {
    if (!this.useReadinessGates) return true;
    return this.poseReadiness === "ready" || this.poseReadiness === "partial";
  }

  private updateReadiness(nowMs: number, landmarks: PoseLandmark[]): void {
    if (!this.useReadinessGates) {
      this.poseReadiness = "ready";
      this.bodyFramingState = "good_distance";
      return;
    }

    const readinessCheckEndMs = (this.sessionStartMs ?? nowMs) + this.config.readinessCheckMs;
    if (nowMs < readinessCheckEndMs) {
      this.poseReadiness = "checking";
      this.bodyFramingState = "checking";
      return;
    }

    const quality = this.trackingQuality ?? "poor";
    this.bodyFramingState = evaluateBodyFraming(
      landmarks,
      STANDING_SAGITTAL_REP_FRAMING_PROFILE,
      { checking: false, trackingQuality: quality },
    );

    if (this.bodyFramingState !== "good_distance") {
      this.poseReadiness = mapFramingToPoseReadiness(this.bodyFramingState, quality);
      return;
    }

    this.poseReadiness = evaluateSlsFrameReadiness(landmarks, quality);
  }

  private tickBaseline(nowMs: number, readinessOk: boolean, landmarks: PoseLandmark[]): void {
    if (this.holdPhase !== "calibrating") return;

    if (this.baselineWindowEndMs === 0 && readinessOk) {
      this.baselineWindowEndMs = nowMs + this.config.baselineDurationMs;
      this.isBaselineCalibrating = true;
    }

    const hipX = hipMidX(landmarks);
    if (hipX !== null) {
      this.baselineHipMidX = hipX;
    }
  }

  private detectSwayBreak(landmarks: PoseLandmark[], torsoSpan: number): boolean {
    const hipX = hipMidX(landmarks);
    const sw = shoulderWidth(landmarks);
    if (hipX === null || sw === null || this.baselineHipMidX === null) return false;
    const threshold = this.config.maxSwayBreakRatio * Math.max(sw, torsoSpan);
    return Math.abs(hipX - this.baselineHipMidX) > threshold;
  }

  private enterHoldActive(nowMs: number): void {
    this.holdPhase = "hold_active";
    this.currentSegmentMs = 0;
    this.liftConfirmStartMs = null;
    this.footDownStartMs = null;
    this.recoveryConfirmStartMs = null;
    this.lastFrameMs = nowMs;
  }

  private beginInterruption(nowMs: number): void {
    if (this.holdPhase !== "hold_active") return;
    this.flushHoldSegment();
    this.holdPhase = "interrupted";
    this.interruptionCount++;
    this.footDownStartMs = null;
    this.recoveryConfirmStartMs = null;
    this.lastFrameMs = nowMs;
  }

  private accumulateHold(deltaMs: number): void {
    this.accumulatedHoldMs += deltaMs;
    this.currentSegmentMs += deltaMs;
    if (this.currentSegmentMs > this.longestContinuousHoldMs) {
      this.longestContinuousHoldMs = this.currentSegmentMs;
    }
  }

  private flushHoldSegment(): void {
    this.currentSegmentMs = 0;
  }

  private handlePoseLost(nowMs: number, deltaMs: number): void {
    this.trackingStatus = "pose-lost";
    this.trackingQuality = null;

    if (this.poseLostStartMs === null) {
      this.poseLostStartMs = nowMs;
    }

    const poseLostMs = nowMs - this.poseLostStartMs;
    if (this.holdPhase === "hold_active") {
      if (poseLostMs <= this.config.poseGapTolerateMs) {
        return;
      }
      this.beginInterruption(nowMs);
    } else if (this.holdPhase === "recovering" || this.holdPhase === "ready") {
      this.liftConfirmStartMs = null;
      this.recoveryConfirmStartMs = null;
    }

    if (!this.useReadinessGates) {
      this.poseReadiness = "not_ready";
    }

    void deltaMs;
  }
}

/** @internal Test helper — build landmarks for SLS hold sequences. */
export function mockSingleLegStanceLandmarks(
  stanceLeg: StanceLeg,
  options: {
    liftAnkleY?: number;
    stanceAnkleY?: number;
    hipY?: number;
    vis?: number;
    hipMidX?: number;
  } = {},
): PoseLandmark[] {
  const {
    liftAnkleY = 0.55,
    stanceAnkleY = 0.75,
    hipY = 0.45,
    vis = 0.9,
    hipMidX = 0.5,
  } = options;

  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: vis,
  }));

  landmarks[0] = { x: hipMidX, y: 0.12, visibility: vis };
  landmarks[11] = { x: hipMidX - 0.1, y: 0.25, visibility: vis };
  landmarks[12] = { x: hipMidX + 0.1, y: 0.25, visibility: vis };
  landmarks[23] = { x: hipMidX - 0.05, y: hipY, visibility: vis };
  landmarks[24] = { x: hipMidX + 0.05, y: hipY, visibility: vis };
  landmarks[25] = { x: hipMidX - 0.05, y: hipY + 0.12, visibility: vis };
  landmarks[26] = { x: hipMidX + 0.05, y: hipY + 0.12, visibility: vis };

  const leftAnkleY = stanceLeg === "left" ? stanceAnkleY : liftAnkleY;
  const rightAnkleY = stanceLeg === "left" ? liftAnkleY : stanceAnkleY;
  landmarks[27] = { x: hipMidX - 0.05, y: leftAnkleY, visibility: vis };
  landmarks[28] = { x: hipMidX + 0.05, y: rightAnkleY, visibility: vis };

  return landmarks;
}
