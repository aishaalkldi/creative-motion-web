/**
 * Biomechanical Contribution Review — rules-based STS interpretation from
 * existing phase and movement quality evidence. Educational clinician prompts only.
 * No diagnosis, weakness claims, activation inference, or treatment advice.
 */

import type { ExerciseKinesiologyContext } from "@/app/lib/cv/exercise-kinesiology-context";
import type { MovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";
import type {
  MotionAnalysisPhaseRatios,
  MotionAnalysisSummaryLabel,
  MotionAnalysisVisibilityRatios,
} from "@/app/lib/cv/motion-analysis-report";

const STS_EXERCISE_ID = "sit-to-stand";

const RETURNING_PHASE_LOW_PCT = 15;
const RISING_PHASE_LOW_PCT = 15;
const VISIBILITY_LOW_PCT = 50;

export type BiomechanicalContributionReview = {
  observedMovementPattern: string[];
  possibleContributors: string[];
  muscleDemandContext: string[];
  clinicianReviewPrompts: string[];
  reviewFlags: string[];
};

export type BuildBiomechanicalContributionReviewInput = {
  exerciseId?: string | null;
  phaseRatios?: MotionAnalysisPhaseRatios | null;
  movementQuality?: MovementQualitySignals | null;
  clinicianFlags?: string[] | null;
  kinesiologyContext?: ExerciseKinesiologyContext | null;
  trackingQuality?: string | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
  visibilityRatios?: MotionAnalysisVisibilityRatios | null;
};

const STS_MUSCLE_DEMAND_CONTEXT = [
  "Quadriceps demand during rising — clinician may assess knee extension strategy visually.",
  "Hip extensor demand during rising — observed pattern may suggest hip extension contribution worth review.",
  "Core stabilizer demand during transition — trunk control during rise and lowering cannot be confirmed from camera data alone.",
  "Eccentric quadriceps demand during return to sitting — lowering phase may require clinician assessment of controlled descent.",
] as const;

const STS_POSSIBLE_CONTRIBUTORS = [
  "Lower-limb force production strategy",
  "Trunk contribution during rising",
  "Eccentric lowering control",
  "Sit-to-stand transition consistency",
] as const;

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function phasePct(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  phase: keyof MotionAnalysisPhaseRatios,
): number | null {
  const value = phaseRatios?.[phase];
  return typeof value === "number" && value > 0 ? value : null;
}

function formatPhasePct(pct: number | null, label: string): string | null {
  if (pct === null) return null;
  return `${label} phase represented ${pct}% of captured snapshots.`;
}

function isLimitedVisibility(
  trackingQuality: string | null | undefined,
  summaryLabel: MotionAnalysisSummaryLabel | null | undefined,
  visibilityRatios: MotionAnalysisVisibilityRatios | null | undefined,
): boolean {
  const signal = trackingQuality?.trim().toLowerCase();
  if (summaryLabel === "Limited visibility") return true;
  if (signal === "poor" || signal === "lost" || signal === "unknown") return true;

  if (!visibilityRatios) return false;
  return (
    visibilityRatios.hip < VISIBILITY_LOW_PCT &&
    visibilityRatios.knee < VISIBILITY_LOW_PCT &&
    visibilityRatios.ankle < VISIBILITY_LOW_PCT
  );
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

function buildObservedMovementPattern(input: {
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined;
  movementQuality: MovementQualitySignals | null | undefined;
}): string[] {
  const patterns: string[] = [];
  const { movementQuality, phaseRatios } = input;

  if (movementQuality?.pacingConsistency === "Variable") {
    patterns.push("Variable pacing observed across captured repetitions.");
  } else if (movementQuality?.pacingConsistency === "Consistent") {
    patterns.push("Relatively consistent repetition pacing observed across captured cycles.");
  } else if (movementQuality?.pacingConsistency === "Moderate") {
    patterns.push("Moderate repetition pacing variation observed across captured cycles.");
  }

  const risingLine = formatPhasePct(phasePct(phaseRatios, "rising"), "Rising");
  const standingLine = formatPhasePct(phasePct(phaseRatios, "standing"), "Standing");
  const returningLine = formatPhasePct(phasePct(phaseRatios, "returning"), "Returning");
  const seatedLine = formatPhasePct(phasePct(phaseRatios, "seated"), "Seated");

  for (const line of [risingLine, standingLine, returningLine, seatedLine]) {
    if (line) patterns.push(line);
  }

  if (movementQuality?.phaseConsistency === "Incomplete") {
    patterns.push(
      "Observed pattern may suggest incomplete phase capture across one or more cycles.",
    );
  }

  if (movementQuality?.completionClarity === "Unclear") {
    patterns.push(
      "Some repetition boundaries were unclear — movement pattern continuity may require clinician review.",
    );
  }

  if (patterns.length === 0) {
    patterns.push(
      "Phase distribution not available for this session — clinician may assess movement pattern visually.",
    );
  }

  return patterns;
}

function buildPossibleContributors(input: {
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined;
  movementQuality: MovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
}): string[] {
  const contributors = new Set<string>(STS_POSSIBLE_CONTRIBUTORS);
  const risingPct = phasePct(input.phaseRatios, "rising") ?? 0;
  const returningPct = phasePct(input.phaseRatios, "returning") ?? 0;

  if (
    input.movementQuality?.pacingConsistency === "Variable" ||
    hasFlag(input.clinicianFlags, "incomplete_cycle") ||
    input.movementQuality?.phaseConsistency === "Incomplete"
  ) {
    contributors.add("Sit-to-stand transition consistency");
  }

  if (
    risingPct > 0 &&
    risingPct < RISING_PHASE_LOW_PCT
  ) {
    contributors.add("Trunk contribution during rising");
  }

  if (
    returningPct > 0 &&
    returningPct < RETURNING_PHASE_LOW_PCT
  ) {
    contributors.add("Eccentric lowering control");
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    contributors.add("Lower-limb force production strategy");
  }

  return [...contributors];
}

function buildMuscleDemandContext(input: {
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined;
  movementQuality: MovementQualitySignals | null | undefined;
}): string[] {
  const context: string[] = [...STS_MUSCLE_DEMAND_CONTEXT];
  const risingPct = phasePct(input.phaseRatios, "rising") ?? 0;
  const returningPct = phasePct(input.phaseRatios, "returning") ?? 0;

  if (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT) {
    context.push(
      "Observed brief rising phase relative to standing — clinician may assess whether trunk lean or lower-limb strategy contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (returningPct > 0 && returningPct < RETURNING_PHASE_LOW_PCT) {
    context.push(
      "Observed limited returning phase capture — eccentric lowering demand may require visual confirmation during descent to sitting.",
    );
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    context.push(
      "Variable pacing may reflect changes in movement strategy across repetitions — clinician may assess whether demand tolerance or capture timing contributed.",
    );
  }

  return dedupeStrings(context);
}

function buildClinicianReviewPrompts(input: {
  movementQuality: MovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  kinesiologyContext: ExerciseKinesiologyContext | null | undefined;
  limitedVisibility: boolean;
}): string[] {
  const prompts: string[] = [
    "Clinician may assess sit-to-stand strategy using visual observation alongside camera-derived phase evidence.",
    "Observed pattern may suggest movement strategy variation — cannot be confirmed from camera data alone.",
  ];

  if (input.movementQuality?.clinicianReviewFocus) {
    prompts.push(...input.movementQuality.clinicianReviewFocus);
  }

  if (input.kinesiologyContext?.clinicianObservationGuide) {
    prompts.push(...input.kinesiologyContext.clinicianObservationGuide.slice(0, 3));
  }

  if (hasFlag(input.clinicianFlags, "incomplete_cycle")) {
    prompts.push(
      "Clinician may review whether incomplete cycles reflect true movement interruption or capture boundary limits.",
    );
  }

  if (hasFlag(input.clinicianFlags, "pose_tracking_interrupted")) {
    prompts.push(
      "Pose tracking interruption was noted — phase-based interpretation may require re-capture or visual confirmation.",
    );
  }

  if (input.limitedVisibility) {
    prompts.push(
      "Limited camera visibility may reduce phase-based interpretation — clinician may confirm movement pattern visually.",
    );
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    prompts.push(
      "Consider whether timing variability may reflect movement strategy, hesitation, or capture limitation — cannot be confirmed from camera data alone.",
    );
  }

  return dedupeStrings(prompts);
}

function buildReviewFlags(input: {
  movementQuality: MovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  limitedVisibility: boolean;
  hasPhaseRatios: boolean;
}): string[] {
  const flags: string[] = [];

  if (!input.hasPhaseRatios) flags.push("legacy_phase_data_missing");
  if (input.limitedVisibility) flags.push("limited_visibility");
  if (hasFlag(input.clinicianFlags, "incomplete_cycle")) flags.push("incomplete_cycle");
  if (input.movementQuality?.qualityFlags.includes("variable_pacing")) {
    flags.push("variable_pacing");
  }
  if (input.movementQuality?.qualityFlags.includes("low_returning_phase")) {
    flags.push("low_returning_phase");
  }
  if (input.movementQuality?.qualityFlags.includes("incomplete_phases")) {
    flags.push("incomplete_phases");
  }

  return dedupeStrings(flags);
}

function hasEnoughData(input: BuildBiomechanicalContributionReviewInput): boolean {
  const completeReps =
    input.movementQuality != null ||
    (input.phaseRatios != null &&
      Object.values(input.phaseRatios).some(
        (ratio) => typeof ratio === "number" && ratio > 0,
      )) ||
    input.kinesiologyContext?.exerciseId === STS_EXERCISE_ID;

  return completeReps;
}

/**
 * Build biomechanical contribution review for Sit-to-Stand sessions.
 * Returns null for non-STS exercises or when insufficient evidence exists.
 */
export function buildBiomechanicalContributionReview(
  input: BuildBiomechanicalContributionReviewInput = {},
): BiomechanicalContributionReview | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== STS_EXERCISE_ID) return null;
  if (!hasEnoughData(input)) return null;

  const limitedVisibility = isLimitedVisibility(
    input.trackingQuality,
    input.summaryLabel,
    input.visibilityRatios,
  );

  const hasPhaseRatios =
    input.phaseRatios != null &&
    Object.values(input.phaseRatios).some(
      (ratio) => typeof ratio === "number" && ratio > 0,
    );

  return {
    observedMovementPattern: buildObservedMovementPattern({
      phaseRatios: input.phaseRatios,
      movementQuality: input.movementQuality,
    }),
    possibleContributors: buildPossibleContributors({
      phaseRatios: input.phaseRatios,
      movementQuality: input.movementQuality,
      clinicianFlags: input.clinicianFlags,
    }),
    muscleDemandContext: buildMuscleDemandContext({
      phaseRatios: input.phaseRatios,
      movementQuality: input.movementQuality,
    }),
    clinicianReviewPrompts: buildClinicianReviewPrompts({
      movementQuality: input.movementQuality,
      clinicianFlags: input.clinicianFlags,
      kinesiologyContext: input.kinesiologyContext,
      limitedVisibility,
    }),
    reviewFlags: buildReviewFlags({
      movementQuality: input.movementQuality,
      clinicianFlags: input.clinicianFlags,
      limitedVisibility,
      hasPhaseRatios,
    }),
  };
}
