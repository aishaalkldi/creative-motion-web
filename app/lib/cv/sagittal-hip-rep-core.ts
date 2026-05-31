/**
 * Shared sagittal hip-Y rep FSM for rise (Sit-to-Stand) and drop (Mini Squat) polarities.
 * Pure logic — no MediaPipe, no persistence.
 */

import {
  computeRepConfidence,
  createRepTemporalSmoothingState,
  DEFAULT_REP_TEMPORAL_SMOOTHING_CONFIG,
  nextStreak,
  pushSmoothedSignal,
  repTransitionAllowed,
  resetRepTemporalSmoothingState,
  signalStability,
  thresholdMarginRatio,
  type RepTemporalSmoothingConfig,
  type RepTemporalSmoothingState,
} from "@/app/lib/cv/rep-temporal-smoothing";

export type { RepConfidenceLevel } from "@/app/lib/cv/rep-temporal-smoothing";

export type PoseLandmark = { x: number; y: number; visibility?: number };

export type SagittalHipRepPolarity = "rise" | "drop";

/** rest = STS seated / mini-squat standing; peak = STS standing / mini-squat descended */
export type SagittalHipRepPhase = "rest" | "peak";

export type SagittalHipRepBaselineConfig = {
  baselineDurationMs: number;
  fallbackBaselineHipY: number;
  baselineScaleByTorso: boolean;
  /** Rise: stand delta; Drop: squat-down delta */
  baselinePrimaryDelta: number;
  /** Rise: seated reset delta; Drop: return-to-stand delta */
  baselineResetDelta: number;
  baselinePrimaryDeltaRatio: number;
  baselineResetDeltaRatio: number;
  baselinePrimaryDeltaMin: number;
  baselineResetDeltaMin: number;
  minMsBetweenReps: number;
};

export type SagittalHipRepAbsoluteConfig = {
  peakThreshold: number;
  restThreshold: number;
};

export type SagittalHipRepState = {
  baselineSamples: number[];
  baselineHipY: number | null;
  baselineWindowEndMs: number;
  lastRepAtMs: number;
  isBaselineCalibrating: boolean;
  repCount: number;
  repPhase: SagittalHipRepPhase;
  temporal: RepTemporalSmoothingState;
};

export function createSagittalHipRepState(): SagittalHipRepState {
  return {
    baselineSamples: [],
    baselineHipY: null,
    baselineWindowEndMs: 0,
    lastRepAtMs: 0,
    isBaselineCalibrating: false,
    repCount: 0,
    repPhase: "rest",
    temporal: createRepTemporalSmoothingState(),
  };
}

