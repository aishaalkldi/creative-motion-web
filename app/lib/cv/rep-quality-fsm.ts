/**
 * MQ-REP-1 — Per-rep Sit-to-Stand capture FSM (shadow / in-memory only).
 * Capture flags for therapist review — not clinical scoring or movement judgment.
 */

export type RepQualityFsmState =
  | "seated_ready"
  | "rising"
  | "standing_peak"
  | "returning"
  | "completed_rep"
  | "unclear_rep";

export type CaptureFlag =
  | "complete_rep"
  | "incomplete_stand"
  | "incomplete_return"
  | "too_fast"
  | "unclear_visibility";

export type UnclearReason =
  | "pose_lost"
  | "visibility_low"
  | "timeout_no_peak"
  | "timeout_no_return"
  | "aborted_session_stop"
  | "readiness_lost_mid_rep";

export type RepCaptureRecord = {
  repIndex: number;
  startTimeMs: number;
  peakTimeMs: number | null;
  endTimeMs: number | null;
  durationMs: number | null;
  hipYStart: number | null;
  hipYPeak: number | null;
  hipYEnd: number | null;
  standDelta: number;
  returnDelta: number;
  visibilityMin: number | null;
  visibilityAvg: number | null;
  completedCycle: boolean;
  unclearReason: UnclearReason | null;
  captureFlags: CaptureFlag[];
};

export type SessionMotionSummary = {
  schemaVersion: "mq-rep-1";
  exerciseId: "sit-to-stand";
  capturedAtMs: number;
  sessionDurationS: number;
  legacyRepCount: number;
  completedCycleCount: number;
  unclearRepCount: number;
  captureFlagCounts: Record<CaptureFlag, number>;
  sessionVisibility: {
    framesWithPose: number;
    framesTotal: number;
    trackingQualityLast: string;
  };
  reps: RepCaptureRecord[];
  therapistReviewHint: "capture_summary_only";
};

export type RepQualityFsmConfig = {
  minRepDurationMs: number;
  repTimeoutMs: number;
  /** Sum of left+right hip visibility treated as "fair" floor (matches detector visibilityFair). */
  visibilityFairSum: number;
  /** Fraction of rep frames below fair sum → unclear_visibility. */
  visibilityLowFraction: number;
  /** Hip-Y band above standThreshold before entering returning. */
  peakReturnHysteresis: number;
  /** Hip-Y below seatedThreshold − ε enters rising from seated_ready. */
  risingEnterEpsilon: number;
};

export const DEFAULT_REP_QUALITY_FSM_CONFIG: RepQualityFsmConfig = {
  minRepDurationMs: 1200,
  repTimeoutMs: 15_000,
  visibilityFairSum: 0.8,
  visibilityLowFraction: 0.4,
  peakReturnHysteresis: 0.01,
  risingEnterEpsilon: 0.005,
};

export type RepQualityTickInput = {
  hipY: number;
  nowMs: number;
  standThreshold: number;
  seatedThreshold: number;
  standDelta: number;
  returnDelta: number;
  hipVisibilitySum: number;
  posePresent: boolean;
  canCount: boolean;
};

type ActiveRep = {
  repIndex: number;
  startTimeMs: number;
  standDelta: number;
  returnDelta: number;
  hipYStart: number;
  hipYEnd: number;
  hipYPeak: number | null;
  peakTimeMs: number | null;
  reachedPeak: boolean;
  visibilityMin: number;
  visibilitySum: number;
  frameCount: number;
  lowVisibilityFrames: number;
};

const EMPTY_FLAG_COUNTS = (): Record<CaptureFlag, number> => ({
  complete_rep: 0,
  incomplete_stand: 0,
  incomplete_return: 0,
  too_fast: 0,
  unclear_visibility: 0,
});

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function computeCaptureFlags(
  input: {
    completedCycle: boolean;
    reachedPeak: boolean;
    durationMs: number | null;
    visibilityMin: number | null;
    lowVisibilityFraction: number;
    unclearReason: UnclearReason | null;
  },
  config: RepQualityFsmConfig,
): CaptureFlag[] {
  const flags: CaptureFlag[] = [];
  const duration = input.durationMs ?? 0;
  const visibilityLimited =
    input.visibilityMin !== null && input.visibilityMin < config.visibilityFairSum;
  const visibilityFractionLimited =
    input.lowVisibilityFraction >= config.visibilityLowFraction;

  if (input.completedCycle && duration >= config.minRepDurationMs && !visibilityLimited && !visibilityFractionLimited) {
    flags.push("complete_rep");
  }
  if (!input.reachedPeak) {
    flags.push("incomplete_stand");
  }
  if (input.reachedPeak && !input.completedCycle) {
    flags.push("incomplete_return");
  }
  if (duration > 0 && duration < config.minRepDurationMs) {
    flags.push("too_fast");
  }
  if (visibilityLimited || visibilityFractionLimited || input.unclearReason === "visibility_low") {
    flags.push("unclear_visibility");
  }

  return flags;
}

