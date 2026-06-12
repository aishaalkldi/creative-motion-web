/**
 * PR86 — Sit-to-Stand biomechanical capture foundation.
 * Baseline calibration, adaptive thresholds, temporal FSM, attempt segmentation.
 * Camera-assisted evidence only — no diagnosis, scoring, or raw landmark storage.
 */

import {
  createRepTemporalSmoothingState,
  pushSmoothedSignal,
  resetRepTemporalSmoothingState,
  type RepTemporalSmoothingState,
} from "@/app/lib/cv/rep-temporal-smoothing";
import {
  median,
  resolveBaselineDeltas,
  resolveBaselineThresholds,
  type SagittalHipRepBaselineConfig,
} from "@/app/lib/cv/sagittal-hip-rep-core";

export const STS_CAPTURE_PHASES = [
  "calibrating",
  "seated",
  "rising",
  "standing",
  "returning",
] as const;

export type StsCapturePhase = (typeof STS_CAPTURE_PHASES)[number];

export type StsAttemptType = "complete" | "partial" | "unclear";

export type StsCalibrationQuality = "strong" | "limited" | "fallback";

export type StsAttemptConfidence = "high" | "medium" | "low";

export type StsAdaptiveThresholds = {
  seatedBaseline: number;
  riseTrigger: number;
  standConfirm: number;
  returnTrigger: number;
  seatConfirm: number;
  riseDelta: number;
  resetDelta: number;
  calibrationQuality: StsCalibrationQuality;
};

export type StsAttemptPhaseDurationsMs = {
  rising: number | null;
  standing: number | null;
  returning: number | null;
  cycle: number | null;
};

export type StsAttemptSummary = {
  attemptIndex: number;
  attemptType: StsAttemptType;
  startTimeMs: number | null;
  endTimeMs: number | null;
  risingDetected: boolean;
  standingReached: boolean;
  returningDetected: boolean;
  seatedReturnReached: boolean;
  phaseDurationsMs: StsAttemptPhaseDurationsMs;
  hipVerticalDisplacement: number | null;
  confidence: StsAttemptConfidence;
  reason: string | null;
};

export type StsBiomechanicalCaptureConfig = {
  baselineDurationMs: number;
  fallbackSeatedHipY: number;
  minMsBetweenReps: number;
  attemptTimeoutMs: number;
  minCompleteCycleMs: number;
  debounceFrames: number;
  /** Faster standing confirmation — brief peaks still count (PR87). */
  standingDebounceFrames: number;
  /** Faster return transition after standing (PR88). */
  returningDebounceFrames: number;
  /** Hip-Y band below seat confirm before entering rising. */
  risingEnterEpsilon: number;
  /** Hysteresis above stand confirm before entering returning. */
  returnHysteresis: number;
  /** Minimum gap between returnTrigger and seatConfirm (PR88). */
  returnSeatGap: number;
  /** Tolerance below seatConfirm for seated-return confirmation (PR88). */
  seatedReturnTolerance: number;
  /** Min hip descent from stand peak to infer return motion (PR88). */
  returnDescentFraction: number;
  /** Fraction of primary delta for stand confirm (lower = more tolerant). */
  standConfirmDeltaFraction: number;
  /** Min hip rise vs baseline to treat peak as standing-like when hold is brief. */
  minPeakDisplacementFraction: number;
  /** Minimum baseline samples for strong calibration. */
  minStrongBaselineSamples: number;
};

export const DEFAULT_STS_BIOMECH_CAPTURE_CONFIG: StsBiomechanicalCaptureConfig = {
  baselineDurationMs: 3_000,
  fallbackSeatedHipY: 0.55,
  minMsBetweenReps: 800,
  attemptTimeoutMs: 15_000,
  minCompleteCycleMs: 650,
  debounceFrames: 3,
  standingDebounceFrames: 2,
  returningDebounceFrames: 2,
  risingEnterEpsilon: 0.01,
  returnHysteresis: 0.012,
  returnSeatGap: 0.008,
  seatedReturnTolerance: 0.008,
  returnDescentFraction: 0.4,
  standConfirmDeltaFraction: 0.72,
  minPeakDisplacementFraction: 0.98,
  minStrongBaselineSamples: 12,
};

