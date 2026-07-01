import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildClinicalActionFromPlanData,
  clinicalActionNeedsTherapistReview,
} from "@/app/lib/clinical-action-engine";
import {
  deriveMissedSessionsForReview,
  resolveClinicalReviewState,
  type ClinicalReviewAckRow,
} from "@/app/lib/clinical-review";
import { parseSessionCoachNotes } from "@/app/lib/session-coach-metadata";

export type ClinicianStatsResponse = {
  totalPatients: number | null;
  activeCases: number | null;
  pendingReviews: number | null;
  remoteAssessmentsPending: number | null;
  sessionsCompletedThisWeek: number | null;
  averagePlanAdherencePct: number | null;
  assessmentsSubmittedThisMonth: number | null;
  cvCapturesThisMonth: number | null;
  generatedAt: string;
};

type PlanRow = {
  id: string;
  patient_id: string;
};

type SessionRow = {
  plan_id: string;
  status: string;
  session_number: number;
};

type LogRow = {
  id: string;
  plan_id: string;
  plan_session_id: string | null;
  effort_score: number | null;
  pain_score: number | null;
  notes: string | null;
  completed_at: string;
};

type ReviewCard = {
  patientId: string;
  lastCompletedAt: string | null;
  needsReview: boolean;
  reviewAcknowledged: boolean;
};

function countPendingReviews(cards: ReviewCard[]): number {
  const urgent = cards.filter(
    (card) => card.needsReview && !card.reviewAcknowledged,
  );
  const byPatient = new Map<string, ReviewCard>();
  for (const card of urgent) {
    const existing = byPatient.get(card.patientId);
    if (!existing) {
      byPatient.set(card.patientId, card);
      continue;
    }
    const cardTime = card.lastCompletedAt ? new Date(card.lastCompletedAt).getTime() : 0;
    const existingTime = existing.lastCompletedAt ? new Date(existing.lastCompletedAt).getTime() : 0;
    if (cardTime > existingTime) {
      byPatient.set(card.patientId, card);
    }
  }
  return byPatient.size;
}