export class RepQualityFsm {
  private state: RepQualityFsmState = "seated_ready";
  private readonly config: RepQualityFsmConfig;
  private readonly reps: RepCaptureRecord[] = [];
  private active: ActiveRep | null = null;

  constructor(config: RepQualityFsmConfig = DEFAULT_REP_QUALITY_FSM_CONFIG) {
    this.config = config;
  }

  getState(): RepQualityFsmState {
    return this.state;
  }

  getReps(): readonly RepCaptureRecord[] {
    return this.reps;
  }

  reset(): void {
    this.state = "seated_ready";
    this.active = null;
    this.reps.length = 0;
  }

  tick(input: RepQualityTickInput): void {
    if (!input.posePresent) {
      this.handlePoseLost(input.nowMs);
      return;
    }

    if (!input.canCount) {
      if (this.active) {
        this.finalizeActiveRep(input.nowMs, "readiness_lost_mid_rep", false);
      }
      return;
    }

    switch (this.state) {
      case "seated_ready":
        this.tickSeatedReady(input);
        break;
      case "rising":
        this.tickRising(input);
        break;
      case "standing_peak":
        this.tickStandingPeak(input);
        break;
      case "returning":
        this.tickReturning(input);
        break;
      case "completed_rep":
      case "unclear_rep":
        this.state = "seated_ready";
        this.tickSeatedReady(input);
        break;
      default:
        break;
    }
  }

  handlePoseLost(nowMs: number): void {
    if (this.active) {
      this.finalizeActiveRep(nowMs, "pose_lost", false);
    }
  }

  finalizeSession(nowMs: number): void {
    if (this.active) {
      this.finalizeActiveRep(nowMs, "aborted_session_stop", false);
    }
  }

  buildSessionSummary(context: {
    legacyRepCount: number;
    sessionDurationS: number;
    framesWithPose: number;
    framesTotal: number;
    trackingQualityLast: string;
    capturedAtMs?: number;
  }): SessionMotionSummary {
    const flagCounts = EMPTY_FLAG_COUNTS();
    let completedCycleCount = 0;
    let unclearRepCount = 0;

    for (const rep of this.reps) {
      if (rep.completedCycle) completedCycleCount += 1;
      if (!rep.completedCycle || rep.unclearReason) unclearRepCount += 1;
      for (const flag of rep.captureFlags) {
        flagCounts[flag] += 1;
      }
    }

    return {
      schemaVersion: "mq-rep-1",
      exerciseId: "sit-to-stand",
      capturedAtMs: context.capturedAtMs ?? Date.now(),
      sessionDurationS: context.sessionDurationS,
      legacyRepCount: context.legacyRepCount,
      completedCycleCount,
      unclearRepCount,
      captureFlagCounts: flagCounts,
      sessionVisibility: {
        framesWithPose: context.framesWithPose,
        framesTotal: context.framesTotal,
        trackingQualityLast: context.trackingQualityLast,
      },
      reps: [...this.reps],
      therapistReviewHint: "capture_summary_only",
    };
  }

  private tickSeatedReady(input: RepQualityTickInput): void {
    const risingEntry = input.seatedThreshold - this.config.risingEnterEpsilon;
    if (input.hipY < risingEntry) {
      this.beginRep(input);
      this.state = "rising";
      this.accumulateFrame(input);
      if (input.hipY <= input.standThreshold) {
        this.markPeak(input);
        this.state = "standing_peak";
      }
    }
  }

  private tickRising(input: RepQualityTickInput): void {
    if (!this.active) {
      this.state = "seated_ready";
      return;
    }

    this.accumulateFrame(input);

    if (input.nowMs - this.active.startTimeMs > this.config.repTimeoutMs) {
      this.finalizeActiveRep(input.nowMs, "timeout_no_peak", false);
      return;
    }

    if (input.hipY <= input.standThreshold) {
      this.markPeak(input);
      this.state = "standing_peak";
      return;
    }

    if (input.hipY >= input.seatedThreshold) {
      this.finalizeActiveRep(input.nowMs, null, false);
    }
  }

  private tickStandingPeak(input: RepQualityTickInput): void {
    if (!this.active) {
      this.state = "seated_ready";
      return;
    }

    this.accumulateFrame(input);

    if (input.hipY < (this.active.hipYPeak ?? input.hipY)) {
      this.active.hipYPeak = input.hipY;
      this.active.peakTimeMs = input.nowMs;
    }

    if (input.nowMs - this.active.startTimeMs > this.config.repTimeoutMs) {
      this.finalizeActiveRep(input.nowMs, "timeout_no_return", false);
      return;
    }

    const returnBand = input.standThreshold + this.config.peakReturnHysteresis;
    if (input.hipY >= input.seatedThreshold) {
      this.finalizeActiveRep(input.nowMs, null, true);
      return;
    }
    if (input.hipY > returnBand) {
      this.state = "returning";
      if (input.hipY >= input.seatedThreshold) {
        this.finalizeActiveRep(input.nowMs, null, true);
      }
    }
  }