/** Patient portal — home-camera tolerant tuning (PR87). */
export const PATIENT_STS_BIOMECH_CAPTURE_CONFIG: StsBiomechanicalCaptureConfig = {
  ...DEFAULT_STS_BIOMECH_CAPTURE_CONFIG,
};

export type StsBiomechanicalCaptureState = {
  phase: StsCapturePhase;
  baselineSamples: number[];
  baselineWindowEndMs: number;
  seatedBaseline: number | null;
  calibrationQuality: StsCalibrationQuality | null;
  thresholds: StsAdaptiveThresholds | null;
  repCount: number;
  lastRepCompleteMs: number;
  temporal: RepTemporalSmoothingState;
  risingStreak: number;
  standingStreak: number;
  returningStreak: number;
  seatedStreak: number;
  isBaselineCalibrating: boolean;
  attempts: StsAttemptSummary[];
};

export type StsBiomechanicalCaptureTickInput = {
  hipY: number;
  nowMs: number;
  torsoSpan: number | null;
  canCollectBaseline: boolean;
  canCount: boolean;
  posePresent: boolean;
  hipVisibilitySum: number;
};

type ActiveAttempt = {
  attemptIndex: number;
  startTimeMs: number;
  risingDetected: boolean;
  standingReached: boolean;
  returningDetected: boolean;
  seatedReturnReached: boolean;
  risingStartMs: number | null;
  standingStartMs: number | null;
  returningStartMs: number | null;
  seatedBaselineAtStart: number;
  minHipY: number;
  maxHipY: number;
  visibilityMin: number;
  visibilitySum: number;
  frameCount: number;
};

export function createStsBiomechanicalCaptureState(): StsBiomechanicalCaptureState {
  return {
    phase: "calibrating",
    baselineSamples: [],
    baselineWindowEndMs: 0,
    seatedBaseline: null,
    calibrationQuality: null,
    thresholds: null,
    repCount: 0,
    lastRepCompleteMs: 0,
    temporal: createRepTemporalSmoothingState(),
    risingStreak: 0,
    standingStreak: 0,
    returningStreak: 0,
    seatedStreak: 0,
    isBaselineCalibrating: false,
    attempts: [],
  };
}

