/**
 * Biomechanical Contribution Review — rules-based Mini Squat interpretation.
 * Educational clinician prompts only. No diagnosis, weakness, or treatment advice.
 */

import type { ExerciseKinesiologyContext } from "@/app/lib/cv/exercise-kinesiology-context";
import type { MiniSquatMovementQualitySignals } from "@/app/lib/cv/mini-squat-movement-quality-signals";
import type { MiniSquatMotionPilotPhaseRatios } from "@/app/lib/cv/mini-squat-motion-pilot-record";
import {
  MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE,
  MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL,
  type MsPilotEvidenceMode,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
import type {
  MotionAnalysisSummaryLabel,
  MotionAnalysisVisibilityRatios,
} from "@/app/lib/cv/motion-analysis-report";

const MINI_SQUAT_EXERCISE_ID = "mini-squat";

const LOWERING_PHASE_LOW_PCT = 15;
const RISING_PHASE_LOW_PCT = 15;
const VISIBILITY_LOW_PCT = 50;

export type MiniSquatBiomechanicalContributionReview = {
  observedMovementPattern: string[];
  possibleContributors: string[];
  muscleDemandContext: string[];
  clinicianReviewPrompts: string[];
  reviewFlags: string[];
};

export type BuildMiniSquatBiomechanicalContributionReviewInput = {
  exerciseId?: string | null;
  evidenceMode?: MsPilotEvidenceMode | null;
  phaseRatios?: MiniSquatMotionPilotPhaseRatios | null;
  movementQuality?: MiniSquatMovementQualitySignals | null;
  clinicianFlags?: string[] | null;
  kinesiologyContext?: ExerciseKinesiologyContext | null;
  trackingQuality?: string | null;
  summaryLabel?: MotionAnalysisSummaryLabel | null;
  visibilityRatios?: MotionAnalysisVisibilityRatios | null;
};

const MINI_SQUAT_POSSIBLE_CONTRIBUTORS = [
  "Squat depth strategy",
  "Knee alignment during descent and ascent",
  "Trunk strategy during the squat cycle",
  "Lower-limb loading consistency",
  "Squat cycle transition consistency",
] as const;

const MINI_SQUAT_MUSCLE_DEMAND_CONTEXT = [
  "Quadriceps demand during descent and ascent — clinician may assess knee control strategy visually.",
  "Gluteus maximus demand during hip extension — observed pattern may suggest hip strategy worth review.",
  "Gluteus medius demand for frontal-plane stability — knee alignment cannot be confirmed from camera data alone.",
  "Core stabilizer demand during squat transitions — trunk strategy cannot be confirmed from camera data alone.",
] as const;

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function phasePct(
  phaseRatios: MiniSquatMotionPilotPhaseRatios | null | undefined,
  phase: keyof MiniSquatMotionPilotPhaseRatios,
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
  evidenceMode: MsPilotEvidenceMode | null | undefined;
  phaseRatios: MiniSquatMotionPilotPhaseRatios | null | undefined;
  movementQuality: MiniSquatMovementQualitySignals | null | undefined;
}): string[] {
  const patterns: string[] = [];
  const { movementQuality, phaseRatios, evidenceMode } = input;

  if (evidenceMode === "synthesized") {
    return [
      MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL,
      MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE,
    ];
  }

  if (movementQuality?.pacingConsistency === "Variable") {
    patterns.push("Variable squat cycle pacing observed across captured repetitions.");
  } else if (movementQuality?.pacingConsistency === "Consistent") {
    patterns.push("Relatively consistent squat cycle pacing observed across captured cycles.");
  } else if (movementQuality?.pacingConsistency === "Moderate") {
    patterns.push("Moderate squat cycle pacing variation observed across captured cycles.");
  }

  for (const line of [
    formatPhasePct(phasePct(phaseRatios, "standing"), "Standing"),
    formatPhasePct(phasePct(phaseRatios, "lowering"), "Lowering"),
    formatPhasePct(phasePct(phaseRatios, "bottom"), "Bottom position"),
    formatPhasePct(phasePct(phaseRatios, "rising"), "Rising"),
  ]) {
    if (line) patterns.push(line);
  }

  if (movementQuality?.phaseConsistency === "Incomplete") {
    patterns.push(
      "Observed pattern may suggest incomplete phase capture across one or more squat cycles.",
    );
  }

  if (movementQuality?.cycleDetectionClarity === "Unclear") {
    patterns.push(
      "Some squat cycle boundaries were unclear — movement pattern continuity may require clinician review.",
    );
  }

  if (patterns.length === 0) {
    patterns.push(
      "Phase distribution not available for this session — clinician may assess squat pattern visually.",
    );
  }

  return patterns;
}