  private tickReturning(input: RepQualityTickInput): void {
    if (!this.active) {
      this.state = "seated_ready";
      return;
    }

    this.accumulateFrame(input);

    if (input.nowMs - this.active.startTimeMs > this.config.repTimeoutMs) {
      this.finalizeActiveRep(input.nowMs, "timeout_no_return", false);
      return;
    }

    if (input.hipY >= input.seatedThreshold) {
      this.finalizeActiveRep(input.nowMs, null, true);
    }
  }

  private beginRep(input: RepQualityTickInput): void {
    this.active = {
      repIndex: this.reps.length + 1,
      startTimeMs: input.nowMs,
      standDelta: input.standDelta,
      returnDelta: input.returnDelta,
      hipYStart: input.hipY,
      hipYEnd: input.hipY,
      hipYPeak: null,
      peakTimeMs: null,
      reachedPeak: false,
      visibilityMin: input.hipVisibilitySum,
      visibilitySum: 0,
      frameCount: 0,
      lowVisibilityFrames: 0,
    };
  }

  private markPeak(input: RepQualityTickInput): void {
    if (!this.active) return;
    this.active.reachedPeak = true;
    this.active.hipYPeak = input.hipY;
    this.active.peakTimeMs = input.nowMs;
  }

  private accumulateFrame(input: RepQualityTickInput): void {
    if (!this.active) return;
    this.active.hipYEnd = input.hipY;
    this.active.frameCount += 1;
    this.active.visibilitySum += input.hipVisibilitySum;
    this.active.visibilityMin = Math.min(this.active.visibilityMin, input.hipVisibilitySum);
    if (input.hipVisibilitySum < this.config.visibilityFairSum) {
      this.active.lowVisibilityFrames += 1;
    }
  }

  private finalizeActiveRep(
    nowMs: number,
    unclearReason: UnclearReason | null,
    completedCycle: boolean,
  ): void {
    const active = this.active;
    if (!active) {
      this.state = "seated_ready";
      return;
    }

    const durationMs = nowMs - active.startTimeMs;
    const frameCount = Math.max(active.frameCount, 1);
    const visibilityAvg = active.visibilitySum / frameCount;
    const lowVisibilityFraction = active.lowVisibilityFrames / frameCount;

    let resolvedUnclear = unclearReason;
    if (!resolvedUnclear && lowVisibilityFraction >= this.config.visibilityLowFraction) {
      resolvedUnclear = "visibility_low";
    }

    const captureFlags = computeCaptureFlags(
      {
        completedCycle,
        reachedPeak: active.reachedPeak,
        durationMs,
        visibilityMin: active.visibilityMin,
        lowVisibilityFraction,
        unclearReason: resolvedUnclear,
      },
      this.config,
    );

    const record: RepCaptureRecord = {
      repIndex: active.repIndex,
      startTimeMs: active.startTimeMs,
      peakTimeMs: active.peakTimeMs,
      endTimeMs: nowMs,
      durationMs,
      hipYStart: round3(active.hipYStart),
      hipYPeak: active.hipYPeak !== null ? round3(active.hipYPeak) : null,
      hipYEnd: round3(active.hipYEnd),
      standDelta: round3(active.standDelta),
      returnDelta: round3(active.returnDelta),
      visibilityMin: round3(active.visibilityMin),
      visibilityAvg: round3(visibilityAvg),
      completedCycle,
      unclearReason: resolvedUnclear,
      captureFlags,
    };

    this.reps.push(record);
    this.active = null;
    this.state = completedCycle ? "completed_rep" : "unclear_rep";
  }
}

/** Mirrors legacy stand-phase rep increment (for tests — FSM must not call this). */
export function simulateLegacyRepCount(
  samples: Array<{ hipY: number; nowMs: number }>,
  thresholds: { standThreshold: number; seatedThreshold: number; minMsBetweenReps: number },
): number {
  let standPhase: "up" | "down" = "down";
  let repCount = 0;
  let lastRepAtMs = 0;

  for (const { hipY, nowMs } of samples) {
    if (hipY < thresholds.standThreshold && standPhase === "down" && nowMs - lastRepAtMs >= thresholds.minMsBetweenReps) {
      standPhase = "up";
      repCount += 1;
      lastRepAtMs = nowMs;
    } else if (hipY > thresholds.seatedThreshold && standPhase === "up") {
      standPhase = "down";
    }
  }

  return repCount;
}