export function resetStsBiomechanicalCaptureState(state: StsBiomechanicalCaptureState): void {
  state.phase = "calibrating";
  state.baselineSamples = [];
  state.baselineWindowEndMs = 0;
  state.seatedBaseline = null;
  state.calibrationQuality = null;
  state.thresholds = null;
  state.repCount = 0;
  state.lastRepCompleteMs = 0;
  resetRepTemporalSmoothingState(state.temporal);
  state.risingStreak = 0;
  state.standingStreak = 0;
  state.returningStreak = 0;
  state.seatedStreak = 0;
  state.isBaselineCalibrating = false;
  state.attempts = [];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function nextStreak(current: number, condition: boolean): number {
  return condition ? current + 1 : 0;
}

/** Robust seated baseline — trimmed median tolerates noisy frames. */
export function computeRobustSeatedBaseline(
  samples: readonly number[],
  fallback: number,
): { baseline: number; quality: StsCalibrationQuality } {
  if (samples.length === 0) {
    return { baseline: fallback, quality: "fallback" };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  let trimmed = sorted;
  if (sorted.length >= 10) {
    const trim = Math.floor(sorted.length * 0.1);
    trimmed = sorted.slice(trim, sorted.length - trim);
  }

  const baseline = median(trimmed) ?? median(sorted) ?? fallback;
  const q1 = trimmed[Math.floor(trimmed.length * 0.25)] ?? baseline;
  const q3 = trimmed[Math.floor(trimmed.length * 0.75)] ?? baseline;
  const iqr = q3 - q1;

  if (samples.length >= DEFAULT_STS_BIOMECH_CAPTURE_CONFIG.minStrongBaselineSamples && iqr <= 0.025) {
    return { baseline: round3(baseline), quality: "strong" };
  }
  if (samples.length >= 5) {
    return { baseline: round3(baseline), quality: "limited" };
  }
  return { baseline: round3(baseline), quality: "fallback" };
}

export function resolveStsAdaptiveThresholds(
  seatedBaseline: number,
  baselineConfig: SagittalHipRepBaselineConfig,
  torsoSpan: number | null,
  calibrationQuality: StsCalibrationQuality,
  captureConfig: StsBiomechanicalCaptureConfig = DEFAULT_STS_BIOMECH_CAPTURE_CONFIG,
): StsAdaptiveThresholds {
  const { primaryDelta, resetDelta } = resolveBaselineDeltas(baselineConfig, torsoSpan);
  const { enterPeak, returnRest } = resolveBaselineThresholds(
    "rise",
    seatedBaseline,
    primaryDelta,
    resetDelta,
  );

  const qualityScale =
    calibrationQuality === "strong" ? 1 : calibrationQuality === "limited" ? 0.97 : 0.94;
  const scaledPrimary =
    primaryDelta *
    qualityScale *
    captureConfig.standConfirmDeltaFraction;
  const standConfirm = seatedBaseline - scaledPrimary;
  const seatConfirm = seatedBaseline - resetDelta;
  const orderedSeatConfirm = Math.max(seatConfirm, standConfirm + captureConfig.returnSeatGap);
  const standToSeatGap = Math.max(0, orderedSeatConfirm - standConfirm);
  const rawReturnTrigger =
    standConfirm +
    Math.max(
      captureConfig.returnHysteresis * 0.5,
      standToSeatGap * 0.25,
    );
  const returnTrigger = round3(
    Math.max(
      standConfirm + 0.002,
      Math.min(rawReturnTrigger, orderedSeatConfirm - captureConfig.returnSeatGap),
    ),
  );

  return {
    seatedBaseline: round3(seatedBaseline),
    riseTrigger: round3(orderedSeatConfirm - captureConfig.risingEnterEpsilon),
    standConfirm: round3(standConfirm),
    returnTrigger,
    seatConfirm: round3(orderedSeatConfirm),
    riseDelta: round3(scaledPrimary),
    resetDelta: round3(resetDelta),
    calibrationQuality,
  };
}

function attemptConfidence(
  attempt: ActiveAttempt,
  attemptType: StsAttemptType,
  calibrationQuality: StsCalibrationQuality | null,
): StsAttemptConfidence {
  if (attemptType === "unclear" || calibrationQuality === "fallback") return "low";
  if (attemptType === "partial" || calibrationQuality === "limited") return "medium";
  if (attempt.frameCount < 8 || attempt.visibilityMin < 0.8) return "medium";
  return "high";
}

function buildAttemptSummary(
  attempt: ActiveAttempt,
  endTimeMs: number,
  attemptType: StsAttemptType,
  reason: string | null,
  calibrationQuality: StsCalibrationQuality | null,
): StsAttemptSummary {
  const risingDuration =
    attempt.risingStartMs != null && attempt.standingStartMs != null
      ? attempt.standingStartMs - attempt.risingStartMs
      : null;
  const standingDuration =
    attempt.standingStartMs != null && attempt.returningStartMs != null
      ? attempt.returningStartMs - attempt.standingStartMs
      : attempt.standingStartMs != null && attemptType !== "complete"
        ? endTimeMs - attempt.standingStartMs
        : null;
  const returningDuration =
    attempt.returningStartMs != null && attempt.seatedReturnReached
      ? endTimeMs - attempt.returningStartMs
      : attempt.returningStartMs != null
        ? endTimeMs - attempt.returningStartMs
        : null;
  const cycleDuration = endTimeMs - attempt.startTimeMs;

  return {
    attemptIndex: attempt.attemptIndex,
    attemptType,
    startTimeMs: attempt.startTimeMs,
    endTimeMs,
    risingDetected: attempt.risingDetected,
    standingReached: attempt.standingReached,
    returningDetected: attempt.returningDetected,
    seatedReturnReached: attempt.seatedReturnReached,
    phaseDurationsMs: {
      rising: risingDuration,
      standing: standingDuration,
      returning: returningDuration,
      cycle: cycleDuration > 0 ? cycleDuration : null,
    },
    hipVerticalDisplacement: round3(attempt.seatedBaselineAtStart - attempt.minHipY),
    confidence: attemptConfidence(attempt, attemptType, calibrationQuality),
    reason,
  };
}

export class StsBiomechanicalCaptureFsm {
  private readonly baselineConfig: SagittalHipRepBaselineConfig;
  private readonly captureConfig: StsBiomechanicalCaptureConfig;
  private active: ActiveAttempt | null = null;

  constructor(
    baselineConfig: SagittalHipRepBaselineConfig,
    captureConfig: StsBiomechanicalCaptureConfig = DEFAULT_STS_BIOMECH_CAPTURE_CONFIG,
  ) {
    this.baselineConfig = baselineConfig;
    this.captureConfig = captureConfig;
  }

  tick(state: StsBiomechanicalCaptureState, input: StsBiomechanicalCaptureTickInput): void {
    if (!input.posePresent) {
      this.handlePoseLost(state, input.nowMs);
      return;
    }

    this.maybeStartCalibration(state, input.nowMs, input.canCollectBaseline);
    this.maybeFinalizeCalibration(state, input.nowMs, input.torsoSpan);

    if (state.phase === "calibrating" || state.thresholds === null) {
      if (input.canCollectBaseline && state.baselineWindowEndMs > 0) {
        state.baselineSamples.push(input.hipY);
      }
      return;
    }

    if (!input.canCount) {
      if (this.active) {
        this.finalizeActiveAttempt(state, input.nowMs, "unclear", "Readiness or calibration gate interrupted attempt evidence.");
      }
      return;
    }

    const smoothed = pushSmoothedSignal(state.temporal, input.hipY, 5);
    const thresholds = state.thresholds;
    const debounce = this.captureConfig.debounceFrames;

    switch (state.phase) {
      case "seated":
        this.tickSeated(state, input, smoothed, thresholds, debounce);
        break;
      case "rising":
        this.tickRising(state, input, smoothed, thresholds, debounce);
        break;
      case "standing":
        this.tickStanding(state, input, smoothed, thresholds, debounce);
        break;
      case "returning":
        this.tickReturning(state, input, smoothed, thresholds, debounce);
        break;
      default:
        break;
    }
  }

  finalizeSession(state: StsBiomechanicalCaptureState, nowMs: number): void {
    if (this.active) {
      const attempt = this.active;
      let attemptType: StsAttemptType = "partial";
      let reason = "Session ended before seated return was confirmed.";

      if (!attempt.risingDetected) {
        attemptType = "unclear";
        reason = "Insufficient phase transition evidence before session end.";
      } else if (!attempt.standingReached) {
        reason = "Rising detected but standing phase was not confirmed.";
      } else if (!attempt.returningDetected) {
        reason = "Standing reached but return phase was not confirmed.";
      }

      this.finalizeActiveAttempt(state, nowMs, attemptType, reason);
    }
  }

  private maybeStartCalibration(
    state: StsBiomechanicalCaptureState,
    nowMs: number,
    canStart: boolean,
  ): void {
    if (!canStart || state.baselineWindowEndMs > 0 || state.seatedBaseline !== null) return;
    state.baselineWindowEndMs = nowMs + this.captureConfig.baselineDurationMs;
    state.isBaselineCalibrating = true;
    state.phase = "calibrating";
  }

  private maybeFinalizeCalibration(
    state: StsBiomechanicalCaptureState,
    nowMs: number,
    torsoSpan: number | null,
  ): void {
    if (state.seatedBaseline !== null) return;
    if (state.baselineWindowEndMs <= 0 || nowMs < state.baselineWindowEndMs) return;

    const { baseline, quality } = computeRobustSeatedBaseline(
      state.baselineSamples,
      this.captureConfig.fallbackSeatedHipY,
    );
    state.seatedBaseline = baseline;
    state.calibrationQuality = quality;
    state.thresholds = resolveStsAdaptiveThresholds(
      baseline,
      this.baselineConfig,
      torsoSpan,
      quality,
      this.captureConfig,
    );
    state.isBaselineCalibrating = false;
    state.phase = "seated";
    resetRepTemporalSmoothingState(state.temporal);
    state.risingStreak = 0;
    state.standingStreak = 0;
    state.returningStreak = 0;
    state.seatedStreak = 0;
  }

  private tickSeated(
    state: StsBiomechanicalCaptureState,
    input: StsBiomechanicalCaptureTickInput,
    smoothed: number,
    thresholds: StsAdaptiveThresholds,
    debounce: number,
  ): void {
    const inSeatedBand = smoothed >= thresholds.seatConfirm || input.hipY >= thresholds.seatConfirm;
    state.seatedStreak = nextStreak(state.seatedStreak, inSeatedBand);

    const cooldownOk =
      state.repCount === 0 ||
      input.nowMs - state.lastRepCompleteMs >= this.captureConfig.minMsBetweenReps;
    const risingCondition =
      cooldownOk &&
      (smoothed <= thresholds.riseTrigger || input.hipY <= thresholds.riseTrigger);
    state.risingStreak = nextStreak(state.risingStreak, risingCondition);

    if (state.risingStreak >= debounce) {
      this.beginAttempt(state, input, thresholds);
      state.phase = "rising";
      state.risingStreak = 0;
      state.seatedStreak = 0;
      resetRepTemporalSmoothingState(state.temporal);
      pushSmoothedSignal(state.temporal, input.hipY, 5);
      if (this.active) {
        this.active.risingDetected = true;
        this.active.risingStartMs = input.nowMs;
      }
    }
  }

  private peakDisplacementMet(
    attempt: ActiveAttempt,
    thresholds: StsAdaptiveThresholds,
  ): boolean {
    const displacement = attempt.seatedBaselineAtStart - attempt.minHipY;
    return displacement >= thresholds.riseDelta * this.captureConfig.minPeakDisplacementFraction;
  }

  private isDescendingFromStand(
    attempt: ActiveAttempt,
    hipY: number,
    thresholds: StsAdaptiveThresholds,
  ): boolean {
    if (!attempt.standingReached || attempt.standingStartMs == null) return false;
    const descentFromPeak = hipY - attempt.minHipY;
    return (
      descentFromPeak >= thresholds.resetDelta * this.captureConfig.returnDescentFraction &&
      hipY > thresholds.returnTrigger
    );
  }

  private isReturnMotionActive(
    attempt: ActiveAttempt,
    hipY: number,
    smoothed: number,
    thresholds: StsAdaptiveThresholds,
  ): boolean {
    return (
      smoothed > thresholds.returnTrigger ||
      hipY > thresholds.returnTrigger ||
      this.isDescendingFromStand(attempt, hipY, thresholds)
    );
  }

  private isNearSeatedReturn(
    hipY: number,
    smoothed: number,
    thresholds: StsAdaptiveThresholds,
  ): boolean {
    const nearSeatedY =
      thresholds.seatedBaseline -
      thresholds.resetDelta * (0.5 + this.captureConfig.seatedReturnTolerance);
    const band = Math.max(thresholds.returnTrigger + 0.003, nearSeatedY);
    return smoothed >= band || hipY >= band;
  }

  private finalizeSeatedReturn(
    state: StsBiomechanicalCaptureState,
    input: StsBiomechanicalCaptureTickInput,
    thresholds: StsAdaptiveThresholds,
  ): void {
    if (!this.active) return;

    this.active.returningDetected = true;
    this.active.returningStartMs = this.active.returningStartMs ?? input.nowMs;
    this.active.seatedReturnReached = true;

    const duration = input.nowMs - this.active.startTimeMs;
    const peakReached =
      this.active.standingReached || this.peakDisplacementMet(this.active, thresholds);

    let attemptType: StsAttemptType;
    let reason: string | null = null;

    if (!this.active.risingDetected) {
      attemptType = "partial";
      reason = "Seated return confirmed but rising evidence was incomplete.";
    } else if (!peakReached) {
      attemptType = "partial";
      reason = "Return confirmed but standing-like peak was not reached.";
    } else if (duration < this.captureConfig.minCompleteCycleMs) {
      attemptType = "unclear";
      reason = "Cycle duration was too brief for a supported complete attempt.";
    } else {
      attemptType = "complete";
    }

    this.finalizeActiveAttempt(state, input.nowMs, attemptType, reason);
    if (attemptType === "complete") {
      state.repCount += 1;
      state.lastRepCompleteMs = input.nowMs;
    }
    state.phase = "seated";
    state.seatedStreak = 0;
  }

  private tickRising(
    state: StsBiomechanicalCaptureState,
    input: StsBiomechanicalCaptureTickInput,
    smoothed: number,
    thresholds: StsAdaptiveThresholds,
    debounce: number,
  ): void {
    if (!this.active) {
      state.phase = "seated";
      return;
    }

    this.accumulateAttempt(input);

    if (input.nowMs - this.active.startTimeMs > this.captureConfig.attemptTimeoutMs) {
      this.finalizeActiveAttempt(
        state,
        input.nowMs,
        "unclear",
        "Insufficient visibility or phase transition evidence during rising.",
      );
      state.phase = "seated";
      return;
    }

    const standCondition =
      smoothed <= thresholds.standConfirm || input.hipY <= thresholds.standConfirm;
    state.standingStreak = nextStreak(state.standingStreak, standCondition);

    const standingDebounce = this.captureConfig.standingDebounceFrames;
    if (state.standingStreak >= standingDebounce) {
      this.active.standingReached = true;
      this.active.standingStartMs = input.nowMs;
      state.phase = "standing";
      state.standingStreak = 0;
      return;
    }

    const abortToSeated =
      smoothed >= thresholds.seatConfirm || input.hipY >= thresholds.seatConfirm;
    state.seatedStreak = nextStreak(state.seatedStreak, abortToSeated);
    if (state.seatedStreak >= debounce) {
      this.finalizeActiveAttempt(
        state,
        input.nowMs,
        "partial",
        "Rising detected but standing phase was not confirmed.",
      );
      state.phase = "seated";
      state.seatedStreak = 0;
      return;
    }

    const returnFromRise =
      this.peakDisplacementMet(this.active, thresholds) &&
      this.isReturnMotionActive(this.active, input.hipY, smoothed, thresholds);
    state.returningStreak = nextStreak(state.returningStreak, returnFromRise);
    const returningDebounce = this.captureConfig.returningDebounceFrames;
    if (state.returningStreak >= returningDebounce) {
      this.active.standingReached = true;
      this.active.standingStartMs = this.active.standingStartMs ?? input.nowMs;
      this.active.returningDetected = true;
      this.active.returningStartMs = input.nowMs;
      state.phase = "returning";
      state.returningStreak = 0;
    }
  }

  private tickStanding(
    state: StsBiomechanicalCaptureState,
    input: StsBiomechanicalCaptureTickInput,
    smoothed: number,
    thresholds: StsAdaptiveThresholds,
    debounce: number,
  ): void {
    if (!this.active) {
      state.phase = "seated";
      return;
    }

    this.accumulateAttempt(input);

    if (input.nowMs - this.active.startTimeMs > this.captureConfig.attemptTimeoutMs) {
      this.finalizeActiveAttempt(
        state,
        input.nowMs,
        "partial",
        "Standing reached but seated return was not confirmed.",
      );
      state.phase = "seated";
      return;
    }

    const returnCondition = this.isReturnMotionActive(
      this.active,
      input.hipY,
      smoothed,
      thresholds,
    );
    state.returningStreak = nextStreak(state.returningStreak, returnCondition);

    const returningDebounce = this.captureConfig.returningDebounceFrames;
    if (state.returningStreak >= returningDebounce) {
      this.active.returningDetected = true;
      this.active.returningStartMs = input.nowMs;
      state.phase = "returning";
      state.returningStreak = 0;
      state.seatedStreak = 0;
      return;
    }

    if (
      this.active.standingReached &&
      this.isNearSeatedReturn(input.hipY, smoothed, thresholds)
    ) {
      state.seatedStreak = nextStreak(state.seatedStreak, true);
      if (state.seatedStreak >= returningDebounce) {
        this.finalizeSeatedReturn(state, input, thresholds);
      }
    } else {
      state.seatedStreak = 0;
    }
  }

  private tickReturning(
    state: StsBiomechanicalCaptureState,
    input: StsBiomechanicalCaptureTickInput,
    smoothed: number,
    thresholds: StsAdaptiveThresholds,
    debounce: number,
  ): void {
    if (!this.active) {
      state.phase = "seated";
      return;
    }

    this.accumulateAttempt(input);

    if (input.nowMs - this.active.startTimeMs > this.captureConfig.attemptTimeoutMs) {
      this.finalizeActiveAttempt(
        state,
        input.nowMs,
        "partial",
        "Return phase detected but seated return was not confirmed.",
      );
      state.phase = "seated";
      return;
    }

    const seatedCondition = this.isNearSeatedReturn(
      input.hipY,
      smoothed,
      thresholds,
    );
    state.seatedStreak = nextStreak(state.seatedStreak, seatedCondition);

    const seatedDebounce = this.captureConfig.returningDebounceFrames;
    if (state.seatedStreak >= seatedDebounce) {
      this.finalizeSeatedReturn(state, input, thresholds);
    }
  }

  private beginAttempt(
    state: StsBiomechanicalCaptureState,
    input: StsBiomechanicalCaptureTickInput,
    thresholds: StsAdaptiveThresholds,
  ): void {
    this.active = {
      attemptIndex: state.attempts.length + 1,
      startTimeMs: input.nowMs,
      risingDetected: false,
      standingReached: false,
      returningDetected: false,
      seatedReturnReached: false,
      risingStartMs: null,
      standingStartMs: null,
      returningStartMs: null,
      seatedBaselineAtStart: thresholds.seatedBaseline,
      minHipY: input.hipY,
      maxHipY: input.hipY,
      visibilityMin: input.hipVisibilitySum,
      visibilitySum: 0,
      frameCount: 0,
    };
  }

  private accumulateAttempt(input: StsBiomechanicalCaptureTickInput): void {
    if (!this.active) return;
    this.active.minHipY = Math.min(this.active.minHipY, input.hipY);
    this.active.maxHipY = Math.max(this.active.maxHipY, input.hipY);
    this.active.visibilityMin = Math.min(this.active.visibilityMin, input.hipVisibilitySum);
    this.active.visibilitySum += input.hipVisibilitySum;
    this.active.frameCount += 1;
  }

  private finalizeActiveAttempt(
    state: StsBiomechanicalCaptureState,
    endTimeMs: number,
    attemptType: StsAttemptType,
    reason: string | null,
  ): void {
    const active = this.active;
    if (!active) return;

    state.attempts.push(
      buildAttemptSummary(active, endTimeMs, attemptType, reason, state.calibrationQuality),
    );
    this.active = null;
    state.risingStreak = 0;
    state.standingStreak = 0;
    state.returningStreak = 0;
    state.seatedStreak = 0;
    resetRepTemporalSmoothingState(state.temporal);
  }

  private handlePoseLost(state: StsBiomechanicalCaptureState, nowMs: number): void {
    if (this.active) {
      this.finalizeActiveAttempt(
        state,
        nowMs,
        "unclear",
        "Unable to assess due to camera angle or limited landmark visibility.",
      );
    }
    state.risingStreak = 0;
    state.standingStreak = 0;
    state.returningStreak = 0;
    state.seatedStreak = 0;
  }
}

/** Map capture phase to legacy standPhase for backward-compatible consumers. */
export function stsCapturePhaseToStandPhase(phase: StsCapturePhase): "up" | "down" {
  return phase === "standing" ? "up" : "down";
}

/** Map capture phase to timeline movement phase. */
export function stsCapturePhaseToMovementPhase(
  phase: StsCapturePhase,
): "seated" | "rising" | "standing" | "returning" | "rest" | "unknown" {
  switch (phase) {
    case "calibrating":
      return "rest";
    case "seated":
      return "seated";
    case "rising":
      return "rising";
    case "standing":
      return "standing";
    case "returning":
      return "returning";
    default:
      return "unknown";
  }
}
