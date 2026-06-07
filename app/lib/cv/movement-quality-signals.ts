/**
 * Movement Quality Signals — deterministic STS movement quality summary from
 * existing camera-derived motion evidence. Answers "How was the movement performed?"
 * No diagnosis, clinical scoring, treatment advice, or weakness claims.
 */

import type {
  MotionAnalysisPhaseRatios,
  MotionAnalysisRepTimings,
  MotionAnalysisSummaryLabel,
} from "@/app/lib/cv/motion-analysis-report";

const STS_EXERCISE_ID = "sit-to-stand";

const REP_TIMING_SPREAD_MIN_S = 1;
const RETURNING_PHASE_LOW_PCT = 15;
const RISING_PHASE_LOW_PCT = 15;
const UNKNOWN_PHASE_HIGH_PCT = 25;
const REST_PHASE_HIGH_PCT = 40;
const DOMINANT_PHASE_PCT = 50;
const MEANINGFUL_PHASE_PCT = 5;

export type PacingConsistencyLabel =
  | "Consistent"
  | "Moderate"
  | "Variable"
  | "Insufficient data";

export type PhaseConsistencyLabel =
  | "Consistent"
  | "Moderate"
  | "Variable"
  | "Incomplete"
  | "Insufficient data";

export type CompletionClarityLabel =
  | "Clear"
  | "Mostly clear"
  | "Unclear"
  | "Insufficient data";

export type MovementQualitySignals = {
  averageRepTimeSec: number | null;
  fastestRepTimeSec: number | null;
  slowestRepTimeSec: number | null;
  timingRangeSec: number | null;
  pacingConsistency: PacingConsistencyLabel;
  phaseConsistency: PhaseConsistencyLabel;
  completionClarity: CompletionClarityLabel;
  observedStandingPhaseRatio: number | null;
  observedReturningPhaseRatio: number | null;
  qualitySignals: string[];
  clinicianReviewFocus: string[];
  qualityFlags: string[];
};

export type BuildMovementQualitySignalsInput = {
  exerciseId?: string | null;
  repTimings?: MotionAnalysisRepTimings | null;
  phaseRatios?: MotionAnalysisPhaseRatios | null;
  completeReps?: number | null;
  unclearReps?: number | null;
  clinicianFlags?: string[] | null;
  trackingQuality?: string | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
};

function nonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function roundTiming(value: number): number {
  return Math.round(value * 10) / 10;
}

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function phasePct(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  phase: keyof MotionAnalysisPhaseRatios,
): number {
  return phaseRatios?.[phase] ?? 0;
}

function resolvePacingConsistency(
  repTimings: MotionAnalysisRepTimings | null | undefined,
): {
  label: PacingConsistencyLabel;
  timingRangeSec: number | null;
  signals: string[];
  flags: string[];
  reviewFocus: string[];
} {
  if (!repTimings) {
    return {
      label: "Insufficient data",
      timingRangeSec: null,
      signals: [],
      flags: ["timing_insufficient"],
      reviewFocus: [],
    };
  }

  const { fastestS, slowestS, avgS } = repTimings;
  if (fastestS === null || slowestS === null) {
    return {
      label: "Insufficient data",
      timingRangeSec: null,
      signals: [],
      flags: ["timing_insufficient"],
      reviewFocus: [],
    };
  }

  const timingRangeSec = roundTiming(slowestS - fastestS);
  const spreadThreshold =
    avgS !== null && avgS > 0
      ? Math.max(REP_TIMING_SPREAD_MIN_S, avgS * 0.5)
      : REP_TIMING_SPREAD_MIN_S;

  const signals: string[] = [];
  const flags: string[] = [];
  const reviewFocus: string[] = [];

  if (timingRangeSec >= spreadThreshold) {
    signals.push("Repetition pacing varied across the session.");
    signals.push("Pacing consistency may be worth clinician review.");
    reviewFocus.push(
      "Review repetition-to-repetition pacing consistency.",
    );
    reviewFocus.push(
      "Consider whether timing variability may reflect movement strategy, hesitation, or capture limitation — cannot be confirmed from camera data alone.",
    );
    return {
      label: "Variable",
      timingRangeSec,
      signals,
      flags: [...flags, "variable_pacing"],
      reviewFocus,
    };
  }

  if (timingRangeSec >= spreadThreshold * 0.5) {
    signals.push(
      "Repetition pacing showed moderate variation across the session.",
    );
    reviewFocus.push(
      "Review repetition-to-repetition pacing consistency.",
    );
    return {
      label: "Moderate",
      timingRangeSec,
      signals,
      flags: [...flags, "moderate_pacing"],
      reviewFocus,
    };
  }

  signals.push("Repetition pacing appeared relatively consistent across captured cycles.");
  return {
    label: "Consistent",
    timingRangeSec,
    signals,
    flags,
    reviewFocus,
  };
}

