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
  buildClinicalActionFromPlanData,
  clinicalActionNeedsTherapistReview,
  type ClinicalActionResult,
} from "../../../lib/clinical-action-engine";
import {
  formatPainResponse,
  parseSessionCoachNotes,
} from "../../../lib/session-coach-metadata";

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
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
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

  let planId = planIdParam;
  if (!planId) {
    const { data: plan } = await adminClient
      .from("treatment_plans")
      .select("id")
      .eq("patient_id", patientId)
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
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
    .select("effort_score, pain_score, notes, completed_at")
    .eq("plan_id", planId)
    .order("completed_at", { ascending: false })
    .returns<{
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
  };

  return NextResponse.json(summary);
}
