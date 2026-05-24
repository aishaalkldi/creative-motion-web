/**
 * Clinician review acknowledgment overlay — does not change Clinical Action Engine rules.
 * Computed flags come from deriveClinicalAction; this layer tracks therapist review only.
 */

import {
  deriveMissedSessionsCount,
  type ClinicalActionStatus,
  type PlanSessionForClinicalAction,
} from "@/app/lib/clinical-action-engine";

export type UrgentClinicalReviewStatus =
  | "needs_review"
  | "pain_increase"
  | "high_effort"
  | "adherence_follow_up";

export const URGENT_CLINICAL_REVIEW_STATUSES: readonly UrgentClinicalReviewStatus[] = [
  "needs_review",
  "pain_increase",
  "high_effort",
  "adherence_follow_up",
] as const;

export type ClinicalReviewAckRow = {
  trigger_key: string;
  reviewed_at: string;
};

export function isUrgentClinicalReviewStatus(
  status: ClinicalActionStatus,
): status is UrgentClinicalReviewStatus {
  return (URGENT_CLINICAL_REVIEW_STATUSES as readonly string[]).includes(status);
}

export function buildSessionReviewTriggerKey(
  sessionLogId: string,
  actionStatus: UrgentClinicalReviewStatus,
): string {
  return `log:${sessionLogId.trim()}:${actionStatus}`;
}

export function buildAdherenceReviewTriggerKey(
  planId: string,
  missedSessionsCount: number,
): string {
  return `plan:${planId.trim()}:adherence:${missedSessionsCount}`;
}

export function buildClinicalReviewTriggerKey(input: {
  planId: string;
  actionStatus: ClinicalActionStatus;
  latestSessionLogId?: string | null;
  missedSessionsCount: number;
}): string | null {
  if (!isUrgentClinicalReviewStatus(input.actionStatus)) {
    return null;
  }

  if (input.actionStatus === "adherence_follow_up") {
    return buildAdherenceReviewTriggerKey(input.planId, input.missedSessionsCount);
  }

  const logId = input.latestSessionLogId?.trim();
  if (!logId) return null;

  return buildSessionReviewTriggerKey(logId, input.actionStatus);
}

export function isClinicalReviewAcknowledged(
  acknowledgedKeys: ReadonlySet<string>,
  triggerKey: string | null | undefined,
): boolean {
  if (!triggerKey) return false;
  return acknowledgedKeys.has(triggerKey);
}

export function normalizeReviewNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 2000);
}

export function deriveMissedSessionsForReview(
  sessions: PlanSessionForClinicalAction[],
): number {
  return deriveMissedSessionsCount(sessions);
}

export type ClinicalReviewState = {
  clinicalReviewTriggerKey: string | null;
  reviewAcknowledged: boolean;
  reviewedAt: string | null;
};

export function resolveClinicalReviewState(input: {
  planId: string;
  actionStatus: ClinicalActionStatus;
  latestSessionLogId?: string | null;
  missedSessionsCount: number;
  acknowledgmentsByTriggerKey: Map<string, ClinicalReviewAckRow>;
}): ClinicalReviewState {
  const clinicalReviewTriggerKey = buildClinicalReviewTriggerKey({
    planId: input.planId,
    actionStatus: input.actionStatus,
    latestSessionLogId: input.latestSessionLogId,
    missedSessionsCount: input.missedSessionsCount,
  });

  if (!clinicalReviewTriggerKey) {
    return {
      clinicalReviewTriggerKey: null,
      reviewAcknowledged: false,
      reviewedAt: null,
    };
  }

  const ack = input.acknowledgmentsByTriggerKey.get(clinicalReviewTriggerKey);
  return {
    clinicalReviewTriggerKey,
    reviewAcknowledged: ack != null,
    reviewedAt: ack?.reviewed_at ?? null,
  };
}
