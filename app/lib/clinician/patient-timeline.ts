import {
  clinicalActionNeedsTherapistReview,
  deriveClinicalAction,
  type ClinicalActionStatus,
} from "@/app/lib/clinical-action-engine";
import { parseSessionCoachNotes } from "@/app/lib/session-coach-metadata";

export type TimelineEventType =
  | "assessment_submitted"
  | "assessment_report_available"
  | "plan_assigned"
  | "session_completed"
  | "review_flag_raised"
  | "review_completed";

export type TimelineEventSeverity = "info" | "warning" | "action";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  label: string;
  detail?: string;
  severity?: TimelineEventSeverity;
};

export type TimelineAssessment = {
  id: string;
  created_at: string;
  type?: string;
  assessment_type?: string;
  status?: string;
};

export type TimelinePlan = {
  id: string;
  created_at: string;
  title?: string | null;
  planTitle?: string | null;
  programName?: string | null;
  structured_data?: { programName?: string } | null;
};

export type TimelineSessionLog = {
  id: string;
  completed_at: string;
  pain_score?: number | null;
  effort_score?: number | null;
  session_number?: number | null;
  notes?: string | null;
};

export type TimelineReviewAck = {
  id: string;
  reviewed_at: string;
  review_note?: string | null;
};

export type TimelineRemoteRequest = {
  id: string;
  created_at?: string;
  createdAt?: string;
  status: string;
  submitted_at?: string | null;
  submittedAt?: string | null;
};

const FLAG_LABELS: Partial<Record<ClinicalActionStatus, string>> = {
  needs_review: "Flag raised: Patient-reported pain ≥8/10",
  pain_increase:
    "Flag raised: Patient-reported pain increased over 2 consecutive sessions",
  adherence_follow_up: "Flag raised: No session completed in 7+ days",
  high_effort: "Flag raised: Patient-reported effort ≥9/10 for 3+ sessions",
};

function assessmentTypeLabel(type: string | undefined): string {
  if (type === "remote_questionnaire") return "Remote questionnaire";
  if (type === "general_msk") return "Clinical assessment";
  return "Clinical assessment";
}

function planDetail(plan: TimelinePlan): string | undefined {
  return (
    plan.planTitle ??
    plan.programName ??
    plan.title ??
    plan.structured_data?.programName ??
    undefined
  );
}

function remoteCreatedAt(req: TimelineRemoteRequest): string | null {
  return req.created_at ?? req.createdAt ?? null;
}

function flagLabelForSession(
  status: ClinicalActionStatus,
  painAfter: number | null,
  safetyConcern: boolean,
): string | null {
  if (!clinicalActionNeedsTherapistReview(status)) return null;

  if (status === "needs_review") {
    if (painAfter != null && painAfter >= 8) {
      return FLAG_LABELS.needs_review ?? null;
    }
    if (safetyConcern) {
      return "Flag raised: Patient reported a safety concern";
    }
    return "Flag raised: Therapist review recommended";
  }

  return FLAG_LABELS[status] ?? null;
}

export function buildPatientTimeline(data: {
  assessments: TimelineAssessment[];
  plans: TimelinePlan[];
  sessionLogs: TimelineSessionLog[];
  reviewAcknowledgments: TimelineReviewAck[];
  remoteAssessmentRequests?: TimelineRemoteRequest[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const req of data.remoteAssessmentRequests ?? []) {
    const createdAt = remoteCreatedAt(req);
    if (!createdAt) continue;

    const submitted = req.status === "submitted";
    events.push({
      id: `req-${req.id}`,
      type: "assessment_submitted",
      timestamp: createdAt,
      label: "Assessment link sent to patient",
      detail: submitted ? "Patient submitted assessment" : "Awaiting patient response",
      severity: "info",
    });

    const submittedAt = req.submitted_at ?? req.submittedAt;
    if (submitted && submittedAt) {
      events.push({
        id: `req-submitted-${req.id}`,
        type: "assessment_submitted",
        timestamp: submittedAt,
        label: "Assessment submitted",
        detail: "Remote questionnaire",
        severity: "info",
      });
    }
  }

  for (const assessment of data.assessments) {
    if (!assessment.created_at) continue;
    events.push({
      id: `assessment-${assessment.id}`,
      type: "assessment_submitted",
      timestamp: assessment.created_at,
      label: "Assessment submitted",
      detail: assessmentTypeLabel(assessment.type ?? assessment.assessment_type),
      severity: "info",
    });
  }

  for (const plan of data.plans) {
    if (!plan.created_at) continue;
    events.push({
      id: `plan-${plan.id}`,
      type: "plan_assigned",
      timestamp: plan.created_at,
      label: "Rehabilitation plan assigned",
      detail: planDetail(plan),
      severity: "info",
    });
  }

  for (const log of data.sessionLogs) {
    if (!log.completed_at) continue;

    const parts: string[] = [];
    if (log.pain_score != null) {
      parts.push(`Patient-reported pain: ${log.pain_score}/10`);
    }
    if (log.effort_score != null) {
      parts.push(`Patient-reported effort: ${log.effort_score}/10`);
    }

    const coachMeta = parseSessionCoachNotes(log.notes);
    const sessionAction = deriveClinicalAction({
      painBefore: coachMeta.painBefore,
      painAfter: log.pain_score ?? null,
      effortScore: log.effort_score ?? null,
      safetyConcern: coachMeta.safetyConcern,
      completedSessionsCount: 0,
      missedSessionsCount: 0,
      stableSessionsCount: 0,
    });

    const needsReview = clinicalActionNeedsTherapistReview(sessionAction.status);

    events.push({
      id: `session-${log.id}`,
      type: "session_completed",
      timestamp: log.completed_at,
      label: log.session_number
        ? `Session ${log.session_number} completed`
        : "Session completed",
      detail: parts.length > 0 ? parts.join(" · ") : undefined,
      severity: needsReview ? "warning" : "info",
    });

    const flagLabel = flagLabelForSession(
      sessionAction.status,
      log.pain_score ?? null,
      coachMeta.safetyConcern,
    );

    if (flagLabel) {
      events.push({
        id: `flag-${log.id}`,
        type: "review_flag_raised",
        timestamp: log.completed_at,
        label: flagLabel,
        detail: "Therapist review recommended",
        severity: "warning",
      });
    }
  }

  for (const ack of data.reviewAcknowledgments) {
    if (!ack.reviewed_at) continue;
    events.push({
      id: `review-${ack.id}`,
      type: "review_completed",
      timestamp: ack.reviewed_at,
      label: "Therapist reviewed",
      detail: ack.review_note?.trim()
        ? `Note: ${ack.review_note.trim()}`
        : undefined,
      severity: "action",
    });
  }

  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function formatTimelineTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const datePart = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return iso;
  }
}
