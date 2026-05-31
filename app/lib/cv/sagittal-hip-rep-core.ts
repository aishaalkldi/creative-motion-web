/**
 * Shared sagittal hip-Y rep FSM for rise (Sit-to-Stand) and drop (Mini Squat) polarities.
 * Pure logic — no MediaPipe, no persistence.
 */

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
  };
}

export function resetSagittalHipRepBaseline(state: SagittalHipRepState): void {
  state.baselineSamples = [];
  state.baselineHipY = null;
  state.baselineWindowEndMs = 0;
  state.lastRepAtMs = 0;
  state.isBaselineCalibrating = false;
  state.repPhase = "rest";
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
}): void {
  const { state, polarity, hipY, config } = input;

  if (polarity === "rise") {
    if (hipY < config.peakThreshold && state.repPhase === "rest") {
      state.repPhase = "peak";
      state.repCount += 1;
    } else if (hipY > config.restThreshold && state.repPhase === "peak") {
      state.repPhase = "rest";
    }
    return;
  }

  if (hipY > config.peakThreshold && state.repPhase === "rest") {
    state.repPhase = "peak";
  } else if (hipY < config.restThreshold && state.repPhase === "peak") {
    state.repPhase = "rest";
    state.repCount += 1;
  }
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
}): void {
  const { state, polarity, hipY, nowMs, torsoSpan, config, canCollectBaseline, canIncrementReps } =
    input;

  maybeFinalizeBaseline(state, config, nowMs);

  if (state.baselineHipY === null) {
    if (canCollectBaseline) {
      state.baselineSamples.push(hipY);
    }
    return;
  }

  if (!canIncrementReps(state)) return;

  const { primaryDelta, resetDelta } = resolveBaselineDeltas(config, torsoSpan);
  const { enterPeak, returnRest } = resolveBaselineThresholds(
    polarity,
    state.baselineHipY,
    primaryDelta,
    resetDelta,
  );
  const minMs = config.minMsBetweenReps;

  if (polarity === "rise") {
    if (hipY < enterPeak && state.repPhase === "rest" && nowMs - state.lastRepAtMs >= minMs) {
      state.repPhase = "peak";
      state.repCount += 1;
      state.lastRepAtMs = nowMs;
    } else if (hipY > returnRest && state.repPhase === "peak") {
      state.repPhase = "rest";
    }
    return;
  }

  if (hipY > enterPeak && state.repPhase === "rest") {
    state.repPhase = "peak";
  } else if (
    hipY < returnRest &&
    state.repPhase === "peak" &&
    nowMs - state.lastRepAtMs >= minMs
  ) {
    state.repPhase = "rest";
    state.repCount += 1;
    state.lastRepAtMs = nowMs;
  }
}

/** Map STS standPhase ("up"|"down") to shared rep phase for rise polarity. */
export function standPhaseToRepPhase(standPhase: "up" | "down"): SagittalHipRepPhase {
  return standPhase === "up" ? "peak" : "rest";
}

export function repPhaseToStandPhase(repPhase: SagittalHipRepPhase): "up" | "down" {
  return repPhase === "peak" ? "up" : "down";
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
