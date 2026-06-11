/**
 * Sit-to-Stand biomechanical observation flags v1 — rules-based, clinician-facing only.
 * Generated only when CV evidence integrity is sufficient. No diagnosis, weakness claims,
 * scores, or treatment advice. Uses existing derived motion pilot / quality signals only.
 */

import type { CvEvidenceIntegrityGate } from "@/app/lib/cv/cv-evidence-integrity-gate";
import type { MovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";
import type {
  MotionAnalysisMotionPilotSummary,
  MotionAnalysisPhaseRatios,
} from "@/app/lib/cv/motion-analysis-report";

const STS_EXERCISE_ID = "sit-to-stand";

const RETURNING_PHASE_LOW_PCT = 15;
const RISING_PHASE_LOW_PCT = 15;
const STANDING_PHASE_LOW_PCT = 15;
const REP_TIMING_SPREAD_MIN_S = 1;

export const STS_BIOMECH_FLAG_DISCLAIMER =
  "This is camera-assisted movement evidence only and not a diagnosis.";

export const STS_BIOMECH_SECTION_NOTE =
  "Assistive sit-to-stand movement observations for clinician review — not a clinical score.";

export type StsBiomechanicalFlagId =
  | "possible_forward_trunk_flexion"
  | "possible_lateral_trunk_shift"
  | "possible_incomplete_standing"
  | "possible_fast_uncontrolled_lowering"
  | "limited_or_insufficient_evidence";

export type StsBiomechanicalFlagConfidence = "low" | "medium" | "high";

export type StsBiomechanicalFlag = {
  id: StsBiomechanicalFlagId;
  title: string;
  observedPattern: string;
  flaggedBecause: string;
  confidence: StsBiomechanicalFlagConfidence;
  clinicianReviewRequired: true;
  disclaimer: string;
};

export type StsBiomechanicalFlagsResult = {
  flags: StsBiomechanicalFlag[];
  sectionNote: string;
};

export type BuildStsBiomechanicalFlagsInput = {
  exerciseId?: string | null;
  evidenceIntegrity?: CvEvidenceIntegrityGate | null;
  smtPilot?: MotionAnalysisMotionPilotSummary | null;
  movementQuality?: MovementQualitySignals | null;
};

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function phasePct(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  phase: keyof MotionAnalysisPhaseRatios,
): number {
  const value = phaseRatios?.[phase];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function baseFlag(
  id: StsBiomechanicalFlagId,
  title: string,
  observedPattern: string,
  flaggedBecause: string,
  confidence: StsBiomechanicalFlagConfidence,
): StsBiomechanicalFlag {
  return {
    id,
    title,
    observedPattern,
    flaggedBecause,
    confidence,
    clinicianReviewRequired: true,
    disclaimer: STS_BIOMECH_FLAG_DISCLAIMER,
  };
}

function evaluateForwardTrunkFlexion(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): StsBiomechanicalFlag | null {
  const risingPct = phasePct(phaseRatios, "rising");
  const standingPct = phasePct(phaseRatios, "standing");
  const briefRising =
    hasFlag(movementQuality?.qualityFlags, "brief_rising_phase") ||
    (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT && standingPct > 40);

  if (!briefRising) return null;

  const confidence: StsBiomechanicalFlagConfidence =
    risingPct > 0 && risingPct < 10 ? "medium" : "low";

  return baseFlag(
    "possible_forward_trunk_flexion",
    "Possible excessive forward trunk flexion",
    "Possible forward trunk flexion pattern observed during rising phase.",
    `Rising phase represented ${risingPct}% of captured snapshots while standing represented ${standingPct}% — a brief rise relative to standing may suggest trunk-forward strategy during ascent; cannot be confirmed from camera data alone.`,
    confidence,
  );
}

function evaluateLateralTrunkShift(
  smtPilot: MotionAnalysisMotionPilotSummary | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): StsBiomechanicalFlag | null {
  const timingSpread = movementQuality?.timingRangeSec ?? 0;
  const variablePacing = movementQuality?.pacingConsistency === "Variable";
  const poseInterrupted = hasFlag(smtPilot?.clinicianFlags, "pose_tracking_interrupted");
  const unclearReps = smtPilot?.unclearReps ?? 0;
  const completeReps = smtPilot?.completeReps ?? 0;

  const cycleVariability =
    variablePacing &&
    timingSpread >= REP_TIMING_SPREAD_MIN_S &&
    completeReps >= 2;
  const trackingVariability =
    poseInterrupted && (variablePacing || unclearReps > 0);

  if (!cycleVariability && !trackingVariability) return null;

  const confidence: StsBiomechanicalFlagConfidence = cycleVariability ? "medium" : "low";

  return baseFlag(
    "possible_lateral_trunk_shift",
    "Possible lateral trunk shift",
    "Possible lateral shift pattern observed during sit-to-stand cycle.",
    cycleVariability
      ? `Rep timing spread was ${timingSpread}s across ${completeReps} captured cycles with variable pacing — cycle-to-cycle asymmetry may warrant frontal-plane review; lateral trunk shift cannot be confirmed from sagittal capture alone.`
      : "Pose tracking interruption coincided with unclear or variable cycle evidence — lateral weight-shift pattern may require in-person observation.",
    confidence,
  );
}

function evaluateIncompleteStanding(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): StsBiomechanicalFlag | null {
  const standingPct = phasePct(phaseRatios, "standing");
  const observedStanding = movementQuality?.observedStandingPhaseRatio;
  const standingUnderRepresented =
    (standingPct > 0 && standingPct < STANDING_PHASE_LOW_PCT) ||
    (observedStanding != null && observedStanding < STANDING_PHASE_LOW_PCT);
  const incompletePhases =
    movementQuality?.phaseConsistency === "Incomplete" &&
    standingPct > 0 &&
    standingPct < 25;

  if (!standingUnderRepresented && !incompletePhases) return null;

  const displayPct = observedStanding ?? standingPct;
  const confidence: StsBiomechanicalFlagConfidence =
    standingPct > 0 && standingPct < 10 ? "medium" : "low";

  return baseFlag(
    "possible_incomplete_standing",
    "Possible incomplete standing phase",
    "Standing phase appears incomplete or under-represented in captured evidence.",
    `Standing phase represented ${displayPct}% of captured snapshots — terminal upright posture may be under-captured or briefly maintained; clinician may confirm full standing visually.`,
    confidence,
  );
}

function evaluateFastUncontrolledLowering(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
  smtPilot: MotionAnalysisMotionPilotSummary | null | undefined,
): StsBiomechanicalFlag | null {
  const returningPct = phasePct(phaseRatios, "returning");
  const observedReturning = movementQuality?.observedReturningPhaseRatio;
  const lowReturning =
    hasFlag(movementQuality?.qualityFlags, "low_returning_phase") ||
    (returningPct > 0 && returningPct < RETURNING_PHASE_LOW_PCT) ||
    (observedReturning != null && observedReturning < RETURNING_PHASE_LOW_PCT);

  const avgS = movementQuality?.averageRepTimeSec ?? smtPilot?.repTimings?.avgS ?? null;
  const fastestS = movementQuality?.fastestRepTimeSec ?? smtPilot?.repTimings?.fastestS ?? null;
  const fastTimingRelative =
    avgS != null &&
    fastestS != null &&
    avgS - fastestS >= REP_TIMING_SPREAD_MIN_S &&
    lowReturning;

  if (!lowReturning && !fastTimingRelative) return null;

  const displayReturning = observedReturning ?? returningPct;
  const confidence: StsBiomechanicalFlagConfidence =
    returningPct > 0 && returningPct < 10 ? "medium" : "low";

  return baseFlag(
    "possible_fast_uncontrolled_lowering",
    "Possible fast or uncontrolled lowering pattern",
    "Returning/lowering phase may need clinician review.",
    fastTimingRelative
      ? `Returning phase represented ${displayReturning}% of snapshots and fastest cycle interval (${fastestS}s) was notably shorter than average (${avgS}s) — descent control cannot be confirmed from camera data alone.`
      : `Returning phase represented ${displayReturning}% of captured snapshots — lowering may be brief or under-represented in capture; clinician may review eccentric control visually.`,
    confidence,
  );
}

function evaluateLimitedEvidence(
  movementQuality: MovementQualitySignals | null | undefined,
  smtPilot: MotionAnalysisMotionPilotSummary | null | undefined,
  specificFlagsPresent: boolean,
): StsBiomechanicalFlag | null {
  if (specificFlagsPresent) return null;

  const unclearReps = smtPilot?.unclearReps ?? 0;
  const borderlinePhase =
    movementQuality?.phaseConsistency === "Moderate" ||
    movementQuality?.phaseConsistency === "Variable";
  const borderlineCompletion =
    movementQuality?.completionClarity === "Mostly clear" ||
    movementQuality?.completionClarity === "Unclear";

  if (!borderlinePhase && !borderlineCompletion && unclearReps === 0) {
    return null;
  }

  return baseFlag(
    "limited_or_insufficient_evidence",
    "Limited or insufficient evidence",
    "Camera-derived phase and timing evidence may be insufficient for stronger movement-pattern interpretation.",
    [
      borderlinePhase
        ? `Phase consistency was ${movementQuality?.phaseConsistency} across capture.`
        : null,
      borderlineCompletion
        ? `Cycle detection clarity was ${movementQuality?.completionClarity}.`
        : null,
      unclearReps > 0 ? `${unclearReps} unclear cycle(s) were recorded.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    "low",
  );
}

/**
 * Build STS biomechanical flags when evidence integrity allows joint-level interpretation.
 * Returns null for non-STS exercises or when integrity is limited / unable to assess.
 */
export function buildStsBiomechanicalFlags(
  input: BuildStsBiomechanicalFlagsInput = {},
): StsBiomechanicalFlagsResult | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (exerciseId !== STS_EXERCISE_ID) return null;
  if (!input.evidenceIntegrity?.sufficientForBiomechanicalInterpretation) return null;

  const phaseRatios = input.smtPilot?.phaseRatios ?? null;
  const movementQuality = input.movementQuality ?? null;

  const candidates = [
    evaluateForwardTrunkFlexion(phaseRatios, movementQuality),
    evaluateLateralTrunkShift(input.smtPilot, movementQuality),
    evaluateIncompleteStanding(phaseRatios, movementQuality),
    evaluateFastUncontrolledLowering(phaseRatios, movementQuality, input.smtPilot),
  ].filter((flag): flag is StsBiomechanicalFlag => flag != null);

  const limitedFlag = evaluateLimitedEvidence(
    movementQuality,
    input.smtPilot,
    candidates.length > 0,
  );
  if (limitedFlag) candidates.push(limitedFlag);

  if (candidates.length === 0) return null;

  return {
    flags: candidates,
    sectionNote: STS_BIOMECH_SECTION_NOTE,
  };
}
