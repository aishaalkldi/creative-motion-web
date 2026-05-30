import type { ClinicalActionStatus } from "@/app/lib/clinical-action-engine";
import {
  deriveMissedSessionsCount,
  type PlanSessionForClinicalAction,
} from "@/app/lib/clinical-action-engine";
import {
  formatCvDuration,
  formatCvMovementDetected,
  formatCvTrackingSignal,
} from "@/app/lib/cv/cv-metrics-display";
import { extractGeneralDraft, extractStructuredData } from "@/app/lib/assessment-payload";
import { buildRemoteQuestionnaireSummary } from "@/app/lib/remote-questionnaire-summary";
import { parseSessionCoachNotes } from "@/app/lib/session-coach-metadata";
import {
  AI_CLINICIAN_SUMMARY_FORBIDDEN_PAYLOAD_KEYS,
  AI_CLINICIAN_SUMMARY_MAX_CV_SESSIONS,
  AI_CLINICIAN_SUMMARY_MAX_NOTE_CHARS,
  AI_CLINICIAN_SUMMARY_MAX_RECENT_LOGS,
} from "./clinician-summary-constants";

export type ClinicianSummarySessionLogRow = {
  session_number: number | null;
  effort_score: number | null;
  pain_score: number | null;
  exercises_completed: number | null;
  notes: string | null;
  completed_at: string;
};

export type ClinicianSummaryCvRow = {
  exercise_id: string;
  rep_count: number | null;
  session_duration_s: number | null;
  tracking_quality: string | null;
  movement_detected: boolean;
  recorded_at: string;
};

export type ClinicianSummaryAssessmentRow = {
  type: string;
  structured_data: unknown;
  created_at: string;
};

export type ClinicianSummaryFetchContext = {
  planId: string;
  sessions: PlanSessionForClinicalAction[];
  sessionLogs: ClinicianSummarySessionLogRow[];
  cvMetrics: ClinicianSummaryCvRow[];
  assessment: ClinicianSummaryAssessmentRow | null;
  clinicalActionStatus: ClinicalActionStatus;
};

export type ClinicianSummaryAssessmentSnapshot = {
  title: string;
  submittedAt: string;
  metrics: { label: string; value: string }[];
  rows: { label: string; value: string }[];
  hasRedFlag: boolean;
};

export type ClinicianSummaryPayload = {
  plan: {
    sessionsCompleted: number;
    totalSessions: number;
    missedSessions: number;
  };
  recentSessionLogs: {
    sessionNumber: number | null;
    effortScore: number | null;
    effortLabel: string | null;
    painAfter: number | null;
    painBefore: number | null;
    exercisesCompleted: number | null;
    patientNoteSnippet: string | null;
    safetyConcern: boolean;
    completedAt: string;
  }[];
  painAfterRange: { min: number | null; max: number | null };
  cvSessions: {
    exerciseId: string;
    repCount: number | null;
    durationLabel: string;
    trackingVisibility: string;
    movementDetectedLabel: string;
    recordedAt: string;
  }[];
  assessment: ClinicianSummaryAssessmentSnapshot | null;
  rulesBasedClinicalActionStatus: ClinicalActionStatus;
};

export type ClinicianSummaryInputsSnapshot = {
  sessionsCompleted: number;
  totalSessions: number;
  cvSessionCount: number;
  assessmentIncluded: boolean;
};

function effortLabel(score: number | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score <= 3) return "low";
  if (score <= 6) return "moderate";
  if (score <= 8) return "high";
  return "very high";
}

export function sanitizePatientNote(note: string | null | undefined): string | null {
  if (!note?.trim()) return null;
  const meta = parseSessionCoachNotes(note);
  let text = meta.patientNote?.trim() ?? "";
  if (!text) return null;
  text = text.replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, "[redacted]");
  text = text.replace(/\b\+?\d[\d\s-]{7,}\d\b/g, "[redacted]");
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, AI_CLINICIAN_SUMMARY_MAX_NOTE_CHARS);
}

