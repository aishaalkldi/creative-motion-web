/**
 * CV Lab / internal Double Heel Raise rep detector (foundation only).
 * Not enabled for patient portal in HEEL-RAISE-CV-PR-1.
 *
 * Assumptions: bilateral (double) heel raise only — no single-leg variant,
 * no heel height score, no ankle strength score, no movement quality score.
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

export type HeelRaiseDerivedMetrics = {
  exerciseId: "heel-raise";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type HeelRaiseRepConfig = SagittalHipRepBaselineConfig & {
  minAnkleVisibility: number;
  visibilityGood: number;
  visibilityFair: number;
  minSaveDurationS: number;
};

/** CV Lab starting config — separate from future PATIENT_HEEL_RAISE_CONFIG. */
export const LAB_HEEL_RAISE_REP_CONFIG: HeelRaiseRepConfig = {
  baselineDurationMs: 2_500,
  fallbackBaselineHipY: 0.82,
  baselineScaleByTorso: true,
  baselinePrimaryDelta: 0.04,
  baselineResetDelta: 0.02,
  baselinePrimaryDeltaRatio: 0.12,
  baselineResetDeltaRatio: 0.06,
  baselinePrimaryDeltaMin: 0.02,
  baselineResetDeltaMin: 0.01,
  minMsBetweenReps: 700,
  minAnkleVisibility: 0.28,
  visibilityGood: 1.0,
  visibilityFair: 0.6,
  minSaveDurationS: 3,
};

export type HeelRaiseRepCounterSnapshot = {
  repCount: number;
  repPhase: SagittalHipRepPhase;
  baselineAnkleY: number | null;
  isBaselineCalibrating: boolean;
  movementDetected: boolean;
};

export type HeelRaiseDetectorSnapshot = HeelRaiseRepCounterSnapshot & {
  trackingStatus: "idle" | "detecting" | "pose-found" | "pose-lost";
  trackingQuality: CvTrackingQuality | null;
  bodyFramingState: BodyFramingState;
  sessionSeconds: number;
  framesWithPose: number;
  framesTotal: number;
};

const L_ANKLE = 27;
const R_ANKLE = 28;

export function computeAnkleMidY(landmarks: PoseLandmark[]): number {
  return ((landmarks[L_ANKLE]?.y ?? 0) + (landmarks[R_ANKLE]?.y ?? 0)) / 2;
}

export function anklesMeetMinVisibility(landmarks: PoseLandmark[], minPerAnkle: number): boolean {
  const left = landmarks[L_ANKLE]?.visibility ?? 0;
  const right = landmarks[R_ANKLE]?.visibility ?? 0;
  return left >= minPerAnkle && right >= minPerAnkle;
}

export function evaluateAnkleTrackingQuality(
  landmarks: PoseLandmark[],
  visibilityGood: number,
  visibilityFair: number,
): CvTrackingQuality {
  const ankleVis = (landmarks[L_ANKLE]?.visibility ?? 0) + (landmarks[R_ANKLE]?.visibility ?? 0);
  return evaluateTrackingQualityFromHipVisSum(ankleVis, visibilityGood, visibilityFair);
}

/**
 * Frame-driven double heel raise rep engine (rise polarity on ankle mid-Y).
 * Heels down = higher ankle Y; rise = lower ankle Y.
 */
export class HeelRaiseRepCounter {
  private readonly config: HeelRaiseRepConfig;
  private readonly state: SagittalHipRepState = createSagittalHipRepState();
  private movementDetected = false;

  constructor(config: HeelRaiseRepConfig = LAB_HEEL_RAISE_REP_CONFIG) {
    this.config = config;
  }

  get repCount(): number {
    return this.state.repCount;
  }

  get repPhase(): SagittalHipRepPhase {
    return this.state.repPhase;
  }

  get baselineAnkleY(): number | null {
    return this.state.baselineHipY;
  }