export function resetSagittalHipRepBaseline(state: SagittalHipRepState): void {
  state.baselineSamples = [];
  state.baselineHipY = null;
  state.baselineWindowEndMs = 0;
  state.lastRepAtMs = 0;
  state.isBaselineCalibrating = false;
  state.repPhase = "rest";
  resetRepTemporalSmoothingState(state.temporal);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function computeTorsoSpan(landmarks: PoseLandmark[]): number | null {
  const ls = landmarks[11];
  const rs = landmarks[12];
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (!ls || !rs || !lh || !rh) return null;

  const shoulderVis = (ls.visibility ?? 0) + (rs.visibility ?? 0);
  const hipVis = (lh.visibility ?? 0) + (rh.visibility ?? 0);
  if (shoulderVis < 0.6 || hipVis < 0.6) return null;

  const shoulderY = (ls.y + rs.y) / 2;
  const hipY = (lh.y + rh.y) / 2;
  const span = Math.abs(hipY - shoulderY);
  if (span < 0.08 || span > 0.9) return null;
  return span;
}

export function computeHipMidY(landmarks: PoseLandmark[]): number {
  return ((landmarks[23]?.y ?? 0) + (landmarks[24]?.y ?? 0)) / 2;
}

export function hipsMeetMinVisibility(landmarks: PoseLandmark[], minPerHip: number): boolean {
  const left = landmarks[23]?.visibility ?? 0;
  const right = landmarks[24]?.visibility ?? 0;
  return left >= minPerHip && right >= minPerHip;
}

export function resolveBaselineDeltas(
  config: SagittalHipRepBaselineConfig,
  torsoSpan: number | null,
): { primaryDelta: number; resetDelta: number } {
  const fixedPrimary = config.baselinePrimaryDelta;
  const fixedReset = config.baselineResetDelta;

  if (!config.baselineScaleByTorso || torsoSpan === null) {
    return { primaryDelta: fixedPrimary, resetDelta: fixedReset };
  }

  const scaledPrimary = config.baselinePrimaryDeltaRatio * torsoSpan;
  const scaledReset = config.baselineResetDeltaRatio * torsoSpan;

  return {
    primaryDelta: Math.max(
      config.baselinePrimaryDeltaMin,
      Math.min(fixedPrimary, scaledPrimary),
    ),
    resetDelta: Math.max(config.baselineResetDeltaMin, Math.min(fixedReset, scaledReset)),
  };
}

export function maybeFinalizeBaseline(
  state: SagittalHipRepState,
  config: SagittalHipRepBaselineConfig,
  nowMs: number,
): void {
  if (state.baselineHipY !== null) return;
  if (state.baselineWindowEndMs <= 0 || nowMs < state.baselineWindowEndMs) return;

  const medianY = median(state.baselineSamples);
  state.baselineHipY = medianY ?? config.fallbackBaselineHipY;
  state.isBaselineCalibrating = false;
}

/** Use the stronger of raw vs smoothed margin so lagging medians do not block clear returns. */
export function resolveRepThresholdMargin(
  polarity: SagittalHipRepPolarity,
  raw: number,
  smoothed: number,
  enterPeak: number,
  returnRest: number,
  primaryDelta: number,
): number {
  return Math.max(
    thresholdMarginRatio(polarity, smoothed, enterPeak, returnRest, primaryDelta),
    thresholdMarginRatio(polarity, raw, enterPeak, returnRest, primaryDelta),
  );
}

export function crossesEnterPeakThreshold(
  polarity: SagittalHipRepPolarity,
  raw: number,
  smoothed: number,
  enterPeak: number,
): boolean {
  if (polarity === "rise") {
    return smoothed < enterPeak || raw < enterPeak;
  }
  return smoothed > enterPeak || raw > enterPeak;
}

export function crossesReturnRestThreshold(
  polarity: SagittalHipRepPolarity,
  raw: number,
  smoothed: number,
  returnRest: number,
): boolean {
  if (polarity === "rise") {
    return smoothed > returnRest || raw > returnRest;
  }
  return smoothed < returnRest || raw < returnRest;
}

export function resolveBaselineThresholds(
  polarity: SagittalHipRepPolarity,
  baselineHipY: number,
  primaryDelta: number,
  resetDelta: number,
): { enterPeak: number; returnRest: number } {
  if (polarity === "rise") {
    return {
      enterPeak: baselineHipY - primaryDelta,
      returnRest: baselineHipY - resetDelta,
    };
  }
  return {
    enterPeak: baselineHipY + primaryDelta,
    returnRest: baselineHipY + resetDelta,
  };
}

export function tickSagittalHipRepAbsolute(input: {
  state: SagittalHipRepState;
  polarity: SagittalHipRepPolarity;
  hipY: number;
  config: SagittalHipRepAbsoluteConfig;
  smoothingConfig?: RepTemporalSmoothingConfig;
}): void {
  const { state, polarity, hipY, config, smoothingConfig = DEFAULT_REP_TEMPORAL_SMOOTHING_CONFIG } =
    input;
  const phaseBefore = state.repPhase;
  const smoothed = pushSmoothedSignal(state.temporal, hipY, smoothingConfig.windowSize);
  const primaryDelta = Math.abs(config.restThreshold - config.peakThreshold);
  const stability = signalStability(state.temporal.signalBuffer);
  const margin = resolveRepThresholdMargin(
    polarity,
    hipY,
    smoothed,
    config.peakThreshold,
    config.restThreshold,
    primaryDelta,
  );
  state.temporal.repConfidence = computeRepConfidence(stability, margin);

  if (polarity === "rise") {
    const enterCondition =
      crossesEnterPeakThreshold(polarity, hipY, smoothed, config.peakThreshold) &&
      state.repPhase === "rest";
    state.temporal.enterPeakStreak = nextStreak(state.temporal.enterPeakStreak, enterCondition);
    if (
      enterCondition &&
      repTransitionAllowed(state.temporal.enterPeakStreak, state.temporal.repConfidence, margin)
    ) {
      state.repPhase = "peak";
      state.repCount += 1;
      state.temporal.enterPeakStreak = 0;
    } else if (
      crossesReturnRestThreshold(polarity, hipY, smoothed, config.restThreshold) &&
      state.repPhase === "peak"
    ) {
      state.repPhase = "rest";
      state.temporal.enterPeakStreak = 0;
    }
    if (state.repPhase !== phaseBefore) {
      state.temporal.signalBuffer = [];
      state.temporal.enterPeakStreak = 0;
      state.temporal.returnRestStreak = 0;
    }
    state.temporal.lastRepPhase = state.repPhase;
    return;
  }

  const enterCondition = smoothed > config.peakThreshold && state.repPhase === "rest";
  state.temporal.enterPeakStreak = nextStreak(state.temporal.enterPeakStreak, enterCondition);
  if (enterCondition) {
    state.repPhase = "peak";
    state.temporal.enterPeakStreak = 0;
  }

  const returnCondition =
    crossesReturnRestThreshold(polarity, hipY, smoothed, config.restThreshold) &&
    state.repPhase === "peak";
  state.temporal.returnRestStreak = nextStreak(state.temporal.returnRestStreak, returnCondition);
  if (
    returnCondition &&
    repTransitionAllowed(state.temporal.returnRestStreak, state.temporal.repConfidence, margin)
  ) {
    state.repPhase = "rest";
    state.repCount += 1;
    state.temporal.returnRestStreak = 0;
  }
  if (state.repPhase !== phaseBefore) {
    state.temporal.signalBuffer = [];
    state.temporal.enterPeakStreak = 0;
    state.temporal.returnRestStreak = 0;
  }
  state.temporal.lastRepPhase = state.repPhase;
}

export function tickSagittalHipRepBaseline(input: {
  state: SagittalHipRepState;
  polarity: SagittalHipRepPolarity;
  hipY: number;
  nowMs: number;
  torsoSpan: number | null;
  config: SagittalHipRepBaselineConfig;
  canCollectBaseline: boolean;
  /** Evaluated after baseline finalize — receives current state. */
  canIncrementReps: (state: SagittalHipRepState) => boolean;
  smoothingConfig?: RepTemporalSmoothingConfig;
}): void {
  const {
    state,
    polarity,
    hipY,
    nowMs,
    torsoSpan,
    config,
    canCollectBaseline,
    canIncrementReps,
    smoothingConfig = DEFAULT_REP_TEMPORAL_SMOOTHING_CONFIG,
  } = input;

  maybeFinalizeBaseline(state, config, nowMs);

  if (state.baselineHipY === null) {
    if (canCollectBaseline) {
      state.baselineSamples.push(hipY);
    }
    return;
  }

  if (!canIncrementReps(state)) return;

  const phaseBefore = state.repPhase;
  const smoothed = pushSmoothedSignal(state.temporal, hipY, smoothingConfig.windowSize);
  const { primaryDelta, resetDelta } = resolveBaselineDeltas(config, torsoSpan);
  const { enterPeak, returnRest } = resolveBaselineThresholds(
    polarity,
    state.baselineHipY,
    primaryDelta,
    resetDelta,
  );
  const minMs = config.minMsBetweenReps;
  const stability = signalStability(state.temporal.signalBuffer);
  const margin = resolveRepThresholdMargin(
    polarity,
    hipY,
    smoothed,
    enterPeak,
    returnRest,
    primaryDelta,
  );
  state.temporal.repConfidence = computeRepConfidence(stability, margin);

  if (polarity === "rise") {
    const enterCondition =
      crossesEnterPeakThreshold(polarity, hipY, smoothed, enterPeak) &&
      state.repPhase === "rest" &&
      nowMs - state.lastRepAtMs >= minMs;
    state.temporal.enterPeakStreak = nextStreak(state.temporal.enterPeakStreak, enterCondition);
    if (
      enterCondition &&
      repTransitionAllowed(state.temporal.enterPeakStreak, state.temporal.repConfidence, margin)
    ) {
      state.repPhase = "peak";
      state.repCount += 1;
      state.lastRepAtMs = nowMs;
      state.temporal.enterPeakStreak = 0;
    } else if (
      crossesReturnRestThreshold(polarity, hipY, smoothed, returnRest) &&
      state.repPhase === "peak"
    ) {
      state.repPhase = "rest";
      state.temporal.enterPeakStreak = 0;
    }
    if (state.repPhase !== phaseBefore) {
      state.temporal.signalBuffer = [];
      state.temporal.enterPeakStreak = 0;
      state.temporal.returnRestStreak = 0;
    }
    state.temporal.lastRepPhase = state.repPhase;
    return;
  }

  const enterCondition =
    crossesEnterPeakThreshold(polarity, hipY, smoothed, enterPeak) && state.repPhase === "rest";
  state.temporal.enterPeakStreak = nextStreak(state.temporal.enterPeakStreak, enterCondition);
  if (enterCondition) {
    state.repPhase = "peak";
    state.temporal.enterPeakStreak = 0;
  }

  const returnCondition =
    crossesReturnRestThreshold(polarity, hipY, smoothed, returnRest) &&
    state.repPhase === "peak" &&
    nowMs - state.lastRepAtMs >= minMs;
  state.temporal.returnRestStreak = nextStreak(state.temporal.returnRestStreak, returnCondition);
  if (
    returnCondition &&
    repTransitionAllowed(state.temporal.returnRestStreak, state.temporal.repConfidence, margin)
  ) {
    state.repPhase = "rest";
    state.repCount += 1;
    state.lastRepAtMs = nowMs;
    state.temporal.returnRestStreak = 0;
  }
  if (state.repPhase !== phaseBefore) {
    state.temporal.signalBuffer = [];
    state.temporal.enterPeakStreak = 0;
    state.temporal.returnRestStreak = 0;
  }
  state.temporal.lastRepPhase = state.repPhase;
}

/** Map STS standPhase ("up"|"down") to shared rep phase for rise polarity. */
export function standPhaseToRepPhase(standPhase: "up" | "down"): SagittalHipRepPhase {
  return standPhase === "up" ? "peak" : "rest";
}

export function repPhaseToStandPhase(repPhase: SagittalHipRepPhase): "up" | "down" {
  return repPhase === "peak" ? "up" : "down";
}

export function baselineConfigFromMiniSquat(config: {
  baselineDurationMs?: number;
  fallbackStandingHipY?: number;
  fallbackSeatedHipY?: number;
  baselineScaleByTorso?: boolean;
  baselineStandDelta?: number;
  baselineResetDelta?: number;
  baselineStandDeltaRatio?: number;
  baselineResetDeltaRatio?: number;
  baselineStandDeltaMin?: number;
  baselineResetDeltaMin?: number;
  minMsBetweenReps?: number;
}): SagittalHipRepBaselineConfig {
  return {
    baselineDurationMs: config.baselineDurationMs ?? 3_000,
    fallbackBaselineHipY: config.fallbackStandingHipY ?? config.fallbackSeatedHipY ?? 0.45,
    baselineScaleByTorso: config.baselineScaleByTorso ?? true,
    baselinePrimaryDelta: config.baselineStandDelta ?? 0.06,
    baselineResetDelta: config.baselineResetDelta ?? 0.03,
    baselinePrimaryDeltaRatio: config.baselineStandDeltaRatio ?? 0.11,
    baselineResetDeltaRatio: config.baselineResetDeltaRatio ?? 0.055,
    baselinePrimaryDeltaMin: config.baselineStandDeltaMin ?? 0.025,
    baselineResetDeltaMin: config.baselineResetDeltaMin ?? 0.015,
    minMsBetweenReps: config.minMsBetweenReps ?? 1_000,
  };
}

export function baselineConfigFromSts(config: {
  baselineDurationMs?: number;
  fallbackSeatedHipY?: number;
  baselineScaleByTorso?: boolean;
  baselineStandDelta?: number;
  baselineResetDelta?: number;
  baselineStandDeltaRatio?: number;
  baselineResetDeltaRatio?: number;
  baselineStandDeltaMin?: number;
  baselineResetDeltaMin?: number;
  minMsBetweenReps?: number;
  hipUpThreshold?: number;
  hipDownThreshold?: number;
}): SagittalHipRepBaselineConfig {
  return {
    baselineDurationMs: config.baselineDurationMs ?? 3_000,
    fallbackBaselineHipY: config.fallbackSeatedHipY ?? config.hipDownThreshold ?? 0.58,
    baselineScaleByTorso: config.baselineScaleByTorso ?? false,
    baselinePrimaryDelta: config.baselineStandDelta ?? 0.09,
    baselineResetDelta: config.baselineResetDelta ?? 0.04,
    baselinePrimaryDeltaRatio: config.baselineStandDeltaRatio ?? 0.18,
    baselineResetDeltaRatio: config.baselineResetDeltaRatio ?? 0.08,
    baselinePrimaryDeltaMin: config.baselineStandDeltaMin ?? 0.035,
    baselineResetDeltaMin: config.baselineResetDeltaMin ?? 0.02,
    minMsBetweenReps: config.minMsBetweenReps ?? 900,
  };
}
