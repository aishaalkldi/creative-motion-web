/**
 * Movement Quality Signals — deterministic Step Up movement quality summary.
 * No diagnosis, clinical scoring, treatment advice, or weakness claims.
 */

import type {
  StepUpMotionPilotPhaseRatios,
  StepUpMotionPilotRepTimings,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import type { MotionAnalysisSummaryLabel } from "@/app/lib/cv/motion-analysis-report";
import {
  STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE,
  STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL,
  type SuPilotEvidenceMode,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import type {
  CompletionClarityLabel,
  MovementQualitySignals,
  PacingConsistencyLabel,
  PhaseConsistencyLabel,
} from "@/app/lib/cv/movement-quality-signals";

const STEP_UP_EXERCISE_ID = "step-up";

const REP_TIMING_SPREAD_MIN_S = 1;
const STEP_ASCENT_PHASE_LOW_PCT = 15;
const STEP_DESCENT_PHASE_LOW_PCT = 15;
const TOP_POSITION_PHASE_LOW_PCT = 10;
const UNKNOWN_PHASE_HIGH_PCT = 25;
const REST_PHASE_HIGH_PCT = 40;
const DOMINANT_PHASE_PCT = 50;
const MEANINGFUL_PHASE_PCT = 5;

export type StepUpMovementQualitySignals = {
  averageCycleIntervalSec: number | null;
  fastestCycleIntervalSec: number | null;
  slowestCycleIntervalSec: number | null;
  timingRangeSec: number | null;
  pacingConsistency: PacingConsistencyLabel;
  phaseConsistency: PhaseConsistencyLabel;
  cycleDetectionClarity: CompletionClarityLabel;
  observedStandingPhaseRatio: number | null;
  observedStepAscentPhaseRatio: number | null;
  observedTopPositionPhaseRatio: number | null;
  observedStepDescentPhaseRatio: number | null;
  qualitySignals: string[];
  clinicianReviewFocus: string[];
  qualityFlags: string[];
};

export type BuildStepUpMovementQualitySignalsInput = {
  exerciseId?: string | null;
  evidenceMode?: SuPilotEvidenceMode | null;
  repTimings?: StepUpMotionPilotRepTimings | null;
  phaseRatios?: StepUpMotionPilotPhaseRatios | null;
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
  phaseRatios: StepUpMotionPilotPhaseRatios | null | undefined,
  phase: keyof StepUpMotionPilotPhaseRatios,
): number {
  return phaseRatios?.[phase] ?? 0;
}

function resolvePacingConsistency(
  repTimings: StepUpMotionPilotRepTimings | null | undefined,
  evidenceMode: SuPilotEvidenceMode | null | undefined,
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
        signals: [STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE],
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
    signals.push("Heel raise cycle pacing varied across the session.");
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
    signals.push("Heel raise cycle pacing showed moderate variation across the session.");
    reviewFocus.push("Review repetition-to-repetition pacing consistency.");
    return {
      label: "Moderate",
      timingRangeSec,
      signals,
      flags: [...flags, "moderate_pacing"],
      reviewFocus,
    };
  }

  signals.push("Heel raise cycle pacing appeared relatively consistent across captured cycles.");
  return {
    label: "Consistent",
    timingRangeSec,
    signals,
    flags,
    reviewFocus,
  };
}

function resolvePhaseConsistency(
  phaseRatios: StepUpMotionPilotPhaseRatios | null | undefined,
  evidenceMode: SuPilotEvidenceMode | null | undefined,
): {
  label: PhaseConsistencyLabel;
  signals: string[];
  flags: string[];
  reviewFocus: string[];
} {
  if (!phaseRatios || Object.values(phaseRatios).every((v) => !v || v === 0)) {
    const signals =
      evidenceMode === "synthesized"
        ? [STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL, STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE]
        : [
            "Phase distribution not available — clinician may assess step height strategy and descent control visually.",
          ];
    return {
      label: "Insufficient data",
      signals,
      flags: ["phase_insufficient"],
      reviewFocus:
        evidenceMode === "synthesized"
          ? []
          : ["Clinician may review step up height consistency across repetitions."],
    };
  }

  const stepAscentPct = phasePct(phaseRatios, "step_ascent");
  const topPositionPct = phasePct(phaseRatios, "top_position");
  const stepDescentPct = phasePct(phaseRatios, "step_descent");
  const standingPct = phasePct(phaseRatios, "standing");
  const unknownPct = phasePct(phaseRatios, "unknown");
  const restPct = phasePct(phaseRatios, "rest");
  const transitionDominant = unknownPct + restPct;

  const signals: string[] = [];
  const flags: string[] = [];
  const reviewFocus: string[] = [];

  const standingPresent = standingPct > 0;
  const stepAscentPresent = stepAscentPct > 0;
  const topPositionPresent = topPositionPct > 0;
  const stepDescentPresent = stepDescentPct > 0;

  if (!stepAscentPresent || !stepDescentPresent) {
    signals.push(
      "Camera-derived phase evidence may be incomplete — step ascent or step descent phases were not consistently captured.",
    );
    reviewFocus.push("Clinician may review step up height during ascent.");
    reviewFocus.push("Clinician may review descent control.");
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

  if (topPositionPct > 0 && topPositionPct < TOP_POSITION_PHASE_LOW_PCT) {
    signals.push(
      "Top step position was captured but may be under-represented — clinician may confirm step up height visually.",
    );
    flags.push("brief_top_position_phase");
    reviewFocus.push("Clinician may review step up height during ascent.");
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (stepDescentPct > 0 && stepDescentPct < STEP_DESCENT_PHASE_LOW_PCT) {
    signals.push(
      "Step descent phase was brief relative to capture — descent control may require clinician review.",
    );
    flags.push("brief_step_descent_phase");
    reviewFocus.push("Clinician may review descent control.");
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (stepAscentPct > 0 && stepAscentPct < STEP_ASCENT_PHASE_LOW_PCT && standingPct > 40) {
    signals.push(
      "Step ascent phase was brief relative to standing — ascent strategy may require clinician review.",
    );
    flags.push("brief_step_ascent_phase");
    reviewFocus.push("Clinician may review step up height during ascent.");
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus,
    };
  }

  const allMeaningful =
    stepAscentPct >= MEANINGFUL_PHASE_PCT &&
    topPositionPct >= MEANINGFUL_PHASE_PCT &&
    stepDescentPct >= MEANINGFUL_PHASE_PCT;

  if (allMeaningful) {
    signals.push(
      "Standing, step ascent, top position, and step descent phases were observed across capture.",
    );
    return {
      label: "Consistent",
      signals,
      flags,
      reviewFocus: [
        "Clinician may review step up height during ascent.",
        "Clinician may review descent control.",
        "Clinician may review limb loading strategy across cycles.",
      ],
    };
  }

  if (stepAscentPresent && topPositionPresent && stepDescentPresent) {
    signals.push(
      "Core step up phases were captured — distribution may still warrant clinician review.",
    );
    return {
      label: "Moderate",
      signals,
      flags,
      reviewFocus: [
        "Clinician may review step up height during ascent.",
        "Clinician may review descent control.",
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
    signals.push("Recorded step up cycle boundaries appeared clear in capture.");
    return {
      label: "Clear",
      signals,
      flags,
      reviewFocus,
    };
  }

  if (unclearRatio <= 0.2) {
    signals.push(
      "Most step up cycle boundaries were captured — a small number may require clinician review.",
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
    "Several step up cycle boundaries were unclear in capture — clinician may confirm cycle completion visually.",
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

function hasEnoughData(input: BuildStepUpMovementQualitySignalsInput): boolean {
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

export function buildStepUpMovementQualitySignals(
  input: BuildStepUpMovementQualitySignalsInput = {},
): StepUpMovementQualitySignals | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== STEP_UP_EXERCISE_ID) return null;
  if (!hasEnoughData(input)) return null;

  const completeReps = nonNegativeInt(input.completeReps);
  const unclearReps = nonNegativeInt(input.unclearReps);
  const evidenceMode = input.evidenceMode ?? null;

  return buildStepUpMovementQualitySignalsFromParts({
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

function buildStepUpMovementQualitySignalsFromParts(input: {
  repTimings?: StepUpMotionPilotRepTimings | null;
  phaseRatios?: StepUpMotionPilotPhaseRatios | null;
  completeReps: number;
  unclearReps: number;
  clinicianFlags?: string[] | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
  evidenceMode?: SuPilotEvidenceMode | null;
  pacing: ReturnType<typeof resolvePacingConsistency>;
  phase: ReturnType<typeof resolvePhaseConsistency>;
  completion: ReturnType<typeof resolveCycleDetectionClarity>;
}): StepUpMovementQualitySignals {
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
    observedStepAscentPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.step_ascent ?? null,
    observedTopPositionPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.top_position ?? null,
    observedStepDescentPhaseRatio:
      input.evidenceMode === "synthesized" ? null : input.phaseRatios?.step_descent ?? null,
    qualitySignals,
    clinicianReviewFocus,
    qualityFlags,
  };
}

export function stepUpSignalsToMovementQuality(
  signals: StepUpMovementQualitySignals,
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
    observedReturningPhaseRatio: signals.observedStepDescentPhaseRatio,
    qualitySignals: signals.qualitySignals,
    clinicianReviewFocus: signals.clinicianReviewFocus,
    qualityFlags: signals.qualityFlags,
  };
}
