/**
 * Biomechanical Contribution Review - rules-based Step Up interpretation.
 * Educational clinician prompts only. No diagnosis, weakness, or treatment advice.
 */

import type { ExerciseKinesiologyContext } from "@/app/lib/cv/exercise-kinesiology-context";
import type { FunctionalReachMovementQualitySignals } from "@/app/lib/cv/functional-reach-movement-quality-signals";
import type { FunctionalReachMotionPilotPhaseRatios } from "@/app/lib/cv/functional-reach-motion-pilot-record";
import {
  FUNCTIONAL_REACH_CYCLE_TIMING_ESTIMATED_NOTE,
  FUNCTIONAL_REACH_LIMITED_MOTION_EVIDENCE_LABEL,
  type FrPilotEvidenceMode,
} from "@/app/lib/cv/functional-reach-motion-pilot-record";
import type {
  MotionAnalysisSummaryLabel,
  MotionAnalysisVisibilityRatios,
} from "@/app/lib/cv/motion-analysis-report";

const FUNCTIONAL_REACH_EXERCISE_ID = "functional-reach";

const REACHING_FORWARD_PHASE_LOW_PCT = 15;
const RETURNING_PHASE_LOW_PCT = 15;
const VISIBILITY_LOW_PCT = 50;

export type FunctionalReachBiomechanicalContributionReview = {
  observedMovementPattern: string[];
  possibleContributors: string[];
  muscleDemandContext: string[];
  clinicianReviewPrompts: string[];
  reviewFlags: string[];
};

export type BuildFunctionalReachBiomechanicalContributionReviewInput = {
  exerciseId?: string | null;
  evidenceMode?: FrPilotEvidenceMode | null;
  phaseRatios?: FunctionalReachMotionPilotPhaseRatios | null;
  movementQuality?: FunctionalReachMovementQualitySignals | null;
  clinicianFlags?: string[] | null;
  kinesiologyContext?: ExerciseKinesiologyContext | null;
  trackingQuality?: string | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
  visibilityRatios?: MotionAnalysisVisibilityRatios | null;
};

const FUNCTIONAL_REACH_POSSIBLE_CONTRIBUTORS = [
  "Reach strategy",
  "Trunk control",
  "Balance strategy",
  "Return control",
  "Reach attempt cycle transition consistency",
] as const;

const FUNCTIONAL_REACH_MUSCLE_DEMAND_CONTEXT = [
  "Ankle strategy demand during reaching forward - clinician may review balance strategy; cannot be confirmed from camera data alone.",
  "Hip strategy demand during peak reach - clinician may review reach strategy; cannot be confirmed from camera data alone.",
  "Core stabilizer demand during return - clinician may review trunk control; cannot be confirmed from camera data alone.",
  "Shoulder/scapular contribution as context only during reach - cannot be confirmed from camera data alone.",
] as const;

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function phasePct(
  phaseRatios: FunctionalReachMotionPilotPhaseRatios | null | undefined,
  phase: keyof FunctionalReachMotionPilotPhaseRatios,
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
  evidenceMode: FrPilotEvidenceMode | null | undefined;
  phaseRatios: FunctionalReachMotionPilotPhaseRatios | null | undefined;
  movementQuality: FunctionalReachMovementQualitySignals | null | undefined;
}): string[] {
  const patterns: string[] = [];
  const { movementQuality, phaseRatios, evidenceMode } = input;

  if (evidenceMode === "synthesized") {
    return [
      FUNCTIONAL_REACH_LIMITED_MOTION_EVIDENCE_LABEL,
      FUNCTIONAL_REACH_CYCLE_TIMING_ESTIMATED_NOTE,
    ];
  }

  if (movementQuality?.pacingConsistency === "Variable") {
    patterns.push("Variable lateral step cycle pacing observed across captured repetitions.");
  } else if (movementQuality?.pacingConsistency === "Consistent") {
    patterns.push("Relatively consistent lateral step cycle pacing observed across captured cycles.");
  } else if (movementQuality?.pacingConsistency === "Moderate") {
    patterns.push("Moderate lateral step cycle pacing variation observed across captured cycles.");
  }

  for (const line of [
    formatPhasePct(phasePct(phaseRatios, "standing"), "Standing / baseline"),
    formatPhasePct(phasePct(phaseRatios, "reaching_forward"), "Reaching forward"),
    formatPhasePct(phasePct(phaseRatios, "peak_reach"), "Peak reach"),
    formatPhasePct(phasePct(phaseRatios, "returning"), "Returning"),
  ]) {
    if (line) patterns.push(line);
  }

  if (movementQuality?.phaseConsistency === "Incomplete") {
    patterns.push(
      "Observed pattern may suggest incomplete phase capture across one or more lateral step cycles.",
    );
  }

  if (movementQuality?.cycleDetectionClarity === "Unclear") {
    patterns.push(
      "Some lateral step cycle boundaries were unclear - movement pattern continuity may require clinician review.",
    );
  }

  if (patterns.length === 0) {
    patterns.push(
      "Phase distribution not available for this session - clinician may assess lateral step pattern visually.",
    );
  }

  return patterns;
}

