import type { ClinicianResultsResponse, ClinicianResultCard } from "@/app/api/clinician/results/route";
import type { AssessmentSnapshot } from "@/app/lib/assessment-snapshot";
import type { DashboardStats } from "@/app/lib/api";
import { clinicalActionNeedsTherapistReview } from "@/app/lib/clinical-action-engine";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

export type PilotAttentionPriority = "high" | "medium" | "low";

export type PilotAttentionSource = "review" | "assessment" | "plan" | "progress";

export type PilotAttentionItem = {
  patientId: string;
  patientName: string;
  priority: PilotAttentionPriority;
  reason: string;
  actionLabel: string;
  href: string;
  source: PilotAttentionSource;
};

export type PatientOperationalBadge = {
  label: string;
  tone: "review" | "rehab" | "assessment" | "plan" | "muted";
};

export type PatientOperationalSummary = {
  badges: PatientOperationalBadge[];
  lastActivityAt: string | null;
  hasPlan: boolean;
  sessionsCompleted: number;
  totalSessions: number;
  /** Latest session log completion on primary plan (not assessment dates). */
  lastSessionAt: string | null;
};

const PRIORITY_RANK: Record<PilotAttentionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY_DAYS = 14;

function patientNameById(patients: PatientRow[], patientId: string): string {
  return patients.find((p) => p.id === patientId)?.full_name?.trim() || "Patient";
}

function pickPrimaryRehabPlan(cards: ClinicianResultCard[]): ClinicianResultCard | null {
  if (cards.length === 0) return null;
  const active = cards.filter((card) => card.sessionsCompleted > 0);
  if (active.length > 0) {
    return [...active].sort((a, b) => {
      const aTime = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
      const bTime = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
      return bTime - aTime;
    })[0]!;
  }
  return cards[0]!;
}

function reportHref(patientId: string, assessmentId: string): string {
  const params = new URLSearchParams({ patientId, assessmentId });
  return `/clinician/assessment/report?${params.toString()}`;
}

function isRecentActivity(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= RECENT_ACTIVITY_DAYS * MS_PER_DAY;
}

function compareAttentionItems(a: PilotAttentionItem, b: PilotAttentionItem): number {
  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return a.patientName.localeCompare(b.patientName);
}

type PatientContext = {
  patientId: string;
  patientName: string;
  assessment: AssessmentSnapshot | null;
  primaryPlan: ClinicianResultCard | null;
  allPlans: ClinicianResultCard[];
};

function buildPatientContexts(
  patients: PatientRow[],
  results: ClinicianResultsResponse | null,
): PatientContext[] {
  const assessmentsByPatient = new Map<string, AssessmentSnapshot>();
  for (const snapshot of results?.patientAssessments ?? []) {
    assessmentsByPatient.set(snapshot.patientId, snapshot);
  }

  const plansByPatient = new Map<string, ClinicianResultCard[]>();
  for (const card of results?.cards ?? []) {
    const group = plansByPatient.get(card.patientId) ?? [];
    group.push(card);
    plansByPatient.set(card.patientId, group);
  }

  const patientIds = new Set<string>([
    ...patients.map((p) => p.id),
    ...assessmentsByPatient.keys(),
    ...plansByPatient.keys(),
  ]);

  return Array.from(patientIds).map((patientId) => ({
    patientId,
    patientName: patientNameById(patients, patientId),
    assessment: assessmentsByPatient.get(patientId) ?? null,
    allPlans: plansByPatient.get(patientId) ?? [],
    primaryPlan: pickPrimaryRehabPlan(plansByPatient.get(patientId) ?? []),
  }));
}

