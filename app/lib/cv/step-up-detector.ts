/**
 * CV Lab / internal Step Up rep detector (foundation only).
 * Hip mid-Y rise polarity — step onto platform lowers hip Y relative to baseline.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import { evaluateBodyFraming, type BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import { STANDING_SAGITTAL_REP_FRAMING_PROFILE } from "@/app/lib/cv/body-framing-profiles";
import {
  emptyVisibilityLabelCounts,
  evaluateTrackingQualityFromHipVisSum,
  summarizeSessionVisibility,
  type VisibilityLabelCounts,
} from "@/app/lib/cv/session-visibility-summary";
import {
  computeTorsoSpan,
  createSagittalHipRepState,
  resetSagittalHipRepBaseline,
  type PoseLandmark,
  type SagittalHipRepBaselineConfig,
  type SagittalHipRepPhase,
  type SagittalHipRepState,
  tickSagittalHipRepBaseline,
} from "@/app/lib/cv/sagittal-hip-rep-core";

export type StepUpDerivedMetrics = {
  exerciseId: "step-up";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type StepUpRepConfig = SagittalHipRepBaselineConfig & {
  minHipVisibility: number;
  visibilityGood: number;
  visibilityFair: number;
  minSaveDurationS: number;
};

/** CV Lab starting config — separate from PATIENT_STEP_UP_REP_CONFIG. */
export const LAB_STEP_UP_REP_CONFIG: StepUpRepConfig = {
  baselineDurationMs: 2_500,
  fallbackBaselineHipY: 0.55,
  baselineScaleByTorso: true,
  baselinePrimaryDelta: 0.04,
  baselineResetDelta: 0.02,
  baselinePrimaryDeltaRatio: 0.12,
  baselineResetDeltaRatio: 0.06,
  baselinePrimaryDeltaMin: 0.02,
  baselineResetDeltaMin: 0.01,
  minMsBetweenReps: 700,
  minHipVisibility: 0.28,
  visibilityGood: 1.0,
  visibilityFair: 0.6,
  minSaveDurationS: 3,
};

export type StepUpRepCounterSnapshot = {
  repCount: number;
  repPhase: SagittalHipRepPhase;
  baselineHipY: number | null;
  isBaselineCalibrating: boolean;
  movementDetected: boolean;
};

export type StepUpDetectorSnapshot = StepUpRepCounterSnapshot & {
  trackingStatus: "idle" | "detecting" | "pose-found" | "pose-lost";
  trackingQuality: CvTrackingQuality | null;
  bodyFramingState: BodyFramingState;
  sessionSeconds: number;
  framesWithPose: number;
  framesTotal: number;
};

const L_HIP = 23;
const R_HIP = 24;

export function computeHipMidY(landmarks: PoseLandmark[]): number {
  return ((landmarks[L_HIP]?.y ?? 0) + (landmarks[R_HIP]?.y ?? 0)) / 2;
}

export function hipsMeetMinVisibility(landmarks: PoseLandmark[], minPerHip: number): boolean {
  const left = landmarks[L_HIP]?.visibility ?? 0;
  const right = landmarks[R_HIP]?.visibility ?? 0;
  return left >= minPerHip && right >= minPerHip;
}

export function evaluateHipTrackingQuality(
  landmarks: PoseLandmark[],
  visibilityGood: number,
  visibilityFair: number,
): CvTrackingQuality {
  const hipVis = (landmarks[L_HIP]?.visibility ?? 0) + (landmarks[R_HIP]?.visibility ?? 0);
  return evaluateTrackingQualityFromHipVisSum(hipVis, visibilityGood, visibilityFair);
}

/**
 * Frame-driven step-up rep engine (rise polarity on hip mid-Y).
 * Standing at baseline = higher hip Y; step onto platform = lower hip Y.
 */
export class StepUpRepCounter {
  private readonly config: StepUpRepConfig;
  private readonly state: SagittalHipRepState = createSagittalHipRepState();
  private movementDetected = false;

  constructor(config: StepUpRepConfig = LAB_STEP_UP_REP_CONFIG) {
    this.config = config;
  }

  get repCount(): number {
    return this.state.repCount;
  }

  get repPhase(): SagittalHipRepPhase {
    return this.state.repPhase;
  }

