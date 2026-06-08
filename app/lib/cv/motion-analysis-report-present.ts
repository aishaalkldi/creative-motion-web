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
import {
  HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE,
  HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
import {
  STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE,
  STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import {
  MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE,
  MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";

const STS_EXERCISE_ID = "sit-to-stand";
const MINI_SQUAT_EXERCISE_ID = "mini-squat";
const HEEL_RAISE_EXERCISE_ID = "heel-raise";
const STEP_UP_EXERCISE_ID = "step-up";
const POLISHED_INTELLIGENCE_EXERCISE_IDS = new Set([
  STS_EXERCISE_ID,
  MINI_SQUAT_EXERCISE_ID,
  HEEL_RAISE_EXERCISE_ID,
  STEP_UP_EXERCISE_ID,
]);
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

export function isStrictMiniSquatPhaseCompleteness(
  msPilot: MotionAnalysisSmtPilotSummary | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): boolean {
  if (!msPilot?.phaseRatios) return false;
  if (msPilot.unclearReps > 0) return false;
  if (hasFlag(msPilot.clinicianFlags, "incomplete_cycle")) return false;

  const ratios = msPilot.phaseRatios;
  const lowering = ratios.lowering ?? 0;
  const bottom = ratios.bottom ?? 0;
  const rising = ratios.rising ?? 0;

  const phasesComplete =
    lowering >= MEANINGFUL_PHASE_PCT &&
    bottom >= MEANINGFUL_PHASE_PCT &&
    rising >= MEANINGFUL_PHASE_PCT;

  if (!phasesComplete) return false;
  if (movementQuality?.phaseConsistency === "Incomplete") return false;
  if (movementQuality?.completionClarity === "Unclear") return false;
  return true;
}

export function isStrictHeelRaisePhaseCompleteness(
  hrPilot: MotionAnalysisSmtPilotSummary | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): boolean {
  if (!hrPilot?.phaseRatios) return false;
  if (hrPilot.unclearReps > 0) return false;
  if (hasFlag(hrPilot.clinicianFlags, "incomplete_cycle")) return false;

  const ratios = hrPilot.phaseRatios;
  const rising = ratios.rising ?? 0;
  const peakRaise = ratios.peak_raise ?? 0;
  const lowering = ratios.lowering ?? 0;

  const phasesComplete =
    rising >= MEANINGFUL_PHASE_PCT &&
    peakRaise >= MEANINGFUL_PHASE_PCT &&
    lowering >= MEANINGFUL_PHASE_PCT;

  if (!phasesComplete) return false;
  if (movementQuality?.phaseConsistency === "Incomplete") return false;
  if (movementQuality?.completionClarity === "Unclear") return false;
  return true;
}

export function isStrictStepUpPhaseCompleteness(
  suPilot: MotionAnalysisSmtPilotSummary | null | undefined,
  movementQuality: MovementQualitySignals | null | undefined,
): boolean {
  if (!suPilot?.phaseRatios) return false;
  if (suPilot.unclearReps > 0) return false;
  if (hasFlag(suPilot.clinicianFlags, "incomplete_cycle")) return false;

  const ratios = suPilot.phaseRatios;
  const stepAscent = ratios.step_ascent ?? 0;
  const topPosition = ratios.top_position ?? 0;
  const stepDescent = ratios.step_descent ?? 0;

  const phasesComplete =
    stepAscent >= MEANINGFUL_PHASE_PCT &&
    topPosition >= MEANINGFUL_PHASE_PCT &&
    stepDescent >= MEANINGFUL_PHASE_PCT;

  if (!phasesComplete) return false;
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

const PROMPT_TOPIC_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: "pacing", pattern: /pacing|repetition.{0,20}consistenc|timing variab|cycle.{0,12}interval/ },
  { id: "lowering", pattern: /lowering|return to sitting|returning phase|descent/ },
  { id: "standing", pattern: /standing posture|terminal standing/ },
  { id: "unclear_reps", pattern: /unclear rep|unclear cycle|rep boundar/ },
];

function promptTopicId(text: string): string | null {
  const normalized = normalizeForDedupe(text);
  for (const topic of PROMPT_TOPIC_PATTERNS) {
    if (topic.pattern.test(normalized)) return topic.id;
  }
  return null;
}

function isNearDuplicatePrompt(prompt: string, existingTexts: string[]): boolean {
  const normalizedPrompt = normalizeForDedupe(prompt);
  return existingTexts.some((item) => {
    const normalizedItem = normalizeForDedupe(item);
    if (
      normalizedPrompt === normalizedItem ||
      normalizedPrompt.includes(normalizedItem) ||
      normalizedItem.includes(normalizedPrompt)
    ) {
      return true;
    }
    const promptTopic = promptTopicId(prompt);
    const itemTopic = promptTopicId(item);
    return promptTopic !== null && promptTopic === itemTopic;
  });
}

export function filterSemanticallyDuplicatePrompts(
  prompts: string[],
  existingTexts: string[],
): string[] {
  const kept: string[] = [];
  const seen = [...existingTexts];
  for (const prompt of prompts) {
    if (isNearDuplicatePrompt(prompt, seen)) continue;
    kept.push(prompt);
    seen.push(prompt);
  }
  return kept;
}

export function resolveCaptureEvidenceCycleMetricLabel(
  report: MotionAnalysisReport,
): string {
  const exerciseId =
    report.sessionSummary?.exerciseId ?? report.kinesiologyContext?.exerciseId ?? null;
  if (exerciseId === MINI_SQUAT_EXERCISE_ID) {
    const strictComplete = isStrictMiniSquatPhaseCompleteness(
      report.msPilot,
      report.movementQuality,
    );
    return strictComplete ? "Complete cycles" : "Camera-detected cycles";
  }
  if (exerciseId === HEEL_RAISE_EXERCISE_ID) {
    const strictComplete = isStrictHeelRaisePhaseCompleteness(
      report.hrPilot,
      report.movementQuality,
    );
    return strictComplete ? "Complete cycles" : "Camera-detected cycles";
  }
  if (exerciseId === STEP_UP_EXERCISE_ID) {
    const strictComplete = isStrictStepUpPhaseCompleteness(
      report.suPilot,
      report.movementQuality,
    );
    return strictComplete ? "Complete cycles" : "Camera-detected cycles";
  }
  const strictComplete = isStrictStsPhaseCompleteness(
    report.smtPilot,
    report.movementQuality,
  );
  return strictComplete ? "Complete cycles" : "Camera-detected cycles";
}

export function resolveCaptureEvidenceTimingLabels(
  labels: MotionAnalysisTimingMetricLabels | null | undefined,
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): MotionAnalysisTimingMetricLabels {
  const base = labels ?? resolveStsTimingMetricLabels(phaseRatios);
  return {
    average: base.average.replace(/^Average /, "Avg "),
    fastest: base.fastest,
    slowest: base.slowest,
  };
}

export function buildCaptureFlagsSummary(
  flags: string[] | null | undefined,
  maxItems = 3,
): string | null {
  if (!flags || flags.length === 0) return null;
  const readable = flags
    .slice(0, maxItems)
    .map((flag) => flag.replace(/_/g, " "));
  if (flags.length > maxItems) {
    return `${readable.join(", ")} (+${flags.length - maxItems} more in capture evidence)`;
  }
  return readable.join(", ");
}

export function buildBiomechanicalContributionReviewCompact(
  review: BiomechanicalContributionReview,
  reviewNext: MotionAnalysisReviewNextItem[] | null | undefined,
  movementQualityFocus: string[] | null | undefined = null,
): BiomechanicalContributionReviewCompact {
  const existingTexts = [
    ...(reviewNext ?? []).map((item) => item.text),
    ...(movementQualityFocus ?? []),
  ];

  const observedPattern = review.observedMovementPattern.slice(0, 2).join(" ");

  const clinicianReview = filterSemanticallyDuplicatePrompts(
    review.clinicianReviewPrompts,
    existingTexts,
  ).slice(0, 3);

  return {
    observedPattern,
    possibleContributors: review.possibleContributors.slice(0, 3),
    muscleDemandContext: review.muscleDemandContext.slice(0, 2),
    clinicianReview,
  };
}

function keyStsPhaseFinding(
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

function keyMiniSquatPhaseFinding(
  movementQuality: MovementQualitySignals | null | undefined,
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): string | null {
  if (movementQuality?.phaseConsistency && movementQuality.phaseConsistency !== "Insufficient data") {
    const lowering = phaseRatios?.lowering ?? movementQuality.observedReturningPhaseRatio ?? null;
    const bottom = phaseRatios?.bottom ?? null;
    if (lowering !== null && lowering < 15) {
      return `Lowering phase under-represented (${lowering}% of snapshots) — clinician may review squat depth visually.`;
    }
    if (bottom !== null && bottom < 10) {
      return `Bottom position brief relative to capture (${bottom}% of snapshots).`;
    }
    return `Phase consistency: ${movementQuality.phaseConsistency.toLowerCase()} across captured snapshots.`;
  }

  if (phaseRatios) {
    const lowering = phaseRatios.lowering ?? 0;
    const rising = phaseRatios.rising ?? 0;
    if (lowering > 0 || rising > 0) {
      return `Lowering ${lowering}% · Rising ${rising}% of captured snapshots.`;
    }
  }

  return "Phase distribution limited — clinician may assess squat pattern visually.";
}

function keyHeelRaisePhaseFinding(
  movementQuality: MovementQualitySignals | null | undefined,
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): string | null {
  if (movementQuality?.phaseConsistency && movementQuality.phaseConsistency !== "Insufficient data") {
    const lowering = phaseRatios?.lowering ?? movementQuality.observedReturningPhaseRatio ?? null;
    const peakRaise = phaseRatios?.peak_raise ?? null;
    if (lowering !== null && lowering < 15) {
      return `Lowering phase under-represented (${lowering}% of snapshots) — clinician may review lowering control visually.`;
    }
    if (peakRaise !== null && peakRaise < 10) {
      return `Peak raise position brief relative to capture (${peakRaise}% of snapshots).`;
    }
    return `Phase consistency: ${movementQuality.phaseConsistency.toLowerCase()} across captured snapshots.`;
  }

  if (phaseRatios) {
    const rising = phaseRatios.rising ?? 0;
    const lowering = phaseRatios.lowering ?? 0;
    if (rising > 0 || lowering > 0) {
      return `Rising ${rising}% · Lowering ${lowering}% of captured snapshots.`;
    }
  }

  return "Phase distribution limited — clinician may assess heel raise pattern visually.";
}

function keyStepUpPhaseFinding(
  movementQuality: MovementQualitySignals | null | undefined,
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): string | null {
  if (movementQuality?.phaseConsistency && movementQuality.phaseConsistency !== "Insufficient data") {
    const stepDescent = phaseRatios?.step_descent ?? movementQuality.observedReturningPhaseRatio ?? null;
    const topPosition = phaseRatios?.top_position ?? null;
    if (stepDescent !== null && stepDescent < 15) {
      return `Step descent phase under-represented (${stepDescent}% of snapshots) — clinician may review descent control visually.`;
    }
    if (topPosition !== null && topPosition < 10) {
      return `Top step position brief relative to capture (${topPosition}% of snapshots).`;
    }
    return `Phase consistency: ${movementQuality.phaseConsistency.toLowerCase()} across captured snapshots.`;
  }

  if (phaseRatios) {
    const stepAscent = phaseRatios.step_ascent ?? 0;
    const stepDescent = phaseRatios.step_descent ?? 0;
    if (stepAscent > 0 || stepDescent > 0) {
      return `Step ascent ${stepAscent}% · Step descent ${stepDescent}% of captured snapshots.`;
    }
  }

  return "Phase distribution limited — clinician may assess step up pattern visually.";
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
    report.msPilot?.trackingSignal ??
    report.hrPilot?.trackingSignal ??
    report.suPilot?.trackingSignal ??
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
  if (!exerciseId || !POLISHED_INTELLIGENCE_EXERCISE_IDS.has(exerciseId)) return null;

  const lines: string[] = [];
  const motionPilot = report.smtPilot ?? report.msPilot ?? report.hrPilot ?? report.suPilot;
  const completeReps = motionPilot?.completeReps ?? report.completedReps;
  const synthesizedMiniSquat = isSynthesizedMiniSquatEvidence(report);
  const synthesizedHeelRaise = isSynthesizedHeelRaiseEvidence(report);
  const synthesizedStepUp = isSynthesizedStepUpEvidence(report);
  const synthesizedLimitedEvidence =
    synthesizedMiniSquat || synthesizedHeelRaise || synthesizedStepUp;
  const strictComplete =
    exerciseId === MINI_SQUAT_EXERCISE_ID
      ? !synthesizedMiniSquat &&
        isStrictMiniSquatPhaseCompleteness(report.msPilot, report.movementQuality)
      : exerciseId === HEEL_RAISE_EXERCISE_ID
        ? !synthesizedHeelRaise &&
          isStrictHeelRaisePhaseCompleteness(report.hrPilot, report.movementQuality)
        : exerciseId === STEP_UP_EXERCISE_ID
          ? !synthesizedStepUp &&
            isStrictStepUpPhaseCompleteness(report.suPilot, report.movementQuality)
          : isStrictStsPhaseCompleteness(report.smtPilot, report.movementQuality);
  const cycleLabel = formatStsCycleCountLabel(completeReps, strictComplete);
  if (cycleLabel) {
    lines.push(cycleLabel.charAt(0).toUpperCase() + cycleLabel.slice(1) + " recorded.");
  }

  if (synthesizedMiniSquat) {
    lines.push(MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL + ".");
    lines.push(MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE);
  } else if (synthesizedHeelRaise) {
    lines.push(HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL + ".");
    lines.push(HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE);
  } else if (synthesizedStepUp) {
    lines.push(STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL + ".");
    lines.push(STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE);
  }

  lines.push(trackingConfidenceLine(report));

  if (!synthesizedLimitedEvidence) {
    const phaseFinding =
      exerciseId === MINI_SQUAT_EXERCISE_ID
        ? keyMiniSquatPhaseFinding(report.movementQuality, report.msPilot?.phaseRatios ?? null)
        : exerciseId === HEEL_RAISE_EXERCISE_ID
          ? keyHeelRaisePhaseFinding(report.movementQuality, report.hrPilot?.phaseRatios ?? null)
          : exerciseId === STEP_UP_EXERCISE_ID
            ? keyStepUpPhaseFinding(report.movementQuality, report.suPilot?.phaseRatios ?? null)
            : keyStsPhaseFinding(report.movementQuality, report.smtPilot?.phaseRatios ?? null);
    if (phaseFinding) lines.push(phaseFinding);

    const pacingFinding = keyPacingFinding(report.movementQuality);
    if (pacingFinding) lines.push(pacingFinding);
  }

  if (report.reportHeader?.reviewRequired || motionPilot?.showReviewBanner) {
    lines.push("Clinician review required — camera-assisted data only.");
  }

  const trimmed = lines.slice(0, 5);
  return trimmed.length > 0 ? { lines: trimmed } : null;
}

export function isPolishedIntelligenceReport(report: MotionAnalysisReport): boolean {
  const exerciseId =
    report.sessionSummary?.exerciseId ??
    report.kinesiologyContext?.exerciseId ??
    null;
  return (
    exerciseId != null &&
    POLISHED_INTELLIGENCE_EXERCISE_IDS.has(exerciseId) &&
    report.reportMode !== "minimal"
  );
}

export function isStsPolishedReport(report: MotionAnalysisReport): boolean {
  return isPolishedIntelligenceReport(report);
}

export function hasPersistedMiniSquatPhaseRatios(report: MotionAnalysisReport): boolean {
  if (report.msPilotEvidenceMode !== "persisted") return false;
  const ratios = report.msPilot?.phaseRatios;
  return (
    ratios != null &&
    Object.values(ratios).some((ratio) => typeof ratio === "number" && ratio > 0)
  );
}

export function isSynthesizedMiniSquatEvidence(report: MotionAnalysisReport): boolean {
  return report.msPilotEvidenceMode === "synthesized";
}

export function hasPersistedHeelRaisePhaseRatios(report: MotionAnalysisReport): boolean {
  if (report.hrPilotEvidenceMode !== "persisted") return false;
  const ratios = report.hrPilot?.phaseRatios;
  return (
    ratios != null &&
    Object.values(ratios).some((ratio) => typeof ratio === "number" && ratio > 0)
  );
}

export function isSynthesizedHeelRaiseEvidence(report: MotionAnalysisReport): boolean {
  return report.hrPilotEvidenceMode === "synthesized";
}

export function hasPersistedStepUpPhaseRatios(report: MotionAnalysisReport): boolean {
  if (report.suPilotEvidenceMode !== "persisted") return false;
  const ratios = report.suPilot?.phaseRatios;
  return (
    ratios != null &&
    Object.values(ratios).some((ratio) => typeof ratio === "number" && ratio > 0)
  );
}

export function isSynthesizedStepUpEvidence(report: MotionAnalysisReport): boolean {
  return report.suPilotEvidenceMode === "synthesized";
}