function buildPossibleContributors(input: {
  phaseRatios: MiniSquatMotionPilotPhaseRatios | null | undefined;
  movementQuality: MiniSquatMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
}): string[] {
  const contributors = new Set<string>(MINI_SQUAT_POSSIBLE_CONTRIBUTORS);
  const loweringPct = phasePct(input.phaseRatios, "lowering") ?? 0;
  const risingPct = phasePct(input.phaseRatios, "rising") ?? 0;

  if (
    input.movementQuality?.pacingConsistency === "Variable" ||
    hasFlag(input.clinicianFlags, "incomplete_cycle") ||
    input.movementQuality?.phaseConsistency === "Incomplete"
  ) {
    contributors.add("Squat cycle transition consistency");
  }

  if (loweringPct > 0 && loweringPct < LOWERING_PHASE_LOW_PCT) {
    contributors.add("Squat depth strategy");
  }

  if (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT) {
    contributors.add("Trunk strategy during the squat cycle");
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    contributors.add("Lower-limb loading consistency");
  }

  return [...contributors];
}

function buildMuscleDemandContext(input: {
  phaseRatios: MiniSquatMotionPilotPhaseRatios | null | undefined;
  movementQuality: MiniSquatMovementQualitySignals | null | undefined;
}): string[] {
  const context: string[] = [...MINI_SQUAT_MUSCLE_DEMAND_CONTEXT];
  const loweringPct = phasePct(input.phaseRatios, "lowering") ?? 0;
  const risingPct = phasePct(input.phaseRatios, "rising") ?? 0;

  if (loweringPct > 0 && loweringPct < LOWERING_PHASE_LOW_PCT) {
    context.push(
      "Observed brief lowering phase — clinician may assess whether squat depth or descent timing contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT) {
    context.push(
      "Observed brief rising phase — clinician may assess whether trunk strategy or ascent timing contributed; cannot be confirmed from camera data alone.",
    );
  }

  if (input.movementQuality?.pacingConsistency === "Variable") {
    context.push(
      "Variable pacing may reflect changes in movement strategy across repetitions — clinician may assess whether loading tolerance or capture timing contributed.",
    );
  }

  return dedupeStrings(context);
}

function buildClinicianReviewPrompts(input: {
  evidenceMode: MsPilotEvidenceMode | null | undefined;
  movementQuality: MiniSquatMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  kinesiologyContext: ExerciseKinesiologyContext | null | undefined;
  limitedVisibility: boolean;
}): string[] {
  const prompts: string[] =
    input.evidenceMode === "synthesized"
      ? [
          "Clinician may review squat depth using visual observation — phase timing cannot be confirmed from limited motion evidence.",
          "Clinician may review knee alignment during the squat cycle — cannot be confirmed from camera data alone.",
          "Clinician may review trunk strategy during descent and ascent.",
        ]
      : [
          "Clinician may review squat depth using visual observation alongside camera-derived phase evidence.",
          "Clinician may review knee alignment during the squat cycle — cannot be confirmed from camera data alone.",
          "Clinician may review trunk strategy during descent and ascent.",
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
      "Clinician may review pacing consistency across squat cycles during the clinical encounter.",
    );
  }

  return dedupeStrings(prompts);
}

function buildReviewFlags(input: {
  movementQuality: MiniSquatMovementQualitySignals | null | undefined;
  clinicianFlags: string[] | null | undefined;
  limitedVisibility: boolean;
  hasPhaseRatios: boolean;
}): string[] {
  const flags: string[] = [];

  if (!input.hasPhaseRatios) flags.push("phase_data_missing");
  if (input.limitedVisibility) flags.push("limited_visibility");
  if (hasFlag(input.clinicianFlags, "incomplete_cycle")) flags.push("incomplete_cycle");
  if (input.movementQuality?.qualityFlags.includes("variable_pacing")) {
    flags.push("variable_pacing");
  }
  if (input.movementQuality?.qualityFlags.includes("brief_lowering_phase")) {
    flags.push("brief_lowering_phase");
  }
  if (input.movementQuality?.qualityFlags.includes("incomplete_phases")) {
    flags.push("incomplete_phases");
  }

  return dedupeStrings(flags);
}

function hasEnoughData(input: BuildMiniSquatBiomechanicalContributionReviewInput): boolean {
  return (
    input.movementQuality != null ||
    (input.phaseRatios != null &&
      Object.values(input.phaseRatios).some(
        (ratio) => typeof ratio === "number" && ratio > 0,
      )) ||
    input.kinesiologyContext?.exerciseId === MINI_SQUAT_EXERCISE_ID
  );
}

/**
 * Build biomechanical contribution review for Mini Squat sessions.
 * Returns null for non–mini-squat exercises or when insufficient evidence exists.
 */
export function buildMiniSquatBiomechanicalContributionReview(
  input: BuildMiniSquatBiomechanicalContributionReviewInput = {},
): MiniSquatBiomechanicalContributionReview | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== MINI_SQUAT_EXERCISE_ID) return null;
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
      hasPhaseRatios,
    }),
  };
}