  get baselineHipY(): number | null {
    return this.state.baselineHipY;
  }

  set baselineHipY(value: number | null) {
    this.state.baselineHipY = value;
    if (value !== null) {
      this.state.isBaselineCalibrating = false;
    }
  }

  get isBaselineCalibrating(): boolean {
    return this.state.isBaselineCalibrating;
  }

  resetReps(): void {
    this.state.repCount = 0;
    this.state.repPhase = "rest";
    this.state.lastRepAtMs = 0;
  }

  resetBaseline(): void {
    resetSagittalHipRepBaseline(this.state);
    this.state.repCount = 0;
  }

  startBaselineWindow(nowMs: number): void {
    if (this.state.baselineHipY !== null || this.state.baselineWindowEndMs > 0) return;
    this.state.baselineWindowEndMs = nowMs + this.config.baselineDurationMs;
    this.state.isBaselineCalibrating = true;
  }

  updateRepCountFromHipY(hipY: number, nowMs: number, torsoSpan: number | null): void {
    this.movementDetected = true;
    tickSagittalHipRepBaseline({
      state: this.state,
      polarity: "rise",
      hipY,
      nowMs,
      torsoSpan,
      config: this.config,
      canCollectBaseline: this.state.baselineWindowEndMs > 0,
      canIncrementReps: (s) => s.baselineHipY !== null,
    });
  }

  driveFrame(hipY: number, nowMs: number, torsoSpan: number | null = 0.25): void {
    this.updateRepCountFromHipY(hipY, nowMs, torsoSpan);
  }

  getSnapshot(): StepUpRepCounterSnapshot {
    return {
      repCount: this.state.repCount,
      repPhase: this.state.repPhase,
      baselineHipY: this.state.baselineHipY,
      isBaselineCalibrating: this.state.isBaselineCalibrating,
      movementDetected: this.movementDetected,
    };
  }

  getDerivedMetrics(
    sessionDurationS: number,
    framesWithPose: number,
    framesTotal: number,
    trackingQuality: CvTrackingQuality = "unknown",
  ): StepUpDerivedMetrics {
    return {
      exerciseId: "step-up",
      repCount: this.state.repCount,
      sessionDurationS,
      trackingQuality,
      movementDetected: this.movementDetected && this.state.repCount > 0,
      framesWithPose,
      framesTotal,
    };
  }
}

export type StepUpDetectorOptions = {
  useBodyFraming?: boolean;
};

/**
 * Landmark-driven step-up detector for CV Lab / unit tests.
 */
export class StepUpDetector {
  private readonly config: StepUpRepConfig;
  private readonly options: StepUpDetectorOptions;
  private readonly counter: StepUpRepCounter;
  private sessionStartMs: number | null = null;
  private sessionEndMs: number | null = null;
  private lastFrameMs = 0;
  private framesWithPose = 0;
  private framesTotal = 0;
  private visibilityLabelCounts: VisibilityLabelCounts = emptyVisibilityLabelCounts();
  private hipVisSamples: number[] = [];
  private lastTrackingQuality: CvTrackingQuality | null = null;
  private bodyFramingState: BodyFramingState = "checking";

  constructor(
    config: StepUpRepConfig = LAB_STEP_UP_REP_CONFIG,
    options: StepUpDetectorOptions = {},
  ) {
    this.config = config;
    this.options = options;
    this.counter = new StepUpRepCounter(config);
  }

  startSession(nowMs: number): void {
    this.sessionStartMs = nowMs;
    this.sessionEndMs = null;
    this.lastFrameMs = nowMs;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.visibilityLabelCounts = emptyVisibilityLabelCounts();
    this.hipVisSamples = [];
    this.lastTrackingQuality = null;
    this.bodyFramingState = "checking";
    this.counter.resetBaseline();
    this.counter.startBaselineWindow(nowMs);
  }

  endSession(nowMs: number): void {
    this.sessionEndMs = nowMs;
  }

  reset(): void {
    this.sessionStartMs = null;
    this.sessionEndMs = null;
    this.lastFrameMs = 0;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.visibilityLabelCounts = emptyVisibilityLabelCounts();
    this.hipVisSamples = [];
    this.lastTrackingQuality = null;
    this.bodyFramingState = "checking";
    this.counter.resetBaseline();
  }