  set baselineAnkleY(value: number | null) {
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

  updateRepCountFromAnkleY(ankleY: number, nowMs: number, torsoSpan: number | null): void {
    this.movementDetected = true;
    tickSagittalHipRepBaseline({
      state: this.state,
      polarity: "rise",
      hipY: ankleY,
      nowMs,
      torsoSpan,
      config: this.config,
      canCollectBaseline: this.state.baselineWindowEndMs > 0,
      canIncrementReps: (s) => s.baselineHipY !== null,
    });
  }

  driveFrame(ankleY: number, nowMs: number, torsoSpan: number | null = 0.25): void {
    this.updateRepCountFromAnkleY(ankleY, nowMs, torsoSpan);
  }

  getSnapshot(): HeelRaiseRepCounterSnapshot {
    return {
      repCount: this.state.repCount,
      repPhase: this.state.repPhase,
      baselineAnkleY: this.state.baselineHipY,
      isBaselineCalibrating: this.state.isBaselineCalibrating,
      movementDetected: this.movementDetected,
    };
  }

  getDerivedMetrics(
    sessionDurationS: number,
    framesWithPose: number,
    framesTotal: number,
    trackingQuality: CvTrackingQuality = "unknown",
  ): HeelRaiseDerivedMetrics {
    return {
      exerciseId: "heel-raise",
      repCount: this.state.repCount,
      sessionDurationS,
      trackingQuality,
      movementDetected: this.movementDetected && this.state.repCount > 0,
      framesWithPose,
      framesTotal,
    };
  }
}

export type HeelRaiseDetectorOptions = {
  useBodyFraming?: boolean;
};

/**
 * Landmark-driven double heel raise detector for CV Lab / unit tests.
 * Reuses standing sagittal body framing and session visibility summary.
 */
export class HeelRaiseDetector {
  private readonly config: HeelRaiseRepConfig;
  private readonly options: HeelRaiseDetectorOptions;
  private readonly counter: HeelRaiseRepCounter;
  private sessionStartMs: number | null = null;
  private sessionEndMs: number | null = null;
  private lastFrameMs = 0;
  private framesWithPose = 0;
  private framesTotal = 0;
  private visibilityLabelCounts: VisibilityLabelCounts = emptyVisibilityLabelCounts();
  private ankleVisSamples: number[] = [];
  private lastTrackingQuality: CvTrackingQuality | null = null;
  private bodyFramingState: BodyFramingState = "checking";

  constructor(
    config: HeelRaiseRepConfig = LAB_HEEL_RAISE_REP_CONFIG,
    options: HeelRaiseDetectorOptions = {},
  ) {
    this.config = config;
    this.options = options;
    this.counter = new HeelRaiseRepCounter(config);
  }

  startSession(nowMs: number): void {
    this.sessionStartMs = nowMs;
    this.sessionEndMs = null;
    this.lastFrameMs = nowMs;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.visibilityLabelCounts = emptyVisibilityLabelCounts();
    this.ankleVisSamples = [];
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
    this.ankleVisSamples = [];
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

    const trackingQuality = evaluateAnkleTrackingQuality(
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

    if (!anklesMeetMinVisibility(landmarks, this.config.minAnkleVisibility)) {
      return;
    }

    this.framesWithPose += 1;
    const ankleVisSum =
      (landmarks[L_ANKLE]?.visibility ?? 0) + (landmarks[R_ANKLE]?.visibility ?? 0);
    this.ankleVisSamples.push(ankleVisSum);
    this.visibilityLabelCounts[trackingQuality === "unknown" ? "poor" : trackingQuality] += 1;

    const ankleY = computeAnkleMidY(landmarks);
    const torsoSpan = computeTorsoSpan(landmarks);
    this.counter.driveFrame(ankleY, nowMs, torsoSpan);
  }

  getSnapshot(): HeelRaiseDetectorSnapshot {
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

  getDerivedMetrics(): HeelRaiseDerivedMetrics {
    const sessionSeconds = this.resolveSessionSeconds();
    const trackingQuality = summarizeSessionVisibility({
      hipVisSamples: this.ankleVisSamples,
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

  private resolveTrackingStatus(): HeelRaiseDetectorSnapshot["trackingStatus"] {
    if (this.sessionStartMs === null) return "idle";
    if (this.framesWithPose === 0) return "detecting";
    if (this.framesWithPose === this.framesTotal) return "pose-found";
    return "pose-lost";
  }
}

/** @internal Test helper — build landmarks with given bilateral ankle Y. */
export function mockHeelRaiseLandmarks(ankleY: number, vis = 0.65): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: vis,
  }));
  landmarks[0] = { x: 0.5, y: 0.12, visibility: 0.85 };
  landmarks[11] = { x: 0.4, y: 0.28, visibility: 0.9 };
  landmarks[12] = { x: 0.6, y: 0.28, visibility: 0.9 };
  landmarks[23] = { x: 0.4, y: 0.55, visibility: vis };
  landmarks[24] = { x: 0.6, y: 0.55, visibility: vis };
  landmarks[25] = { x: 0.4, y: 0.68, visibility: vis };
  landmarks[26] = { x: 0.6, y: 0.68, visibility: vis };
  landmarks[L_ANKLE] = { x: 0.4, y: ankleY, visibility: vis };
  landmarks[R_ANKLE] = { x: 0.6, y: ankleY, visibility: vis };
  return landmarks;
}
