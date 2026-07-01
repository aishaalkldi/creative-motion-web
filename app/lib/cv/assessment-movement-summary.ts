/**
 * Rule-based assistive summary for clinician assessment captures (no motion pilot JSON).
 */

import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import {
  cvDurationMetricLabel,
  cvRepMetricLabel,
  formatCvDuration,
  formatCvMovementDetected,
  formatCvTrackingQuality,
} from "@/app/lib/cv/cv-metrics-display";
import { isGaitAssessmentExerciseId } from "@/app/lib/cv/gait-assessment-exercise-ids";
import { buildGaitAssistiveInterpretation } from "@/app/lib/cv/gait-interpretation";

export type AssessmentMovementSummary = {
  title: string;
  measuredRows: { label: string; value: string }[];
  interpretationLines: string[];
  reviewPrompts: string[];
  disclaimer: string;
};

const DISCLAIMER =
  "Assistive observation summary for therapist review only. Not diagnostic and not a validated clinical test score.";

function exerciseTitle(exerciseId: string): string {
  const id = exerciseId.trim().toLowerCase();
  if (isGaitAssessmentExerciseId(id)) return "Walking observation summary";
  if (id === "single-leg-stance") return "Single-leg stance observation summary";
  if (id === "functional-reach") return "Functional reach observation summary";
  if (id === "timed-up-and-go") return "Timed Up and Go observation summary";
  return "Assessment movement summary";
}

function buildMeasuredRows(metric: CvSessionMetricPublic): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const repLabel = cvRepMetricLabel(metric.exerciseId);
  if (repLabel) {
    rows.push({
      label: repLabel,
      value: metric.repCount != null ? String(metric.repCount) : "—",
    });
  }
  rows.push({
    label: cvDurationMetricLabel(metric.exerciseId),
    value: formatCvDuration(metric.sessionDurationS),
  });
  rows.push({
    label: "Tracking quality",
    value: formatCvTrackingQuality(metric.trackingQuality),
  });
  rows.push({
    label: "Movement detected",
    value: formatCvMovementDetected(metric.movementDetected),
  });
  return rows;
}

function buildGenericInterpretation(metric: CvSessionMetricPublic): string[] {
  const lines: string[] = [];
  const id = metric.exerciseId.trim().toLowerCase();

  if (!metric.movementDetected && id !== "timed-up-and-go") {
    lines.push(
      "Movement was not detected during capture — confirm task completion during clinical review.",
    );
  } else if (id === "single-leg-stance") {
    lines.push(
      "Hold duration was observed during the single-leg stance task — relate to expected functional balance tolerance in examination.",
    );
  } else if (id === "functional-reach") {
    lines.push(
      "Forward reach attempts were observed — clinician may review reach distance, trunk control, and return-to-upright during examination.",
    );
  } else if (id === "timed-up-and-go") {
    lines.push(
      "Task duration was recorded for the Timed Up and Go pass — compare with expected community mobility tolerance during review.",
    );
  } else {
    lines.push("Movement observations were captured for therapist review.");
  }

  const tracking = metric.trackingQuality?.trim().toLowerCase();
  if (tracking === "poor" || tracking === "unknown") {
    lines.push("Camera visibility was limited — treat assistive metrics as supplementary only.");
  }

  return lines;
}

function buildReviewPrompts(metric: CvSessionMetricPublic): string[] {
  const prompts = [
    "Confirm task performance and patient safety during your clinical examination.",
    "Relate captured observations to functional goals and environment.",
  ];
  if (!metric.movementDetected && metric.exerciseId !== "timed-up-and-go") {
    prompts.push("Consider repeating capture if the task was attempted but not detected.");
  }
  return prompts;
}

export function buildAssessmentMovementSummary(
  metric: CvSessionMetricPublic,
): AssessmentMovementSummary | null {
  if (metric.source !== "assessment_movement") return null;

  if (isGaitAssessmentExerciseId(metric.exerciseId)) {
    const gait = buildGaitAssistiveInterpretation(metric);
    return {
      title: exerciseTitle(metric.exerciseId),
      measuredRows: buildMeasuredRows(metric),
      interpretationLines:
        gait?.interpretationLines ?? buildGenericInterpretation(metric),
      reviewPrompts: gait?.reviewPrompts ?? buildReviewPrompts(metric),
      disclaimer: gait?.disclaimer ?? DISCLAIMER,
    };
  }

  return {
    title: exerciseTitle(metric.exerciseId),
    measuredRows: buildMeasuredRows(metric),
    interpretationLines: buildGenericInterpretation(metric),
    reviewPrompts: buildReviewPrompts(metric),
    disclaimer: DISCLAIMER,
  };
}
