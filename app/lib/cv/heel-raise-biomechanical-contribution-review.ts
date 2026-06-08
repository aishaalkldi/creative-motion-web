/**
 * Biomechanical Contribution Review — rules-based Heel Raise interpretation.
 * Educational clinician prompts only. No diagnosis, weakness, or treatment advice.
 */

import type { ExerciseKinesiologyContext } from "@/app/lib/cv/exercise-kinesiology-context";
import type { HeelRaiseMovementQualitySignals } from "@/app/lib/cv/heel-raise-movement-quality-signals";
import type { HeelRaiseMotionPilotPhaseRatios } from "@/app/lib/cv/heel-raise-motion-pilot-record";
import {
  HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE,
  HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL,
  type HrPilotEvidenceMode,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
import type {
  MotionAnalysisSummaryLabel,
  MotionAnalysisVisibilityRatios,
} from "@/app/lib/cv/motion-analysis-report";

const HEEL_RAISE_EXERCISE_ID = "heel-raise";

const RISING_PHASE_LOW_PCT = 15;
const LOWERING_PHASE_LOW_PCT = 15;
const VISIBILITY_LOW_PCT = 50;

export type HeelRaiseBiomechanicalContributionReview = {
  observedMovementPattern: string[];
  possibleContributors: string[];
  muscleDemandContext: string[];
  clinicianReviewPrompts: string[];
  reviewFlags: string[];
};

export type BuildHeelRaiseBiomechanicalContributionReviewInput = {
  exerciseId?: string | null;
  evidenceMode?: HrPilotEvidenceMode | null;
  phaseRatios?: HeelRaiseMotionPilotPhaseRatios | null;
  movementQuality?: HeelRaiseMovementQualitySignals | null;
  clinicianFlags?: string[] | null;
  kinesiologyContext?: ExerciseKinesiologyContext | null;
  trackingQuality?: string | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
  visibilityRatios?: MotionAnalysisVisibilityRatios | null;
};

const HEEL_RAISE_POSSIBLE_CONTRIBUTORS = [
  "Heel raise height strategy",
  "Lowering control during descent",
  "Ankle stability during plantarflexion",
  "Foot and balance control",
  "Heel raise cycle transition consistency",
] as const;

const HEEL_RAISE_MUSCLE_DEMAND_CONTEXT = [
  "Gastrocnemius demand during plantarflexion — clinician may assess heel raise height visually; calf strength cannot be confirmed from camera data alone.",
  "Soleus demand during sustained heel raise — observed pattern may suggest endurance strategy worth review.",
  "Tibialis posterior and ankle stabilizer demand — ankle stability cannot be confirmed from camera data alone.",
  "Intrinsic foot stabilizer demand — foot control cannot be confirmed from camera data alone.",
] as const;

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function phasePct(
  phaseRatios: HeelRaiseMotionPilotPhaseRatios | null | undefined,
  phase: keyof HeelRaiseMotionPilotPhaseRatios,
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
  evidenceMode: HrPilotEvidenceMode | null | undefined;
  phaseRatios: HeelRaiseMotionPilotPhaseRatios | null | undefined;
  movementQuality: HeelRaiseMovementQualitySignals | null | undefined;
}): string[] {
  const patterns: string[] = [];
  const { movementQuality, phaseRatios, evidenceMode } = input;

  if (evidenceMode === "synthesized") {
    return [
      HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL,
      HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE,
    ];
  }

  if (movementQuality?.pacingConsistency === "Variable") {
    patterns.push("Variable heel raise cycle pacing observed across captured repetitions.");
  } else if (movementQuality?.pacingConsistency === "Consistent") {
    patterns.push("Relatively consistent heel raise cycle pacing observed across captured cycles.");
  } else if (movementQuality?.pacingConsistency === "Moderate") {
    patterns.push("Moderate heel raise cycle pacing variation observed across captured cycles.");
  }

  for (const line of [
    formatPhasePct(phasePct(phaseRatios, "standing"), "Standing / baseline"),
    formatPhasePct(phasePct(phaseRatios, "rising"), "Rising"),
    formatPhasePct(phasePct(phaseRatios, "peak_raise"), "Peak raise"),
    formatPhasePct(phasePct(phaseRatios, "lowering"), "Lowering"),
  ]) {
    if (line) patterns.push(line);
  }

  if (movementQuality?.phaseConsistency === "Incomplete") {
    patterns.push(
      "Observed pattern may suggest incomplete phase capture across one or more heel raise cycles.",
    );
  }

  if (movementQuality?.cycleDetectionClarity === "Unclear") {
    patterns.push(
      "Some heel raise cycle boundaries were unclear — movement pattern continuity may require clinician review.",
    );
  }

  if (patterns.length === 0) {
    patterns.push(
      "Phase distribution not available for this session — clinician may assess heel raise pattern visually.",
    );
  }

  return patterns;
}