function deriveAttentionItem(ctx: PatientContext): PilotAttentionItem | null {
  const profileHref = `/clinician/patients/${ctx.patientId}`;
  const plan = ctx.primaryPlan;

  if (
    plan &&
    plan.needsReview &&
    !plan.reviewAcknowledged &&
    clinicalActionNeedsTherapistReview(plan.clinicalAction.status)
  ) {
    return {
      patientId: ctx.patientId,
      patientName: ctx.patientName,
      priority: "high",
      reason: "Needs clinician review",
      actionLabel: "Open chart",
      href: `${profileHref}#progress-snapshot`,
      source: "review",
    };
  }

  if (ctx.assessment && !plan) {
    return {
      patientId: ctx.patientId,
      patientName: ctx.patientName,
      priority: "medium",
      reason: "Assessment available for review",
      actionLabel: "View assessment",
      href: reportHref(ctx.patientId, ctx.assessment.assessmentId),
      source: "assessment",
    };
  }

  if (plan && plan.sessionsCompleted === 0 && !isRecentActivity(plan.lastCompletedAt)) {
    return {
      patientId: ctx.patientId,
      patientName: ctx.patientName,
      priority: "low",
      reason: "No recent activity recorded",
      actionLabel: "Open chart",
      href: `${profileHref}#rehabilitation-plan`,
      source: "progress",
    };
  }

  if (!ctx.assessment && !plan) {
    return {
      patientId: ctx.patientId,
      patientName: ctx.patientName,
      priority: "medium",
      reason: "Plan may need assignment",
      actionLabel: "Assign plan",
      href: `/clinician/plans/new?patientId=${encodeURIComponent(ctx.patientId)}`,
      source: "plan",
    };
  }

  if (plan && plan.sessionsCompleted > 0 && isRecentActivity(plan.lastCompletedAt)) {
    return {
      patientId: ctx.patientId,
      patientName: ctx.patientName,
      priority: "low",
      reason: "Patient activity available",
      actionLabel: "Open chart",
      href: `${profileHref}#progress-snapshot`,
      source: "progress",
    };
  }

  if (plan || ctx.assessment) {
    const lastAt = plan?.lastCompletedAt ?? ctx.assessment?.submittedAt ?? null;
    if (!isRecentActivity(lastAt)) {
      return {
        patientId: ctx.patientId,
        patientName: ctx.patientName,
        priority: "low",
        reason: "No recent activity recorded",
        actionLabel: "Open chart",
        href: profileHref,
        source: "progress",
      };
    }
  }

  return null;
}

/**
 * Merges existing clinician stats, results, and patient list into ranked follow-up items.
 * No new API calls — pure transform for dashboard and patient list badges.
 */
export function buildPilotAttentionQueue(input: {
  patients: PatientRow[];
  stats: DashboardStats | null;
  results: ClinicianResultsResponse | null;
  limit?: number;
}): PilotAttentionItem[] {
  const { patients, stats, results, limit = 8 } = input;
  const contexts = buildPatientContexts(patients, results);

  const items = contexts
    .map(deriveAttentionItem)
    .filter((item): item is PilotAttentionItem => item != null)
    .sort(compareAttentionItems);

  // Surface aggregate review hint when stats show pending work but per-patient rows are sparse.
  if (
    items.length === 0 &&
    stats?.pendingReviews != null &&
    stats.pendingReviews > 0
  ) {
    items.push({
      patientId: "",
      patientName: "Review queue",
      priority: "high",
      reason: "Needs clinician review",
      actionLabel: "Review results",
      href: "/clinician/results",
      source: "review",
    });
  }

  return items.slice(0, limit);
}

export function buildPatientOperationalSummaries(
  patients: PatientRow[],
  results: ClinicianResultsResponse | null,
): Map<string, PatientOperationalSummary> {
  const map = new Map<string, PatientOperationalSummary>();

  for (const ctx of buildPatientContexts(patients, results)) {
    const badges: PatientOperationalBadge[] = [];
    const plan = ctx.primaryPlan;

    if (
      plan &&
      plan.needsReview &&
      !plan.reviewAcknowledged &&
      clinicalActionNeedsTherapistReview(plan.clinicalAction.status)
    ) {
      badges.push({ label: "Needs review", tone: "review" });
    }

    if (plan && plan.sessionsCompleted > 0) {
      badges.push({ label: "In rehab", tone: "rehab" });
    } else if (plan) {
      badges.push({ label: "Plan assigned", tone: "plan" });
    }

    if (ctx.assessment) {
      badges.push({ label: "Assessment available", tone: "assessment" });
    }

    const lastActivityAt =
      plan?.lastCompletedAt ?? ctx.assessment?.submittedAt ?? null;

    map.set(ctx.patientId, {
      badges,
      lastActivityAt,
      hasPlan: Boolean(plan),
      sessionsCompleted: plan?.sessionsCompleted ?? 0,
      totalSessions: plan?.totalSessions ?? 0,
      lastSessionAt: plan?.lastCompletedAt ?? null,
    });
  }

  for (const patient of patients) {
    if (!map.has(patient.id)) {
      map.set(patient.id, {
        badges: [],
        lastActivityAt: null,
        hasPlan: false,
        sessionsCompleted: 0,
        totalSessions: 0,
        lastSessionAt: null,
      });
    }
  }

  return map;
}

export function formatLastActivity(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}