  driveFrame(landmarks: PoseLandmark[], nowMs: number): void {
    if (this.sessionStartMs === null) {
      this.startSession(nowMs);
    }
    this.lastFrameMs = nowMs;

    this.framesTotal += 1;

    const trackingQuality = evaluateHipTrackingQuality(
      landmarks,
      this.config.visibilityGood,
      this.config.visibilityFair,
    );
    this.lastTrackingQuality = trackingQuality;

    if (this.options.useBodyFraming !== false) {
      this.bodyFramingState = evaluateBodyFraming(
        landmarks,
        STANDING_SAGITTAL_REP_FRAMING_PROFILE,
        {
          checking: false,
          trackingQuality:
            trackingQuality === "unknown" ? null : trackingQuality,
        },
      );
    }

    if (!hipsMeetMinVisibility(landmarks, this.config.minHipVisibility)) {
      return;
    }

    this.framesWithPose += 1;
    const hipVisSum =
      (landmarks[L_HIP]?.visibility ?? 0) + (landmarks[R_HIP]?.visibility ?? 0);
    this.hipVisSamples.push(hipVisSum);
    this.visibilityLabelCounts[trackingQuality === "unknown" ? "poor" : trackingQuality] += 1;

    const hipY = computeHipMidY(landmarks);
    const torsoSpan = computeTorsoSpan(landmarks);
    this.counter.driveFrame(hipY, nowMs, torsoSpan);
  }

  getSnapshot(): StepUpDetectorSnapshot {
    const sessionSeconds = this.resolveSessionSeconds();
    return {
      ...this.counter.getSnapshot(),
      trackingStatus: this.resolveTrackingStatus(),
      trackingQuality: this.lastTrackingQuality,
      bodyFramingState: this.bodyFramingState,
      sessionSeconds,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
    };
  }

  getDerivedMetrics(): StepUpDerivedMetrics {
    const sessionSeconds = this.resolveSessionSeconds();
    const trackingQuality = summarizeSessionVisibility({
      hipVisSamples: this.hipVisSamples,
      labelCounts: this.visibilityLabelCounts,
      framesWithPose: this.framesWithPose,
      visibilityGood: this.config.visibilityGood,
      visibilityFair: this.config.visibilityFair,
    });
    return this.counter.getDerivedMetrics(
      sessionSeconds,
      this.framesWithPose,
      this.framesTotal,
      trackingQuality,
    );
  }

  canSaveMetrics(): boolean {
    const metrics = this.getDerivedMetrics();
    return (
      metrics.sessionDurationS >= this.config.minSaveDurationS &&
      metrics.movementDetected &&
      metrics.repCount > 0
    );
  }

  private resolveSessionSeconds(): number {
    if (this.sessionStartMs === null) return 0;
    const endMs = this.sessionEndMs ?? this.lastFrameMs;
    if (endMs < this.sessionStartMs) return 0;
    return Math.floor((endMs - this.sessionStartMs) / 1_000);
  }

  private resolveTrackingStatus(): StepUpDetectorSnapshot["trackingStatus"] {
    if (this.sessionStartMs === null) return "idle";
    if (this.framesWithPose === 0) return "detecting";
    if (this.framesWithPose === this.framesTotal) return "pose-found";
    return "pose-lost";
  }
}

/** @internal Test helper — build landmarks with given bilateral hip Y. */
export function mockStepUpLandmarks(hipY: number, vis = 0.65): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: vis,
  }));
  landmarks[0] = { x: 0.5, y: 0.12, visibility: 0.85 };
  landmarks[11] = { x: 0.4, y: 0.28, visibility: 0.9 };
  landmarks[12] = { x: 0.6, y: 0.28, visibility: 0.9 };
  landmarks[L_HIP] = { x: 0.4, y: hipY, visibility: vis };
  landmarks[R_HIP] = { x: 0.6, y: hipY, visibility: vis };
  landmarks[25] = { x: 0.4, y: hipY + 0.13, visibility: vis };
  landmarks[26] = { x: 0.6, y: hipY + 0.13, visibility: vis };
  landmarks[27] = { x: 0.4, y: hipY + 0.27, visibility: vis };
  landmarks[28] = { x: 0.6, y: hipY + 0.27, visibility: vis };
  return landmarks;
}