function buildPossibleContributors(input: {
  phaseRatios: HeelRaiseMotionPilotPhaseRatios | null | undefined;
  movementQuality: HeelRaiseMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
}): string[] {
  const contributors = new Set<string>(HEEL_RAISE_POSSIBLE_CONTRIBUTORS);
  const risingPct = phasePct(input.phaseRatios, "rising") ?? 0;
  const loweringPct = phasePct(input.phaseRatios, "lowering") ?? 0;

  if (
    input.movementQuality?.pacingConsistency === "Variable" ||
    hasFlag(input.clinicianFlags, "incomplete_cycle") ||
    input.movementQuality?.phaseConsistency === "Incomplete"
  ) {
    contributors.add("Heel raise cycle transition consistency");
  }

  if (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT) {
    contributors.add("Heel raise height strategy");
  }

  if (loweringPct > 0 && loweringPct < LOWERING_PHASE_LOW_PCT) {
    contributors.add("Lowering control during descent");
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    contributors.add("Foot and balance control");
  }

  return [...contributors];
}

function buildMuscleDemandContext(input: {
  phaseRatios: HeelRaiseMotionPilotPhaseRatios | null | undefined;
  movementQuality: HeelRaiseMovementQualitySignals | null | undefined;
}): string[] {
  const context: string[] = [...HEEL_RAISE_MUSCLE_DEMAND_CONTEXT];
  const risingPct = phasePct(input.phaseRatios, "rising") ?? 0;
  const loweringPct = phasePct(input.phaseRatios, "lowering") ?? 0;

  if (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT) {
    context.push(
      "Observed brief rising phase — clinician may assess whether heel raise height or ascent timing contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (loweringPct > 0 && loweringPct < LOWERING_PHASE_LOW_PCT) {
    context.push(
      "Observed brief lowering phase — clinician may assess whether descent control or eccentric timing contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    context.push(
      "Variable pacing may reflect changes in movement strategy across repetitions — clinician may assess whether balance tolerance or capture timing contributed.",
    );
  }

  return dedupeStrings(context);
}

function buildClinicianReviewPrompts(input: {
  evidenceMode: HrPilotEvidenceMode | null | undefined;
  movementQuality: HeelRaiseMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  kinesiologyContext: ExerciseKinesiologyContext | null | undefined;
  limitedVisibility: boolean;
}): string[] {
  const prompts: string[] =
    input.evidenceMode === "synthesized"
      ? [
          "Clinician may review heel raise height using visual observation — phase timing cannot be confirmed from limited motion evidence.",
          "Clinician may review lowering control during descent — cannot be confirmed from camera data alone.",
          "Clinician may review ankle stability and foot control across cycles.",
        ]
      : [
          "Clinician may review heel raise height using visual observation alongside camera-derived phase evidence.",
          "Clinician may review lowering control during descent — cannot be confirmed from camera data alone.",
          "Clinician may review ankle stability during plantarflexion — cannot be confirmed from camera data alone.",
          "Observed pattern may suggest movement strategy variation — cannot be confirmed from camera data alone.",
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
      "Clinician may review pacing consistency across heel raise cycles during the clinical encounter.",
    );
  }

  return dedupeStrings(prompts);
}

function buildReviewFlags(input: {
  movementQuality: HeelRaiseMovementQualitySignals | null | undefined;
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

export function buildHeelRaiseBiomechanicalContributionReview(
  input: BuildHeelRaiseBiomechanicalContributionReviewInput = {},
): HeelRaiseBiomechanicalContributionReview | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== HEEL_RAISE_EXERCISE_ID) return null;

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
