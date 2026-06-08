/**
 * Movement Quality Signals — deterministic Mini Squat movement quality summary.
 * No diagnosis, clinical scoring, treatment advice, or weakness claims.
 */

import type {
  MiniSquatMotionPilotPhaseRatios,
  MiniSquatMotionPilotRepTimings,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
import type { MotionAnalysisSummaryLabel } from "@/app/lib/cv/motion-analysis-report";
import {
  MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE,
  MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL,
  type MsPilotEvidenceMode,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
import type {
  CompletionClarityLabel,
  MovementQualitySignals,
  PacingConsistencyLabel,
  PhaseConsistencyLabel,
} from "@/app/lib/cv/movement-quality-signals";

const MINI_SQUAT_EXERCISE_ID = "mini-squat";

const REP_TIMING_SPREAD_MIN_S = 1;
const LOWERING_PHASE_LOW_PCT = 15;
const RISING_PHASE_LOW_PCT = 15;
const BOTTOM_PHASE_LOW_PCT = 10;
const UNKNOWN_PHASE_HIGH_PCT = 25;
const REST_PHASE_HIGH_PCT = 40;
const DOMINANT_PHASE_PCT = 50;
const MEANINGFUL_PHASE_PCT = 5;

export type MiniSquatMovementQualitySignals = {
  averageCycleIntervalSec: number | null;
  fastestCycleIntervalSec: number | null;
  slowestCycleIntervalSec: number | null;
  timingRangeSec: number | null;
  pacingConsistency: PacingConsistencyLabel;
  phaseConsistency: PhaseConsistencyLabel;
  cycleDetectionClarity: CompletionClarityLabel;
  observedStandingPhaseRatio: number | null;
  observedLoweringPhaseRatio: number | null;
  observedBottomPhaseRatio: number | null;
  observedRisingPhaseRatio: number | null;
  qualitySignals: string[];
  clinicianReviewFocus: string[];
  qualityFlags: string[];
};

export type BuildMiniSquatMovementQualitySignalsInput = {
  exerciseId?: string | null;
  evidenceMode?: MsPilotEvidenceMode | null;
  repTimings?: MiniSquatMotionPilotRepTimings | null;
  phaseRatios?: MiniSquatMotionPilotPhaseRatios | null;
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
  phaseRatios: MiniSquatMotionPilotPhaseRatios | null | undefined,
  phase: keyof MiniSquatMotionPilotPhaseRatios,
): number {
  return phaseRatios?.[phase] ?? 0;
}

function resolvePacingConsistency(
  repTimings: MiniSquatMotionPilotRepTimings | null | undefined,
  evidenceMode: MsPilotEvidenceMode | null | undefined,
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
    if (avgS !== null && avgS > 0 && evidenceMode === "synthesized") {
      return {
        label: "Insufficient data",
        timingRangeSec: null,
        signals: [MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE],
        flags: ["estimated_timing_only"],
        reviewFocus: [],
      };
    }
    if (avgS !== null && avgS > 0) {
      return {
        label: "Moderate",
        timingRangeSec: null,
        signals: [
          `Average cycle interval estimated at ${avgS}s — fastest and slowest intervals were not captured.`,
        ],
        flags: ["estimated_timing_only"],
        reviewFocus: [
          "Review repetition-to-repetition pacing consistency.",
        ],
      };
    }
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
    signals.push("Squat cycle pacing varied across the session.");
    signals.push("Pacing consistency may be worth clinician review.");
    reviewFocus.push("Review repetition-to-repetition pacing consistency.");
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
    signals.push("Squat cycle pacing showed moderate variation across the session.");
    reviewFocus.push("Review repetition-to-repetition pacing consistency.");
    return {
      label: "Moderate",
      timingRangeSec,
      signals,
      flags: [...flags, "moderate_pacing"],
      reviewFocus,
    };
  }

  signals.push("Squat cycle pacing appeared relatively consistent across captured cycles.");
  return {
    label: "Consistent",
    timingRangeSec,
    signals,
    flags,
    reviewFocus,
  };
}

function resolvePhaseConsistency(
  phaseRatios: MiniSquatMotionPilotPhaseRatios | null | undefined,
  evidenceMode: MsPilotEvidenceMode | null | undefined,
): {
  label: PhaseConsistencyLabel;
  signals: string[];
  flags: string[];
  reviewFocus: string[];
} {
  if (!phaseRatios || Object.values(phaseRatios).every((v) => !v || v === 0)) {
    const signals =
      evidenceMode === "synthesized"
        ? [MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL, MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE]
        : [
            "Phase distribution not available — clinician may assess squat depth and phase timing visually.",
          ];
    return {
      label: "Insufficient data",
      signals,
      flags: ["phase_insufficient"],
      reviewFocus:
        evidenceMode === "synthesized"
          ? []
          : ["Clinician may review squat depth consistency across repetitions."],
    };
  }

  const loweringPct = phasePct(phaseRatios, "lowering");
  const bottomPct = phasePct(phaseRatios, "bottom");
  const risingPct = phasePct(phaseRatios, "rising");
  const standingPct = phasePct(phaseRatios, "standing");
  const unknownPct = phasePct(phaseRatios, "unknown");
  const restPct = phasePct(phaseRatios, "rest");
  const transitionDominant = unknownPct + restPct;

  const signals: string[] = [];
  const flags: string[] = [];
  const reviewFocus: string[] = [];

  const standingPresent = standingPct > 0;
  const loweringPresent = loweringPct > 0;
  const bottomPresent = bottomPct > 0;
  const risingPresent = risingPct > 0;

  if (!loweringPresent || !risingPresent) {
    signals.push(
      "Camera-derived phase evidence may be incomplete — lowering or rising phases were not consistently captured.",
    );
    reviewFocus.push("Clinician may review squat depth during descent.");
    reviewFocus.push("Clinician may review trunk strategy during ascent.");
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

  if (bottomPct > 0 && bottomPct < BOTTOM_PHASE_LOW_PCT) {
    signals.push(
      "Bottom position was captured but may be under-represented — clinician may confirm squat depth visually.",
    );
    flags.push("brief_bottom_phase");
    reviewFocus.push("Clinician may review squat depth during descent.");
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (loweringPct > 0 && loweringPct < LOWERING_PHASE_LOW_PCT) {
    signals.push(
      "Lowering phase was brief relative to capture — descent timing may require clinician review.",
    );
    flags.push("brief_lowering_phase");
    reviewFocus.push("Clinician may review squat depth during descent.");
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT && standingPct > 40) {
    signals.push(
      "Rising phase was brief relative to standing — ascent strategy may require clinician review.",
    );
    flags.push("brief_rising_phase");
    reviewFocus.push("Clinician may review trunk strategy during ascent.");
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  const allMeaningful =
    loweringPct >= MEANINGFUL_PHASE_PCT &&
    bottomPct >= MEANINGFUL_PHASE_PCT &&
    risingPct >= MEANINGFUL_PHASE_PCT;

  if (allMeaningful) {
    signals.push(
      "Standing, lowering, bottom, and rising phases were observed across capture.",
    );
    return {
      label: "Consistent",
      signals,
      flags,
      reviewFocus: [
        "Clinician may review squat depth during descent.",
        "Clinician may review knee alignment during the squat cycle.",
        "Clinician may review trunk strategy during ascent.",
      ],
    };
  }

  if (loweringPresent && bottomPresent && risingPresent) {
    signals.push(
      "Core mini squat phases were captured — distribution may still warrant clinician review.",
    );
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus: [
        "Clinician may review squat depth during descent.",
        "Clinician may review knee alignment during the squat cycle.",
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

function resolveCycleDetectionClarity(
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
    signals.push("Recorded squat cycle boundaries appeared clear in capture.");
    return {
      label: "Clear",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (unclearRatio <= 0.2) {
    signals.push(
      "Most squat cycle boundaries were captured — a small number may require clinician review.",
    );
    reviewFocus.push(
      "Review unclear cycles to confirm whether boundaries reflect true movement or capture gaps.",
    );
    return {
      label: "Mostly clear",
      signals,
      flags: unclearReps > 0 ? ["some_unclear_reps"] : [],
      reviewFocus,
    };
  }

  signals.push(
    "Several squat cycle boundaries were unclear in capture — clinician may confirm cycle completion visually.",
  );
  reviewFocus.push(
    "Review unclear cycles to confirm whether boundaries reflect true movement or capture gaps.",
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

function hasEnoughData(input: BuildMiniSquatMovementQualitySignalsInput): boolean {
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
 * Build movement quality signals for Mini Squat sessions.
 * Returns null for non–mini-squat exercises or when insufficient evidence exists.
 */
export function buildMiniSquatMovementQualitySignals(
  input: BuildMiniSquatMovementQualitySignalsInput = {},
): MiniSquatMovementQualitySignals | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== MINI_SQUAT_EXERCISE_ID) return null;
  if (!hasEnoughData(input)) return null;

  const completeReps = nonNegativeInt(input.completeReps);
  const unclearReps = nonNegativeInt(input.unclearReps);
  const evidenceMode = input.evidenceMode ?? null;

  return buildMiniSquatMovementQualitySignalsFromParts({
    repTimings: input.repTimings,
    phaseRatios: input.phaseRatios,
    completeReps,
    unclearReps,
    clinicianFlags: input.clinicianFlags,
    summaryLabel: input.summaryLabel,
    evidenceMode,
    pacing: resolvePacingConsistency(input.repTimings, evidenceMode),
    phase: resolvePhaseConsistency(input.phaseRatios, evidenceMode),
    completion: resolveCycleDetectionClarity(
      completeReps,
      unclearReps,
      input.clinicianFlags,
    ),
  });
}

function buildMiniSquatMovementQualitySignalsFromParts(input: {
  repTimings?: MiniSquatMotionPilotRepTimings | null;
  phaseRatios?: MiniSquatMotionPilotPhaseRatios | null;
  completeReps: number;
  unclearReps: number;
  clinicianFlags?: string[] | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
  evidenceMode?: MsPilotEvidenceMode | null;
  pacing: ReturnType<typeof resolvePacingConsistency>;
  phase: ReturnType<typeof resolvePhaseConsistency>;
  completion: ReturnType<typeof resolveCycleDetectionClarity>;
}): MiniSquatMovementQualitySignals {
  const qualitySignals = dedupeStrings([
    ...input.pacing.signals,
    ...input.phase.signals,
    ...input.completion.signals,
  ]);

  const clinicianReviewFocus = dedupeStrings([
    ...input.pacing.reviewFocus,
    ...input.phase.reviewFocus,
    ...input.completion.reviewFocus,
  ]);

  const qualityFlags = dedupeStrings([
    ...input.pacing.flags,
    ...input.phase.flags,
    ...input.completion.flags,
    ...(hasFlag(input.clinicianFlags, "pose_tracking_interrupted")
      ? ["pose_tracking_interrupted"]
      : []),
    ...(hasFlag(input.clinicianFlags, "incomplete_cycle")
      ? ["incomplete_cycle"]
      : []),
    ...(input.summaryLabel === "Limited visibility" ? ["limited_visibility"] : []),
  ]);

  return {
    averageCycleIntervalSec: input.repTimings?.avgS ?? null,
    fastestCycleIntervalSec: input.repTimings?.fastestS ?? null,
    slowestCycleIntervalSec: input.repTimings?.slowestS ?? null,
    timingRangeSec: input.pacing.timingRangeSec,
    pacingConsistency: input.pacing.label,
    phaseConsistency: input.phase.label,
    cycleDetectionClarity: input.completion.label,
    observedStandingPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.standing ?? null,
    observedLoweringPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.lowering ?? null,
    observedBottomPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.bottom ?? null,
    observedRisingPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.rising ?? null,
    qualitySignals,
    clinicianReviewFocus,
    qualityFlags,
  };
}

/** Map mini squat signals to the shared movement quality display shape. */
export function miniSquatSignalsToMovementQuality(
  signals: MiniSquatMovementQualitySignals,
): MovementQualitySignals {
  return {
    averageRepTimeSec: signals.averageCycleIntervalSec,
    fastestRepTimeSec: signals.fastestCycleIntervalSec,
    slowestRepTimeSec: signals.slowestCycleIntervalSec,
    timingRangeSec: signals.timingRangeSec,
    pacingConsistency: signals.pacingConsistency,
    phaseConsistency: signals.phaseConsistency,
    completionClarity: signals.cycleDetectionClarity,
    observedStandingPhaseRatio: signals.observedStandingPhaseRatio,
    observedReturningPhaseRatio: signals.observedLoweringPhaseRatio,
    qualitySignals: signals.qualitySignals,
    clinicianReviewFocus: signals.clinicianReviewFocus,
    qualityFlags: signals.qualityFlags,
  };
}
