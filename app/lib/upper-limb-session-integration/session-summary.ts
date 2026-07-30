import type { NormalizedUpperLimbSessionResult } from "./types";

/**
 * Clinician-safe factual summary of a normalized Upper-Limb session result.
 *
 * The three arrays are kept separate on purpose so a consumer can render or
 * gate on "notes requiring therapist review" independently from plain
 * measured facts. `text` is a deterministic, neutral render of all three
 * sections for callers that just need a display string.
 *
 * This function never generates a diagnosis, prognosis, safety verdict,
 * treatment recommendation, stroke-severity wording, or a comparison with
 * clinical norms — it only restates values already present on the
 * normalized result in plain, factual language.
 */
export interface FactualUpperLimbSessionSummary {
  measuredFacts: string[];
  observedBehavior: string[];
  therapistReviewNotes: string[];
  text: string;
}

function formatDuration(elapsedSeconds: number): string {
  const totalSeconds = Math.round(elapsedSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  if (seconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function completionSentence(result: NormalizedUpperLimbSessionResult): string {
  const duration = formatDuration(result.timing.elapsedSeconds);
  switch (result.completion.state) {
    case "completed":
      return `Session completed in ${duration}.`;
    case "interrupted":
      return `Session was interrupted after ${duration}.`;
    case "abandoned":
      return `Session was abandoned after ${duration}.`;
  }
}

function interruptionReasonSentence(result: NormalizedUpperLimbSessionResult): string | null {
  if (!result.completion.interruptionReason) return null;
  const verb = result.completion.state === "abandoned" ? "abandoned" : "interrupted";
  return `The session was ${verb} because ${result.completion.interruptionReason}.`;
}

function targetAttemptsSentence(result: NormalizedUpperLimbSessionResult): string {
  const { targetAttempts, successfulTargets } = result.performance;
  if (targetAttempts === 0) return "No target attempts were recorded.";
  return `${successfulTargets} of ${targetAttempts} target attempts were completed.`;
}

function incompleteAttemptsSentence(result: NormalizedUpperLimbSessionResult): string | null {
  const { incompleteAttempts } = result.performance;
  if (incompleteAttempts === 0) return null;
  return `${pluralize(incompleteAttempts, "target attempt")} incomplete.`;
}

function trackingQualitySentence(result: NormalizedUpperLimbSessionResult): string {
  return `Tracking quality was ${result.tracking.quality}.`;
}

function trackingInterruptionsSentence(result: NormalizedUpperLimbSessionResult): string {
  const { interruptionCount } = result.tracking;
  if (interruptionCount === 0) return "Tracking was not interrupted.";
  return `Tracking was interrupted ${pluralize(interruptionCount, "time")}.`;
}

function patientReportedSentences(result: NormalizedUpperLimbSessionResult): string[] {
  const sentences: string[] = [];
  if (result.patientReported.pain !== null) {
    sentences.push(`Patient-reported pain score was ${result.patientReported.pain}.`);
  }
  if (result.patientReported.effort !== null) {
    sentences.push(`Patient-reported effort score was ${result.patientReported.effort}.`);
  }
  return sentences;
}

function trunkCompensationSentence(result: NormalizedUpperLimbSessionResult): string {
  const { trunkCompensationCount } = result.observations;
  if (trunkCompensationCount === 0) return "No trunk compensation was observed.";
  return `Trunk compensation was observed during ${pluralize(trunkCompensationCount, "attempt")}.`;
}

function therapistReviewNotes(result: NormalizedUpperLimbSessionResult): string[] {
  const notes: string[] = [];

  if (result.observations.trunkCompensationCount > 0) {
    notes.push(
      `Trunk compensation observed during ${pluralize(result.observations.trunkCompensationCount, "attempt")} requires therapist review.`,
    );
  }

  if (result.completion.state !== "completed") {
    notes.push(
      `Session did not reach a completed state (${result.completion.state}) and requires therapist review.`,
    );
  }

  if (result.tracking.quality === "low" || result.tracking.quality === "insufficient") {
    notes.push(`Tracking quality was ${result.tracking.quality} and requires therapist review.`);
  }

  return notes;
}

export function buildUpperLimbFactualSessionSummary(
  result: NormalizedUpperLimbSessionResult,
): FactualUpperLimbSessionSummary {
  const measuredFacts: string[] = [
    completionSentence(result),
    ...(interruptionReasonSentence(result) ? [interruptionReasonSentence(result) as string] : []),
    targetAttemptsSentence(result),
    ...(incompleteAttemptsSentence(result) ? [incompleteAttemptsSentence(result) as string] : []),
    trackingQualitySentence(result),
    trackingInterruptionsSentence(result),
    ...patientReportedSentences(result),
  ];

  const observedBehavior: string[] = [trunkCompensationSentence(result)];

  const reviewNotes = therapistReviewNotes(result);

  const text = [measuredFacts, observedBehavior, reviewNotes]
    .filter((section) => section.length > 0)
    .map((section) => section.join("\n\n"))
    .join("\n\n");

  return {
    measuredFacts,
    observedBehavior,
    therapistReviewNotes: reviewNotes,
    text,
  };
}