function resolvePhaseConsistency(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): {
  label: PhaseConsistencyLabel;
  signals: string[];
  flags: string[];
  reviewFocus: string[];
} {
  if (!phaseRatios) {
    return {
      label: "Insufficient data",
      signals: [],
      flags: ["phase_insufficient"],
      reviewFocus: [],
    };
  }

  const risingPct = phasePct(phaseRatios, "rising");
  const standingPct = phasePct(phaseRatios, "standing");
  const returningPct = phasePct(phaseRatios, "returning");
  const unknownPct = phasePct(phaseRatios, "unknown");
  const restPct = phasePct(phaseRatios, "rest");
  const transitionDominant = unknownPct + restPct;

  const signals: string[] = [];
  const flags: string[] = [];
  const reviewFocus: string[] = [];

  const risingPresent = risingPct > 0;
  const standingPresent = standingPct > 0;
  const returningPresent = returningPct > 0;

  if (!risingPresent || !returningPresent) {
    signals.push(
      "Camera-derived phase evidence may be incomplete — rising or returning phases were not consistently captured.",
    );
    reviewFocus.push(
      "Confirm terminal standing posture visually.",
    );
    reviewFocus.push(
      "Observe lowering control during return to sitting.",
    );
    return {
      label: "Incomplete",
      signals,
      flags: [...flags, "incomplete_phases"],
      reviewFocus,
    };
  }

  if (transitionDominant >= DOMINANT_PHASE_PCT) {
    signals.push(
      "Rest or unknown phases dominated capture — movement phase continuity may require clinician review.",
    );
    return {
      label: transitionDominant >= DOMINANT_PHASE_PCT && !standingPresent
        ? "Incomplete"
        : "Variable",
      signals,
      flags: [...flags, "transition_dominant"],
      reviewFocus: [
        "Review whether phase gaps reflect true pauses, tracking loss, or capture framing.",
      ],
    };
  }

  if (unknownPct >= UNKNOWN_PHASE_HIGH_PCT || restPct >= REST_PHASE_HIGH_PCT) {
    signals.push(
      "Phase distribution varied across the session — capture continuity may limit phase interpretation.",
    );
    flags.push("variable_phases");
    reviewFocus.push(
      "Review whether phase gaps reflect true pauses, tracking loss, or capture framing.",
    );
    return {
      label: "Variable",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (returningPct > 0 && returningPct < RETURNING_PHASE_LOW_PCT) {
    signals.push(
      "Returning phase was captured but may be under-represented — clinician may confirm lowering control visually.",
    );
    flags.push("low_returning_phase");
    reviewFocus.push(
      "Observe lowering control during return to sitting.",
    );
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (
    risingPct > 0 &&
    risingPct < RISING_PHASE_LOW_PCT &&
    standingPct > 40
  ) {
    signals.push(
      "Rising phase was brief relative to standing — rise initiation may require clinician review.",
    );
    flags.push("brief_rising_phase");
    reviewFocus.push(
      "Confirm terminal standing posture visually.",
    );
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  const allMeaningful =
    risingPct >= MEANINGFUL_PHASE_PCT &&
    standingPct >= MEANINGFUL_PHASE_PCT &&
    returningPct >= MEANINGFUL_PHASE_PCT;

  if (allMeaningful) {
    signals.push(
      "Seated, rising, standing, and returning phases were observed across capture.",
    );
    return {
      label: "Consistent",
      signals,
      flags,
      reviewFocus: [
        "Confirm terminal standing posture visually.",
        "Observe lowering control during return to sitting.",
      ],
    };
  }

  if (risingPresent && standingPresent && returningPresent) {
    signals.push(
      "Core sit-to-stand phases were captured — distribution may still warrant clinician review.",
    );
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus: [
        "Confirm terminal standing posture visually.",
        "Observe lowering control during return to sitting.",
      ],
    };
  }

  return {
    label: "Incomplete",
    signals,
    flags: [...flags, "incomplete_phases"],
    reviewFocus,
  };
}

function resolveCompletionClarity(
  completeReps: number,
  unclearReps: number,
  clinicianFlags: string[] | null | undefined,
): {
  label: CompletionClarityLabel;
  signals: string[];
  flags: string[];
  reviewFocus: string[];
} {
  const totalReps = completeReps + unclearReps;
  const signals: string[] = [];
  const flags: string[] = [];
  const reviewFocus: string[] = [];

  if (totalReps === 0) {
    return {
      label: "Insufficient data",
      signals,
      flags: ["completion_insufficient"],
      reviewFocus,
    };
  }

  const unclearRatio = unclearReps / totalReps;

  if (
    unclearReps === 0 &&
    !hasFlag(clinicianFlags, "unclear_reps_recorded")
  ) {
    signals.push("Recorded repetition boundaries appeared clear in capture.");
    return {
      label: "Clear",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (unclearRatio <= 0.2) {
    signals.push(
      "Most repetition boundaries were captured — a small number may require clinician review.",
    );
    reviewFocus.push(
      "Review unclear repetitions to confirm whether boundaries reflect true movement or capture gaps.",
    );
    return {
      label: "Mostly clear",
      signals,
      flags: unclearReps > 0 ? ["some_unclear_reps"] : [],
      reviewFocus,
    };
  }

  signals.push(
    "Several repetition boundaries were unclear in capture — clinician may confirm cycle completion visually.",
  );
  reviewFocus.push(
    "Review unclear repetitions to confirm whether boundaries reflect true movement or capture gaps.",
  );
  return {
    label: "Unclear",
    signals,
    flags: ["unclear_reps_elevated"],
    reviewFocus,
  };
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function hasEnoughData(input: BuildMovementQualitySignalsInput): boolean {
  const completeReps = nonNegativeInt(input.completeReps);
  const hasTimings =
    input.repTimings != null &&
    (input.repTimings.avgS !== null ||
      input.repTimings.fastestS !== null ||
      input.repTimings.slowestS !== null);
  const hasPhases =
    input.phaseRatios != null &&
    Object.values(input.phaseRatios).some(
      (ratio) => typeof ratio === "number" && ratio > 0,
    );

  return completeReps > 0 || hasTimings || hasPhases;
}

/**
 * Build movement quality signals for Sit-to-Stand sessions.
 * Returns null for non-STS exercises or when insufficient evidence exists.
 */
export function buildMovementQualitySignals(
  input: BuildMovementQualitySignalsInput = {},
): MovementQualitySignals | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== STS_EXERCISE_ID) return null;
  if (!hasEnoughData(input)) return null;

  const completeReps = nonNegativeInt(input.completeReps);
  const unclearReps = nonNegativeInt(input.unclearReps);

  const pacing = resolvePacingConsistency(input.repTimings);
  const phase = resolvePhaseConsistency(input.phaseRatios);
  const completion = resolveCompletionClarity(
    completeReps,
    unclearReps,
    input.clinicianFlags,
  );

  const qualitySignals = dedupeStrings([
    ...pacing.signals,
    ...phase.signals,
    ...completion.signals,
  ]);

  const clinicianReviewFocus = dedupeStrings([
    ...pacing.reviewFocus,
    ...phase.reviewFocus,
    ...completion.reviewFocus,
  ]);

  const qualityFlags = dedupeStrings([
    ...pacing.flags,
    ...phase.flags,
    ...completion.flags,
    ...(hasFlag(input.clinicianFlags, "pose_tracking_interrupted")
      ? ["pose_tracking_interrupted"]
      : []),
    ...(hasFlag(input.clinicianFlags, "incomplete_cycle")
      ? ["incomplete_cycle"]
      : []),
    ...(input.summaryLabel === "Limited visibility" ? ["limited_visibility"] : []),
  ]);

  return {
    averageRepTimeSec: input.repTimings?.avgS ?? null,
    fastestRepTimeSec: input.repTimings?.fastestS ?? null,
    slowestRepTimeSec: input.repTimings?.slowestS ?? null,
    timingRangeSec: pacing.timingRangeSec,
    pacingConsistency: pacing.label,
    phaseConsistency: phase.label,
    completionClarity: completion.label,
    observedStandingPhaseRatio: input.phaseRatios?.standing ?? null,
    observedReturningPhaseRatio: input.phaseRatios?.returning ?? null,
    qualitySignals,
    clinicianReviewFocus,
    qualityFlags,
  };
}
