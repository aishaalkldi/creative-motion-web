/**
 * GET /api/clinician/results
 *
 * Supabase-backed rehabilitation progress for the authenticated provider.
 * One card per treatment plan (not legacy FastAPI results).
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type ClinicianResultStatus = "pending_review" | "active" | "completed";

export type ClinicianResultCard = {
  planId: string;
  patientId: string;
  patientName: string;
  planTitle: string;
  programName: string;
  sessionsCompleted: number;
  totalSessions: number;
  progressPct: number;
  latestEffortScore: number | null;
  latestPainScore: number | null;
  lastCompletedAt: string | null;
  status: ClinicianResultStatus;
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

function deriveStatus(completed: number, total: number): ClinicianResultStatus {
  if (total > 0 && completed >= total) return "completed";
  if (completed > 0) return "active";
  return "pending_review";
}

export async function GET(_req: NextRequest) {
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

  type PatientRow = { id: string; full_name: string };
  const { data: patients, error: patientsErr } = await adminClient
    .from("patients")
    .select("id, full_name")
    .eq("provider_id", user.id)
    .returns<PatientRow[]>();

  if (patientsErr) {
    console.error("[GET /api/clinician/results] patients query failed");
    return NextResponse.json({ error: "Failed to load results." }, { status: 500 });
  }

  const patientMap = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  if (patientMap.size === 0) {
    return NextResponse.json([] satisfies ClinicianResultCard[]);
  }

  type PlanRow = {
    id: string;
    patient_id: string;
    title: string;
    structured_data: { programName?: string } | null;
    status: string;
    created_at: string;
  };

  const { data: plans, error: plansErr } = await adminClient
    .from("treatment_plans")
    .select("id, patient_id, title, structured_data, status, created_at")
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false })
    .returns<PlanRow[]>();

  if (plansErr) {
    console.error("[GET /api/clinician/results] plans query failed");
    return NextResponse.json({ error: "Failed to load results." }, { status: 500 });
  }

  if (!plans?.length) {
    return NextResponse.json([] satisfies ClinicianResultCard[]);
  }

  const planIds = plans.map((p) => p.id);

  type SessionRow = { plan_id: string; status: string };
  const { data: sessions } = await adminClient
    .from("plan_sessions")
    .select("plan_id, status")
    .in("plan_id", planIds)
    .returns<SessionRow[]>();

  type LogRow = {
    plan_id: string;
    effort_score: number | null;
    pain_score: number | null;
    completed_at: string;
  };
  const { data: logs } = await adminClient
    .from("session_logs")
    .select("plan_id, effort_score, pain_score, completed_at")
    .in("plan_id", planIds)
    .order("completed_at", { ascending: false })
    .returns<LogRow[]>();

  const sessionsByPlan = new Map<string, SessionRow[]>();
  (sessions ?? []).forEach((s) => {
    const arr = sessionsByPlan.get(s.plan_id) ?? [];
    arr.push(s);
    sessionsByPlan.set(s.plan_id, arr);
  });

  const latestLogByPlan = new Map<string, LogRow>();
  (logs ?? []).forEach((log) => {
    if (!latestLogByPlan.has(log.plan_id)) {
      latestLogByPlan.set(log.plan_id, log);
    }
  });

  const cards: ClinicianResultCard[] = plans.map((plan) => {
    const planSessions = sessionsByPlan.get(plan.id) ?? [];
    const total = planSessions.length;
    const completed = planSessions.filter((s) => s.status === "completed").length;
    const latest = latestLogByPlan.get(plan.id);

    return {
      planId: plan.id,
      patientId: plan.patient_id,
      patientName: patientMap.get(plan.patient_id) ?? "Patient",
      planTitle: plan.title,
      programName: plan.structured_data?.programName ?? plan.title,
      sessionsCompleted: completed,
      totalSessions: total,
      progressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
      latestEffortScore: latest?.effort_score ?? null,
      latestPainScore: latest?.pain_score ?? null,
      lastCompletedAt: latest?.completed_at ?? null,
      status: deriveStatus(completed, total),
    };
  });

  return NextResponse.json(cards);
}
