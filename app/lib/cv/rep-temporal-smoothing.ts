/**
 * Temporal smoothing + internal rep confidence for sagittal rep engines.
 * Internal only — not patient-facing, not persisted, not in save payloads.
 */

export type RepConfidenceLevel = "strong" | "moderate" | "weak";

export type RepTemporalSmoothingConfig = {
  windowSize: number;
  minFrames: Record<RepConfidenceLevel, number>;
};

export const DEFAULT_REP_TEMPORAL_SMOOTHING_CONFIG: RepTemporalSmoothingConfig = {
  windowSize: 5,
  minFrames: {
    strong: 2,
    moderate: 3,
    weak: 4,
  },
};

export type RepTemporalSmoothingState = {
  signalBuffer: number[];
  enterPeakStreak: number;
  returnRestStreak: number;
  repConfidence: RepConfidenceLevel;
  lastRepPhase: "rest" | "peak" | null;
};

export function createRepTemporalSmoothingState(): RepTemporalSmoothingState {
  return {
    signalBuffer: [],
    enterPeakStreak: 0,
    returnRestStreak: 0,
    repConfidence: "moderate",
    lastRepPhase: null,
  };
}

export function resetRepTemporalSmoothingState(state: RepTemporalSmoothingState): void {
  state.signalBuffer = [];
  state.enterPeakStreak = 0;
  state.returnRestStreak = 0;
  state.repConfidence = "moderate";
  state.lastRepPhase = null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/** Push raw signal and return median-smoothed value for threshold checks. */
export function pushSmoothedSignal(
  state: RepTemporalSmoothingState,
  rawSignal: number,
  windowSize: number,
): number {
  state.signalBuffer.push(rawSignal);
  while (state.signalBuffer.length > windowSize) {
    state.signalBuffer.shift();
  }
  return median(state.signalBuffer) ?? rawSignal;
}

/** 0–1 stability score — higher means less frame-to-frame jitter. */
export function signalStability(buffer: number[]): number {
  if (buffer.length < 2) return 0.55;
  const mean = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
  const variance =
    buffer.reduce((sum, value) => sum + (value - mean) ** 2, 0) / buffer.length;
  return Math.max(0, Math.min(1, 1 - variance / 0.003));
}

export function thresholdMarginRatio(
  polarity: "rise" | "drop",
  smoothed: number,
  enterPeak: number,
  returnRest: number,
  primaryDelta: number,
): number {
  if (primaryDelta <= 0) return 0;
  if (polarity === "rise") {
    if (smoothed < enterPeak) return (enterPeak - smoothed) / primaryDelta;
    if (smoothed > returnRest) return (smoothed - returnRest) / primaryDelta;
  } else {
    if (smoothed > enterPeak) return (smoothed - enterPeak) / primaryDelta;
    if (smoothed < returnRest) return (returnRest - smoothed) / primaryDelta;
  }
  return 0;
}

export function computeRepConfidence(
  stability: number,
  marginRatio: number,
): RepConfidenceLevel {
  const margin = Math.min(1, Math.max(0, marginRatio));
  const score = stability * 0.55 + margin * 0.45;
  if (score >= 0.62) return "strong";
  if (score >= 0.38) return "moderate";
  return "weak";
}

export function requiredConsistentFrames(
  confidence: RepConfidenceLevel,
  config: RepTemporalSmoothingConfig = DEFAULT_REP_TEMPORAL_SMOOTHING_CONFIG,
): number {
  return config.minFrames[confidence];
}

export function nextStreak(current: number, condition: boolean): number {
  return condition ? current + 1 : 0;
}

export function repTransitionAllowed(
  streak: number,
  confidence: RepConfidenceLevel,
  marginRatio = 0,
): boolean {
  if (streak >= 2 && marginRatio >= 0.2) return true;
  return streak >= requiredConsistentFrames(confidence);
}

export function getInternalRepConfidence(state: RepTemporalSmoothingState): RepConfidenceLevel {
  return state.repConfidence;
}