function buildPossibleContributors(input: {
  phaseRatios: FunctionalReachMotionPilotPhaseRatios | null | undefined;
  movementQuality: FunctionalReachMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
}): string[] {
  const contributors = new Set<string>(FUNCTIONAL_REACH_POSSIBLE_CONTRIBUTORS);
  const stepAscentPct = phasePct(input.phaseRatios, "reaching_forward") ?? 0;
  const stepDescentPct = phasePct(input.phaseRatios, "returning") ?? 0;

  if (
    input.movementQuality?.pacingConsistency === "Variable" ||
    hasFlag(input.clinicianFlags, "incomplete_cycle") ||
    input.movementQuality?.phaseConsistency === "Incomplete"
  ) {
    contributors.add("Lateral step cycle transition consistency");
  }

  if (stepAscentPct > 0 && stepAscentPct < REACHING_FORWARD_PHASE_LOW_PCT) {
    contributors.add("Weight-shift control");
  }

  if (stepDescentPct > 0 && stepDescentPct < RETURNING_PHASE_LOW_PCT) {
    contributors.add("Return-to-center control");
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    contributors.add("Lateral loading strategy");
  }

  return [...contributors];
}

function buildMuscleDemandContext(input: {
  phaseRatios: FunctionalReachMotionPilotPhaseRatios | null | undefined;
  movementQuality: FunctionalReachMovementQualitySignals | null | undefined;
}): string[] {
  const context: string[] = [...FUNCTIONAL_REACH_MUSCLE_DEMAND_CONTEXT];
  const stepAscentPct = phasePct(input.phaseRatios, "reaching_forward") ?? 0;
  const stepDescentPct = phasePct(input.phaseRatios, "returning") ?? 0;

  if (stepAscentPct > 0 && stepAscentPct < REACHING_FORWARD_PHASE_LOW_PCT) {
    context.push(
      "Observed brief lateral shift phase - clinician may assess whether weight-shift timing contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (stepDescentPct > 0 && stepDescentPct < RETURNING_PHASE_LOW_PCT) {
    context.push(
      "Observed brief return-to-center phase - clinician may assess whether return control contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    context.push(
      "Variable pacing may reflect changes in movement strategy across repetitions - clinician may assess whether lateral loading strategy or capture timing contributed.",
    );
  }

  return dedupeStrings(context);
}

function buildClinicianReviewPrompts(input: {
  evidenceMode: FrPilotEvidenceMode | null | undefined;
  movementQuality: FunctionalReachMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  kinesiologyContext: ExerciseKinesiologyContext | null | undefined;
  limitedVisibility: boolean;
}): string[] {
  const prompts: string[] =
    input.evidenceMode === "synthesized"
      ? [
          "Clinician may review lateral loading strategy - phase timing cannot be confirmed from limited motion evidence.",
          "Clinician may review step width consistency - cannot be confirmed from camera data alone.",
          "Clinician may review weight-shift control across cycles.",
          "Clinician may review return-to-center control - cannot be confirmed from camera data alone.",
        ]
      : [
          "Clinician may review lateral loading strategy alongside camera-derived phase evidence.",
          "Clinician may review step width consistency across repetitions.",
          "Clinician may review weight-shift control during lateral movement.",
          "Clinician may review return-to-center control after each step.",
        ];

  if (input.movementQuality?.clinicianReviewFocus) {
    prompts.push(...input.movementQuality.clinicianReviewFocus);
  }

  if (input.kinesiologyContext?.clinicianObservationGuide) {
    prompts.push(...input.kinesiologyContext.clinicianObservationGuide.slice(0, 2));
  }

  if (hasFlag(input.clinicianFlags, "incomplete_cycle")) {
    prompts.push(
      "Clinician may review whether incomplete cycles reflect true movement interruption or capture boundary limits.",
    );
  }

  if (hasFlag(input.clinicianFlags, "pose_tracking_interrupted")) {
    prompts.push(
      "Pose tracking interruption was noted - phase-based interpretation may require re-capture or visual confirmation.",
    );
  }

  if (input.limitedVisibility) {
    prompts.push(
      "Limited camera visibility may reduce phase-based interpretation - clinician may confirm movement pattern visually.",
    );
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    prompts.push(
      "Clinician may review pacing consistency across lateral step cycles during the clinical encounter.",
    );
  }

  return dedupeStrings(prompts);
}

function buildReviewFlags(input: {
  movementQuality: FunctionalReachMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  limitedVisibility: boolean;
}): string[] {
  const flags = new Set<string>(input.clinicianFlags ?? []);
  if (input.movementQuality?.qualityFlags) {
    for (const flag of input.movementQuality.qualityFlags) {
      flags.add(flag);
    }
  }
  if (input.limitedVisibility) flags.add("limited_visibility");
  return [...flags].sort();
}

export function buildFunctionalReachBiomechanicalContributionReview(
  input: BuildFunctionalReachBiomechanicalContributionReviewInput = {},
): FunctionalReachBiomechanicalContributionReview | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== FUNCTIONAL_REACH_EXERCISE_ID) return null;

  const limitedVisibility = isLimitedVisibility(
    input.trackingQuality,
    input.summaryLabel,
    input.visibilityRatios,
  );

  return {
    observedMovementPattern: buildObservedMovementPattern({
      evidenceMode: input.evidenceMode,
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
      evidenceMode: input.evidenceMode,
      movementQuality: input.movementQuality,
      clinicianFlags: input.clinicianFlags,
      kinesiologyContext: input.kinesiologyContext,
      limitedVisibility,
    }),
    reviewFlags: buildReviewFlags({
      movementQuality: input.movementQuality,
      clinicianFlags: input.clinicianFlags,
      limitedVisibility,
    }),
  };
}
