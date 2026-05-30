import {
  AI_CLINICIAN_SUMMARY_FORBIDDEN_PHRASES,
  AI_CLINICIAN_SUMMARY_REQUIRED_CLOSING,
} from "./clinician-summary-constants";
import type { ClinicianSummaryPayload } from "./clinician-summary-input";

export function findForbiddenPhrasesInSummary(text: string): string[] {
  const normalized = text.toLowerCase();
  return AI_CLINICIAN_SUMMARY_FORBIDDEN_PHRASES.filter((phrase) =>
    normalized.includes(phrase.toLowerCase()),
  );
}

export function isAiSummaryOutputSafe(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return findForbiddenPhrasesInSummary(trimmed).length === 0;
}

export function ensureRequiredClosing(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return AI_CLINICIAN_SUMMARY_REQUIRED_CLOSING;
  if (trimmed.toLowerCase().includes(AI_CLINICIAN_SUMMARY_REQUIRED_CLOSING.toLowerCase())) {
    return trimmed;
  }
  return `${trimmed} ${AI_CLINICIAN_SUMMARY_REQUIRED_CLOSING}`;
}

export function validateAndNormalizeAiSummary(text: string): {
  ok: boolean;
  summary: string;
  forbiddenPhrases: string[];
} {
  const withClosing = ensureRequiredClosing(text);
  const forbiddenPhrases = findForbiddenPhrasesInSummary(withClosing);
  if (forbiddenPhrases.length > 0) {
    return { ok: false, summary: withClosing, forbiddenPhrases };
  }
  return { ok: true, summary: withClosing, forbiddenPhrases: [] };
}

function formatPainRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  if (min === max) return `${min}/10`;
  return `${min}–${max}/10`;
}

function dominantEffortLabel(payload: ClinicianSummaryPayload): string | null {
  const labels = payload.recentSessionLogs
    .map((log) => log.effortLabel)
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) return null;
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

/** Deterministic clinician-only fallback when AI output is unsafe or unavailable. */
export function buildSafeFallbackSummary(payload: ClinicianSummaryPayload): string {
  const parts: string[] = [];

  const { sessionsCompleted, totalSessions, missedSessions } = payload.plan;
  parts.push(
    `Patient completed ${sessionsCompleted} of ${totalSessions} assigned sessions.`,
  );

  if (missedSessions > 0) {
    parts.push(`${missedSessions} session(s) may have been missed or skipped.`);
  }

  const painRange = formatPainRange(payload.painAfterRange.min, payload.painAfterRange.max);
  if (painRange) {
    parts.push(`Pain after sessions stayed around ${painRange}.`);
  }

  const effort = dominantEffortLabel(payload);
  if (effort) {
    parts.push(`Effort was ${effort}.`);
  }

  if (payload.cvSessions.length > 0) {
    const latestCv = payload.cvSessions[0];
    const reps =
      latestCv.repCount != null ? `${latestCv.repCount} reps` : "reps not recorded";
    parts.push(
      `One ${latestCv.exerciseId.replace(/-/g, " ")} camera session recorded ${reps} with ${latestCv.trackingVisibility.toLowerCase()}.`,
    );
  }

  if (payload.assessment) {
    parts.push(`Assessment on file: ${payload.assessment.title}.`);
    if (payload.assessment.hasRedFlag) {
      parts.push("Assessment includes patient-reported red-flag fields for therapist review.");
    }
  }

  parts.push(
    `Rules-based system flag: ${payload.rulesBasedClinicalActionStatus.replace(/_/g, " ")}.`,
  );
  parts.push(AI_CLINICIAN_SUMMARY_REQUIRED_CLOSING);

  return parts.join(" ");
}