export async function fetchClinicianStats(
  adminClient: SupabaseClient,
  providerId: string,
): Promise<ClinicianStatsResponse> {
  const generatedAt = new Date().toISOString();
  const stats: ClinicianStatsResponse = {
    totalPatients: null,
    activeCases: null,
    pendingReviews: null,
    remoteAssessmentsPending: null,
    sessionsCompletedThisWeek: null,
    averagePlanAdherencePct: null,
    assessmentsSubmittedThisMonth: null,
    cvCapturesThisMonth: null,
    generatedAt,
  };

  const { count: totalPatients, error: patientsErr } = await adminClient
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId);

  if (patientsErr) {
    console.error("[clinician-stats] totalPatients query failed:", patientsErr.message);
  } else {
    stats.totalPatients = totalPatients ?? 0;
  }

  const { count: activeCases, error: activeErr } = await adminClient
    .from("treatment_plans")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .neq("status", "completed");

  if (activeErr) {
    console.error("[clinician-stats] activeCases query failed:", activeErr.message);
  } else {
    stats.activeCases = activeCases ?? 0;
  }

  const nowIso = new Date().toISOString();
  const { count: remotePending, error: remoteErr } = await adminClient
    .from("remote_assessment_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .eq("status", "pending")
    .gt("expires_at", nowIso);

  if (remoteErr) {
    if (remoteErr.code === "42P01") {
      console.error("[clinician-stats] remote_assessment_requests table missing");
    } else {
      console.error("[clinician-stats] remoteAssessmentsPending query failed:", remoteErr.message);
    }
  } else {
    stats.remoteAssessmentsPending = remotePending ?? 0;
  }

  const { data: plans, error: plansErr } = await adminClient
    .from("treatment_plans")
    .select("id, patient_id")
    .eq("provider_id", providerId)
    .returns<PlanRow[]>();

  if (plansErr) {
    console.error("[clinician-stats] pendingReviews plans query failed:", plansErr.message);
  } else if (!plans?.length) {
    stats.pendingReviews = 0;
    stats.sessionsCompletedThisWeek = 0;
    stats.averagePlanAdherencePct = 0;
  } else {
    const planIds = plans.map((plan) => plan.id);

    const [{ data: sessions, error: sessionsErr }, { data: logs, error: logsErr }, { data: ackRows, error: ackErr }] =
      await Promise.all([
        adminClient
          .from("plan_sessions")
          .select("plan_id, status, session_number")
          .in("plan_id", planIds)
          .returns<SessionRow[]>(),
        adminClient
          .from("session_logs")
          .select("id, plan_id, plan_session_id, effort_score, pain_score, notes, completed_at")
          .in("plan_id", planIds)
          .order("completed_at", { ascending: false })
          .returns<LogRow[]>(),
        adminClient
          .from("clinical_review_acknowledgments")
          .select("trigger_key, reviewed_at")
          .eq("provider_id", providerId)
          .in("plan_id", planIds)
          .returns<ClinicalReviewAckRow[]>(),
      ]);

    if (sessionsErr || logsErr) {
      console.error("[clinician-stats] pendingReviews session/log query failed");
    } else {
      const sessionsByPlan = new Map<string, SessionRow[]>();
      (sessions ?? []).forEach((session) => {
        const arr = sessionsByPlan.get(session.plan_id) ?? [];
        arr.push(session);
        sessionsByPlan.set(session.plan_id, arr);
      });

      const latestLogByPlan = new Map<string, LogRow>();
      const logsByPlan = new Map<string, LogRow[]>();
      (logs ?? []).forEach((log) => {
        if (!latestLogByPlan.has(log.plan_id)) {
          latestLogByPlan.set(log.plan_id, log);
        }
        const arr = logsByPlan.get(log.plan_id) ?? [];
        arr.push(log);
        logsByPlan.set(log.plan_id, arr);
      });

      const acknowledgmentsByTriggerKey = new Map<string, ClinicalReviewAckRow>();
      if (ackErr && ackErr.code !== "42P01") {
        console.error("[clinician-stats] pendingReviews acknowledgments query failed:", ackErr.message);
      } else {
        (ackRows ?? []).forEach((row) => {
          acknowledgmentsByTriggerKey.set(row.trigger_key, row);
        });
      }

      const reviewCards: ReviewCard[] = plans.map((plan) => {
        const planSessions = sessionsByPlan.get(plan.id) ?? [];
        const latest = latestLogByPlan.get(plan.id);
        const planLogs = logsByPlan.get(plan.id) ?? [];
        const clinicalAction = buildClinicalActionFromPlanData({
          latestLog: latest,
          sessions: planSessions.map((session) => ({
            status: session.status,
            session_number: session.session_number,
          })),
          parseNotes: parseSessionCoachNotes,
          allLogs: [...planLogs].reverse(),
        });

        const missedSessionsCount = deriveMissedSessionsForReview(
          planSessions.map((session) => ({
            status: session.status,
            session_number: session.session_number,
          })),
        );

        const reviewState = resolveClinicalReviewState({
          planId: plan.id,
          actionStatus: clinicalAction.status,
          latestSessionLogId: latest?.id ?? null,
          missedSessionsCount,
          acknowledgmentsByTriggerKey,
        });

        return {
          patientId: plan.patient_id,
          lastCompletedAt: latest?.completed_at ?? null,
          needsReview: clinicalActionNeedsTherapistReview(clinicalAction.status),
          reviewAcknowledged: reviewState.reviewAcknowledged,
        };
      });

      stats.pendingReviews = countPendingReviews(reviewCards);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      stats.sessionsCompletedThisWeek = (logs ?? []).filter(
        (log) => new Date(log.completed_at).getTime() >= weekAgo.getTime(),
      ).length;

      const adherenceSamples: number[] = [];
      for (const plan of plans) {
        const planSessions = sessionsByPlan.get(plan.id) ?? [];
        const total = planSessions.length;
        if (total === 0) continue;
        const completed = planSessions.filter((session) => session.status === "completed").length;
        adherenceSamples.push(Math.round((completed / total) * 100));
      }
      stats.averagePlanAdherencePct =
        adherenceSamples.length > 0
          ? Math.round(
              adherenceSamples.reduce((sum, value) => sum + value, 0) / adherenceSamples.length,
            )
          : 0;
    }
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: assessmentsMonth, error: assessmentsMonthErr } = await adminClient
    .from("assessments")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .gte("created_at", monthStart.toISOString());

  if (assessmentsMonthErr) {
    console.error("[clinician-stats] assessmentsSubmittedThisMonth query failed:", assessmentsMonthErr.message);
  } else {
    stats.assessmentsSubmittedThisMonth = assessmentsMonth ?? 0;
  }

  const { count: cvMonth, error: cvMonthErr } = await adminClient
    .from("cv_session_metrics")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .gte("recorded_at", monthStart.toISOString());

  if (cvMonthErr) {
    console.error("[clinician-stats] cvCapturesThisMonth query failed:", cvMonthErr.message);
  } else {
    stats.cvCapturesThisMonth = cvMonth ?? 0;
  }

  return stats;
}