function truncateField(value: string, max = 150): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function buildAssessmentSnapshotForAi(
  assessment: ClinicianSummaryAssessmentRow | null,
): ClinicianSummaryAssessmentSnapshot | null {
  if (!assessment) return null;

  const { type, structured_data, created_at } = assessment;

  if (type === "remote_questionnaire") {
    const summary = buildRemoteQuestionnaireSummary(structured_data, created_at);
    if (!summary) return null;
    return {
      title: summary.title,
      submittedAt: summary.submittedAt,
      metrics: summary.metrics.map((m) => ({
        label: m.label,
        value: truncateField(m.value),
      })),
      rows: summary.rows.map((r) => ({
        label: r.label,
        value: truncateField(r.value),
      })),
      hasRedFlag: summary.hasRedFlag,
    };
  }

  const general = extractGeneralDraft(structured_data, type);
  if (general) {
    const metrics: { label: string; value: string }[] = [];
    const rows: { label: string; value: string }[] = [];
    if (general.subjective.nprs.trim()) {
      metrics.push({ label: "Pain score", value: `${general.subjective.nprs}/10` });
    }
    if (general.subjective.painLocation.trim()) {
      metrics.push({ label: "Body region", value: general.subjective.painLocation });
    }
    if (general.subjective.chiefComplaint.trim()) {
      rows.push({ label: "Main complaint", value: general.subjective.chiefComplaint });
    }
    if (general.subjective.aggravating.trim()) {
      rows.push({ label: "Aggravating factors", value: general.subjective.aggravating });
    }
    if (general.subjective.goals.trim()) {
      rows.push({ label: "Functional goal", value: general.subjective.goals });
    }
    if (metrics.length === 0 && rows.length === 0) return null;
    return {
      title: "General MSK Assessment",
      submittedAt: created_at,
      metrics: metrics.map((m) => ({ ...m, value: truncateField(m.value) })),
      rows: rows.map((r) => ({ ...r, value: truncateField(r.value) })),
      hasRedFlag: Boolean(general.subjective.redFlags.trim()),
    };
  }

  const structured = extractStructuredData(structured_data);
  if (structured) {
    return {
      title: structured.bodyRegion || "Structured Assessment",
      submittedAt: created_at,
      metrics: [
        { label: "Pain at rest", value: `${structured.painAtRest}/10` },
        { label: "Pain on movement", value: `${structured.painOnMovement}/10` },
        { label: "Body region", value: structured.bodyRegion },
      ].map((m) => ({ ...m, value: truncateField(m.value) })),
      rows: [],
      hasRedFlag: false,
    };
  }

  return null;
}

export function buildClinicianSummaryPayload(
  context: ClinicianSummaryFetchContext,
): {
  payload: ClinicianSummaryPayload;
  inputsSnapshot: ClinicianSummaryInputsSnapshot;
} {
  const sessionsCompleted = context.sessions.filter((s) => s.status === "completed").length;
  const totalSessions = context.sessions.length;
  const missedSessions = deriveMissedSessionsCount(context.sessions);

  const recentLogs = context.sessionLogs.slice(0, AI_CLINICIAN_SUMMARY_MAX_RECENT_LOGS);
  const painAfterValues = recentLogs
    .map((log) => log.pain_score)
    .filter((v): v is number => v != null && Number.isFinite(v));

  const recentSessionLogs = recentLogs.map((log) => {
    const meta = parseSessionCoachNotes(log.notes);
    return {
      sessionNumber: log.session_number,
      effortScore: log.effort_score,
      effortLabel: effortLabel(log.effort_score),
      painAfter: log.pain_score,
      painBefore: meta.painBefore,
      exercisesCompleted: log.exercises_completed,
      patientNoteSnippet: sanitizePatientNote(log.notes),
      safetyConcern: meta.safetyConcern,
      completedAt: log.completed_at,
    };
  });

  const cvSessions = context.cvMetrics.slice(0, AI_CLINICIAN_SUMMARY_MAX_CV_SESSIONS).map((row) => ({
    exerciseId: row.exercise_id,
    repCount: row.rep_count,
    durationLabel: formatCvDuration(row.session_duration_s),
    trackingVisibility: formatCvTrackingSignal(row.tracking_quality),
    movementDetectedLabel: formatCvMovementDetected(row.movement_detected),
    recordedAt: row.recorded_at,
  }));

  const assessment = buildAssessmentSnapshotForAi(context.assessment);

  const payload: ClinicianSummaryPayload = {
    plan: { sessionsCompleted, totalSessions, missedSessions },
    recentSessionLogs,
    painAfterRange: {
      min: painAfterValues.length > 0 ? Math.min(...painAfterValues) : null,
      max: painAfterValues.length > 0 ? Math.max(...painAfterValues) : null,
    },
    cvSessions,
    assessment,
    rulesBasedClinicalActionStatus: context.clinicalActionStatus,
  };

  const inputsSnapshot: ClinicianSummaryInputsSnapshot = {
    sessionsCompleted,
    totalSessions,
    cvSessionCount: cvSessions.length,
    assessmentIncluded: assessment != null,
  };

  return { payload, inputsSnapshot };
}

/** Deep scan for forbidden keys — used in tests and pre-flight checks. */
export function findForbiddenPayloadKeys(value: unknown, path = ""): string[] {
  const found: string[] = [];
  if (value === null || value === undefined) return found;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findForbiddenPayloadKeys(item, `${path}[${index}]`));
    });
    return found;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (AI_CLINICIAN_SUMMARY_FORBIDDEN_PAYLOAD_KEYS.has(key)) {
        found.push(path ? `${path}.${key}` : key);
      }
      found.push(...findForbiddenPayloadKeys(nested, path ? `${path}.${key}` : key));
    }
  }

  return found;
}
