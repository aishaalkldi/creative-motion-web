/**
 * GET /api/clinician/patient-progress?patientId=UUID&planId=UUID
 *
 * Latest session completion metrics for clinician patient profile.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validatePatientOwnership } from "../../../lib/validate-patient-ownership";
import {
  serviceUnavailableResponse,
  unableToCompleteResponse,
  genericServerErrorResponse,
} from "../../../lib/api/safe-errors";
import {
  buildClinicalActionFromPlanData,
  clinicalActionNeedsTherapistReview,
  type ClinicalActionResult,
} from "../../../lib/clinical-action-engine";
import {
  formatPainResponse,
  parseSessionCoachNotes,
} from "../../../lib/session-coach-metadata";
import {
  deriveMissedSessionsForReview,
  resolveClinicalReviewState,
  type ClinicalReviewAckRow,
} from "../../../lib/clinical-review";

export type PatientProgressSummary = {
  planId: string;
  sessionsCompleted: number;
  totalSessions: number;
  progressPct: number;
  latestEffortScore: number | null;
  latestPainScore: number | null;
  latestPainBeforeScore: number | null;
  latestPainResponse: string | null;
  safetyConcernReported: boolean;
  needsReview: boolean;
  clinicalAction: ClinicalActionResult;
  latestPatientNote: string | null;
  lastCompletedAt: string | null;
  latestSessionLogId: string | null;
  planSessionId: string | null;
  clinicalReviewTriggerKey: string | null;
  reviewAcknowledged: boolean;
  reviewedAt: string | null;
};

async function buildClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return null;

  const cookieStore = await cookies();
  const sessionClient = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* read-only */
        }
      },
    },
  });
  const adminClient = svc
    ? createAdminClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
    : sessionClient;
  return { sessionClient, adminClient };
}

export async function GET(req: NextRequest) {
  const clients = await buildClients();
  if (!clients) {
    return serviceUnavailableResponse();
  }
  const { sessionClient, adminClient } = clients;

  const {
    data: { user },
    error: authErr,
  } = await sessionClient.auth.getUser();
  if (authErr ?? !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const patientId = new URL(req.url).searchParams.get("patientId")?.trim() ?? "";
  const planIdParam = new URL(req.url).searchParams.get("planId")?.trim() ?? "";

  if (!patientId) {
    return NextResponse.json({ error: "patientId is required." }, { status: 400 });
  }

  const ownership = await validatePatientOwnership(adminClient, patientId, user.id);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.message }, { status: ownership.httpStatus });
  }

  let planId: string;
  if (planIdParam) {
    const { data: plan, error: planErr } = await adminClient
      .from("treatment_plans")
      .select("id")
      .eq("id", planIdParam)
      .eq("patient_id", patientId)
      .eq("provider_id", user.id)
      .maybeSingle<{ id: string }>();

    if (planErr) {
      console.error("[GET /api/clinician/patient-progress] plan lookup failed:", planErr.message);
      return genericServerErrorResponse();
    }
    if (!plan) {
      return unableToCompleteResponse(404);
    }
    planId = plan.id;
  } else {
    const { data: plan, error: planErr } = await adminClient
      .from("treatment_plans")
      .select("id")
      .eq("patient_id", patientId)
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (planErr) {
      console.error("[GET /api/clinician/patient-progress] plan lookup failed:", planErr.message);
      return genericServerErrorResponse();
    }
    if (!plan) {
      return NextResponse.json({ error: "No plan found." }, { status: 404 });
    }
    planId = plan.id;
  }

  const { data: sessions } = await adminClient
    .from("plan_sessions")
    .select("status, session_number")
    .eq("plan_id", planId)
    .returns<{ status: string; session_number: number }[]>();

  const total = sessions?.length ?? 0;
  const completed = (sessions ?? []).filter((s) => s.status === "completed").length;

  const { data: planLogs } = await adminClient
    .from("session_logs")
    .select("id, plan_session_id, effort_score, pain_score, notes, completed_at")
    .eq("plan_id", planId)
    .order("completed_at", { ascending: false })
    .returns<{
      id: string;
      plan_session_id: string | null;
      effort_score: number | null;
      pain_score: number | null;
      notes: string | null;
      completed_at: string;
    }[]>();

  const latestLog = planLogs?.[0] ?? null;

  const coachMeta = parseSessionCoachNotes(latestLog?.notes);
  const painAfter = latestLog?.pain_score ?? null;
  const clinicalAction = buildClinicalActionFromPlanData({
    latestLog,
    sessions: sessions ?? [],
    parseNotes: parseSessionCoachNotes,
    allLogs: [...(planLogs ?? [])].reverse(),
  });

  const missedSessionsCount = deriveMissedSessionsForReview(sessions ?? []);
  const acknowledgmentsByTriggerKey = new Map<string, ClinicalReviewAckRow>();
  const { data: ackRows, error: ackErr } = await adminClient
    .from("clinical_review_acknowledgments")
    .select("trigger_key, reviewed_at")
    .eq("provider_id", user.id)
    .eq("plan_id", planId)
    .returns<ClinicalReviewAckRow[]>();

  if (!ackErr) {
    (ackRows ?? []).forEach((row) => {
      acknowledgmentsByTriggerKey.set(row.trigger_key, row);
    });
  }

  const reviewState = resolveClinicalReviewState({
    planId,
    actionStatus: clinicalAction.status,
    latestSessionLogId: latestLog?.id ?? null,
    missedSessionsCount,
    acknowledgmentsByTriggerKey,
  });

  const summary: PatientProgressSummary = {
    planId,
    sessionsCompleted: completed,
    totalSessions: total,
    progressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    latestEffortScore: latestLog?.effort_score ?? null,
    latestPainScore: painAfter,
    latestPainBeforeScore: coachMeta.painBefore,
    latestPainResponse: formatPainResponse(coachMeta.painBefore, painAfter),
    safetyConcernReported: coachMeta.safetyConcern,
    needsReview: clinicalActionNeedsTherapistReview(clinicalAction.status),
    clinicalAction,
    latestPatientNote: coachMeta.patientNote,
    lastCompletedAt: latestLog?.completed_at ?? null,
    latestSessionLogId: latestLog?.id ?? null,
    planSessionId: latestLog?.plan_session_id ?? null,
    clinicalReviewTriggerKey: reviewState.clinicalReviewTriggerKey,
    reviewAcknowledged: reviewState.reviewAcknowledged,
    reviewedAt: reviewState.reviewedAt,
  };

  return NextResponse.json(summary);
}
