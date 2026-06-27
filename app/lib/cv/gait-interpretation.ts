/**
 * PR120 — Assistive gait interpretation for clinician review.
 * Rule-based only. No diagnosis, pathology labels, or treatment advice.
 *
 * Measured values are shown by CvReviewSummary; this module adds assistive interpretation only.
 */

import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { isGaitAssessmentExerciseId } from "@/app/lib/cv/gait-assessment-exercise-ids";

export type GaitAssistiveInterpretation = {
  interpretationLines: string[];
  reviewPrompts: string[];
  disclaimer: string;
};

export const GAIT_INTERPRETATION_DISCLAIMER =
  "AI-assisted gait interpretation for clinician convenience only. Derived from camera-recorded walking observation metrics — does not replace clinical examination. Therapist confirmation required before clinical use.";

export const GAIT_INTERPRETATION_FORBIDDEN_TERMS = [
  "diagnosis",
  "pathology",
  "patient has",
  "osteoarthritis",
  "parkinson",
  "foot drop",
  "fall risk",
  "treatment recommendation",
] as const;

function normalizeTracking(quality: string | null | undefined): string {
  return quality?.trim().toLowerCase() ?? "";
}

function buildInterpretationLines(
  metric: Pick<
    CvSessionMetricPublic,
    "sessionDurationS" | "repCount" | "trackingQuality" | "movementDetected"
  >,
): string[] {
  const lines: string[] = [];
  const tracking = normalizeTracking(metric.trackingQuality);
  const limitedTracking = tracking === "poor" || tracking === "unknown" || !tracking;
  const duration = metric.sessionDurationS ?? 0;

  if (!metric.movementDetected) {
    lines.push(
      "Automated movement detection did not register sustained walking during this pass — clinician may confirm whether walking occurred as intended.",
    );
  } else {
    lines.push(
      "Walking movement was captured during the observed pass — clinician may review pace, step regularity, and functional tolerance during examination.",
    );
  }

  if (limitedTracking) {
    lines.push(
      "Camera visibility was limited during capture — assistive interpretation should be treated as supplementary only.",
    );
  } else if (tracking === "fair") {
    lines.push(
      "Tracking signal was fair — assistive metrics may support review but should be confirmed in person.",
    );
  }

  if (duration > 0 && duration < 10) {
    lines.push(
      "Observed walking duration was brief — a longer capture pass may support richer therapist review.",
    );
  } else if (duration >= 10) {
    lines.push(
      "Observed walking duration was recorded — clinician may relate this to expected community or household walking tolerance.",
    );
  }

  if (metric.repCount != null && metric.repCount > 0) {
    lines.push(
      "An estimated step or gait-cycle count was recorded — clinician may compare this with expected walking tolerance for context.",
    );
  } else if (metric.movementDetected) {
    lines.push(
      "No step or cycle estimate was recorded despite detected movement — retest or visual review may be helpful.",
    );
  }

  return lines;
}

function buildReviewPrompts(
  metric: Pick<CvSessionMetricPublic, "trackingQuality" | "movementDetected">,
): string[] {
  const prompts = [
    "Confirm walking quality, symmetry, and tolerance with in-person observation.",
    "Relate captured metrics to the patient's reported functional goals and environment.",
  ];

  const tracking = normalizeTracking(metric.trackingQuality);
  if (tracking === "poor" || tracking === "unknown") {
    prompts.push("Consider repeating capture with improved camera framing before relying on assistive metrics.");
  }
  if (!metric.movementDetected) {
    prompts.push("Verify whether capture conditions allowed the patient to walk as intended.");
  }

  return prompts.slice(0, 4);
}

export function shouldShowGaitInterpretation(
  metric: Pick<CvSessionMetricPublic, "exerciseId" | "sessionDurationS" | "movementDetected" | "repCount">,
): boolean {
  if (!isGaitAssessmentExerciseId(metric.exerciseId)) return false;
  return (
    metric.movementDetected ||
    (metric.sessionDurationS ?? 0) > 0 ||
    (metric.repCount ?? 0) > 0
  );
}

export function buildGaitAssistiveInterpretation(
  metric: CvSessionMetricPublic,
): GaitAssistiveInterpretation | null {
  if (!shouldShowGaitInterpretation(metric)) return null;

  return {
    interpretationLines: buildInterpretationLines(metric),
    reviewPrompts: buildReviewPrompts(metric),
    disclaimer: GAIT_INTERPRETATION_DISCLAIMER,
  };
}

/** Test helper — assert assistive output avoids forbidden clinical wording. */
export function gaitInterpretationContainsForbiddenTerms(
  interpretation: GaitAssistiveInterpretation,
): string[] {
  const corpus = [
    ...interpretation.interpretationLines,
    ...interpretation.reviewPrompts,
    interpretation.disclaimer,
  ]
    .join("\n")
    .toLowerCase();

  return GAIT_INTERPRETATION_FORBIDDEN_TERMS.filter((term) => corpus.includes(term));
}
