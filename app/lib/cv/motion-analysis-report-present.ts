/**
 * Motion Analysis Report presentation layer — readability polish for clinician UI.
 * No CV logic changes. STS-focused executive summary and compact section content.
 */

import type { BiomechanicalContributionReview } from "@/app/lib/cv/biomechanical-contribution-review";
import type { MovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";
import type {
  MotionAnalysisPhaseRatios,
  MotionAnalysisReport,
  MotionAnalysisReviewNextItem,
  MotionAnalysisSmtPilotSummary,
} from "@/app/lib/cv/motion-analysis-report";

const STS_EXERCISE_ID = "sit-to-stand";
const MEANINGFUL_PHASE_PCT = 5;

export const MOVEMENT_TIMING_PHASE_REVIEW_TITLE = "Movement timing & phase review";

export const MOVEMENT_TIMING_PHASE_REVIEW_SUBTITLE =
  "Camera-derived timing and phase consistency signals — assistive summary only, not a clinical movement quality assessment.";

export type MotionAnalysisTimingMetricLabels = {
  average: string;
  fastest: string;
  slowest: string;
};

export type MotionAnalysisExecutiveSummary = {
  lines: string[];
};

export type BiomechanicalContributionReviewCompact = {
  observedPattern: string;
  possibleContributors: string[];
  muscleDemandContext: string[];
  clinicianReview: string[];
};

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

export function isStrictPhaseCompletenessFromPilot(
  smtPilot: MotionAnalysisSmtPilotSummary | null | undefined,
): boolean {
  if (!smtPilot?.phaseRatios) return false;
  if (smtPilot.unclearReps > 0) return false;
  if (hasFlag(smtPilot.clinicianFlags, "incomplete_cycle")) return false;

  const ratios = smtPilot.phaseRatios;
  const rising = ratios.rising ?? 0;
  const standing = ratios.standing ?? 0;
  const returning = ratios.returning ?? 0;

  return (
    rising >= MEANINGFUL_PHASE_PCT &&
    standing >= MEANINGFUL_PHASE_PCT &&
    returning >= MEANINGFUL_PHASE_PCT
  );
}

export function isStrictStsPhaseCompleteness(
  smtPilot: MotionAnalysisSmtPilotSummary | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): boolean {
  if (!isStrictPhaseCompletenessFromPilot(smtPilot)) return false;
  if (movementQuality?.phaseConsistency === "Incomplete") return false;
  if (movementQuality?.completionClarity === "Unclear") return false;
  return true;
}

export function formatStsCycleCountLabel(
  completeReps: number,
  strictComplete: boolean,
): string | null {
  if (completeReps <= 0) return null;
  const noun = strictComplete ? "complete cycle" : "camera-detected movement cycle";
  const suffix = completeReps === 1 ? "" : "s";
  return `${completeReps} ${noun}${suffix}`;
}

export function shouldUseCycleIntervalTimingLabels(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): boolean {
  if (!phaseRatios) return true;
  const rest = phaseRatios.rest ?? 0;
  const unknown = phaseRatios.unknown ?? 0;
  return rest > 0 || unknown > 0;
}

export function resolveStsTimingMetricLabels(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): MotionAnalysisTimingMetricLabels {
  if (shouldUseCycleIntervalTimingLabels(phaseRatios)) {
    return {
      average: "Average cycle interval",
      fastest: "Fastest cycle interval",
      slowest: "Slowest cycle interval",
    };
  }
  return {
    average: "Average repetition time",
    fastest: "Fastest repetition",
    slowest: "Slowest repetition",
  };
}

function normalizeForDedupe(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isNearDuplicatePrompt(prompt: string, reviewNextTexts: string[]): boolean {
  const normalizedPrompt = normalizeForDedupe(prompt);
  return reviewNextTexts.some((item) => {
    const normalizedItem = normalizeForDedupe(item);
    return (
      normalizedPrompt === normalizedItem ||
      normalizedPrompt.includes(normalizedItem) ||
      normalizedItem.includes(normalizedPrompt)
    );
  });
}

export function buildBiomechanicalContributionReviewCompact(
  review: BiomechanicalContributionReview,
  reviewNext: MotionAnalysisReviewNextItem[] | null | undefined,
): BiomechanicalContributionReviewCompact {
  const reviewNextTexts = (reviewNext ?? []).map((item) => item.text);

  const observedPattern = review.observedMovementPattern.slice(0, 2).join(" ");

  const clinicianReview = review.clinicianReviewPrompts
    .filter((prompt) => !isNearDuplicatePrompt(prompt, reviewNextTexts))
    .slice(0, 3);

  return {
    observedPattern,
    possibleContributors: review.possibleContributors.slice(0, 3),
    muscleDemandContext: review.muscleDemandContext.slice(0, 2),
    clinicianReview,
  };
}

function keyPhaseFinding(
  movementQuality: MovementQualitySignals | null | undefined,
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): string | null {
  if (movementQuality?.phaseConsistency && movementQuality.phaseConsistency !== "Insufficient data") {
    const returning =
      movementQuality.observedReturningPhaseRatio ?? phaseRatios?.returning ?? null;
    const rising = phaseRatios?.rising ?? null;
    if (returning !== null && returning < 15) {
      return `Returning phase under-represented (${returning}% of snapshots) — clinician may confirm lowering visually.`;
    }
    if (rising !== null && rising < 15) {
      return `Rising phase brief relative to capture (${rising}% of snapshots).`;
    }
    return `Phase consistency: ${movementQuality.phaseConsistency.toLowerCase()} across captured snapshots.`;
  }

  if (phaseRatios) {
    const rising = phaseRatios.rising ?? 0;
    const returning = phaseRatios.returning ?? 0;
    if (rising > 0 || returning > 0) {
      return `Rising ${rising}% · Returning ${returning}% of captured snapshots.`;
    }
  }

  return "Phase distribution limited — clinician may assess movement visually.";
}

function keyPacingFinding(
  movementQuality: MovementQualitySignals | null | undefined,
): string | null {
  if (!movementQuality || movementQuality.pacingConsistency === "Insufficient data") {
    return null;
  }
  if (movementQuality.pacingConsistency === "Variable") {
    return "Repetition pacing varied across the session.";
  }
  if (movementQuality.pacingConsistency === "Consistent") {
    return "Repetition pacing appeared relatively consistent.";
  }
  return "Moderate pacing variation observed across repetitions.";
}

function trackingConfidenceLine(report: MotionAnalysisReport): string {
  const signal =
    report.reportHeader?.trackingLabel ??
    report.smtPilot?.trackingSignal ??
    report.sessionSummary?.trackingSignal ??
    null;
  const confidence = report.reportHeader?.confidenceLabel ?? "Assistive confidence not recorded";
  const signalPart = signal
    ? typeof signal === "string" && signal.toLowerCase().includes("tracking")
      ? signal
      : `${String(signal)} tracking signal`
    : "Tracking signal not recorded";
  return `Tracking confidence: ${confidence} (${signalPart}).`;
}

export function buildMotionAnalysisExecutiveSummary(
  report: MotionAnalysisReport,
): MotionAnalysisExecutiveSummary | null {
  const exerciseId =
    report.sessionSummary?.exerciseId ??
    report.kinesiologyContext?.exerciseId ??
    null;
  if (exerciseId !== STS_EXERCISE_ID) return null;

  const lines: string[] = [];
  const completeReps = report.smtPilot?.completeReps ?? report.completedReps;
  const strictComplete = isStrictStsPhaseCompleteness(
    report.smtPilot,
    report.movementQuality,
  );
  const cycleLabel = formatStsCycleCountLabel(completeReps, strictComplete);
  if (cycleLabel) {
    lines.push(cycleLabel.charAt(0).toUpperCase() + cycleLabel.slice(1) + " recorded.");
  }

  lines.push(trackingConfidenceLine(report));

  const phaseFinding = keyPhaseFinding(report.movementQuality, report.smtPilot?.phaseRatios);
  if (phaseFinding) lines.push(phaseFinding);

  const pacingFinding = keyPacingFinding(report.movementQuality);
  if (pacingFinding) lines.push(pacingFinding);

  if (report.reportHeader?.reviewRequired || report.smtPilot?.showReviewBanner) {
    lines.push("Clinician review required — camera-assisted data only.");
  }

  const trimmed = lines.slice(0, 5);
  return trimmed.length > 0 ? { lines: trimmed } : null;
}

export function isStsPolishedReport(report: MotionAnalysisReport): boolean {
  const exerciseId =
    report.sessionSummary?.exerciseId ??
    report.kinesiologyContext?.exerciseId ??
    null;
  return exerciseId === STS_EXERCISE_ID && report.reportMode !== "minimal";
}
