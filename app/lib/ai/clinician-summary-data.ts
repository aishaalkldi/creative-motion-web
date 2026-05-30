import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildClinicalActionFromPlanData,
  type ClinicalActionStatus,
} from "@/app/lib/clinical-action-engine";
import { parseSessionCoachNotes } from "@/app/lib/session-coach-metadata";
import type {
  ClinicianSummaryAssessmentRow,
  ClinicianSummaryCvRow,
  ClinicianSummaryFetchContext,
  ClinicianSummarySessionLogRow,
} from "./clinician-summary-input";

async function resolvePlanId(
  adminClient: SupabaseClient,
  patientId: string,
  providerId: string,
  planIdParam: string | null,
): Promise<{ planId: string } | { error: "not_found" }> {
  if (planIdParam) {
    const { data: plan, error } = await adminClient
      .from("treatment_plans")
      .select("id")
      .eq("id", planIdParam)
      .eq("patient_id", patientId)
      .eq("provider_id", providerId)
      .maybeSingle<{ id: string }>();

    if (error) throw error;
    if (!plan) return { error: "not_found" };
    return { planId: plan.id };
  }

  const { data: plan, error } = await adminClient
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  if (!plan) return { error: "not_found" };
  return { planId: plan.id };
}

export async function fetchClinicianSummaryContext(
  adminClient: SupabaseClient,
  patientId: string,
  providerId: string,
  planIdParam: string | null,
): Promise<
  | { ok: true; context: ClinicianSummaryFetchContext }
  | { ok: false; error: "not_found" }
> {
  const planResult = await resolvePlanId(adminClient, patientId, providerId, planIdParam);
  if ("error" in planResult) {
    return { ok: false, error: "not_found" };
  }
  const planId = planResult.planId;

  const { data: sessions, error: sessionsErr } = await adminClient
    .from("plan_sessions")
    .select("status, session_number")
    .eq("plan_id", planId)
    .returns<{ status: string; session_number: number }[]>();

  if (sessionsErr) throw sessionsErr;

  const { data: rawLogs, error: logsErr } = await adminClient
    .from("session_logs")
    .select(
      "plan_session_id, effort_score, pain_score, exercises_completed, notes, completed_at",
    )
    .eq("plan_id", planId)
    .order("completed_at", { ascending: false })
    .returns<{
      plan_session_id: string | null;
      effort_score: number | null;
      pain_score: number | null;
      exercises_completed: number | null;
      notes: string | null;
      completed_at: string;
    }[]>();

  if (logsErr) throw logsErr;

  const sessionIds = [
    ...new Set(
      (rawLogs ?? [])
        .map((log) => log.plan_session_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const sessionNumberById = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: sessionRows, error: sessionNumErr } = await adminClient
      .from("plan_sessions")
      .select("id, session_number")
      .in("id", sessionIds)
      .returns<{ id: string; session_number: number }[]>();

    if (sessionNumErr) throw sessionNumErr;
    (sessionRows ?? []).forEach((row) => {
      sessionNumberById.set(row.id, row.session_number);
    });
  }

  const sessionLogs: ClinicianSummarySessionLogRow[] = (rawLogs ?? []).map((log) => ({
    session_number: log.plan_session_id
      ? sessionNumberById.get(log.plan_session_id) ?? null
      : null,
    effort_score: log.effort_score,
    pain_score: log.pain_score,
    exercises_completed: log.exercises_completed,
    notes: log.notes,
    completed_at: log.completed_at,
  }));

  const latestLog = rawLogs?.[0] ?? null;
  const clinicalAction = buildClinicalActionFromPlanData({
    latestLog,
    sessions: sessions ?? [],
    parseNotes: parseSessionCoachNotes,
    allLogs: [...(rawLogs ?? [])].reverse(),
  });

  const { data: cvRows, error: cvErr } = await adminClient
    .from("cv_session_metrics")
    .select(
      "exercise_id, rep_count, session_duration_s, tracking_quality, movement_detected, recorded_at",
    )
    .eq("provider_id", providerId)
    .eq("patient_id", patientId)
    .eq("plan_id", planId)
    .order("recorded_at", { ascending: false })
    .limit(10)
    .returns<ClinicianSummaryCvRow[]>();

  if (cvErr) throw cvErr;

  const { data: assessmentRow, error: assessmentErr } = await adminClient
    .from("assessments")
    .select("type, structured_data, created_at")
    .eq("patient_id", patientId)
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ClinicianSummaryAssessmentRow>();

  if (assessmentErr) throw assessmentErr;

  return {
    ok: true,
    context: {
      planId,
      sessions: sessions ?? [],
      sessionLogs,
      cvMetrics: cvRows ?? [],
      assessment: assessmentRow ?? null,
      clinicalActionStatus: clinicalAction.status as ClinicalActionStatus,
    },
  };
}
