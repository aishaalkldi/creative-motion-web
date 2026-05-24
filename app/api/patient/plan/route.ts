/**
 * GET /api/patient/plan?token=...
 *
 * Public endpoint — no Supabase auth session required.
 * Uses service role key server-side only.
 * Returns safe plan data; NEVER includes provider_id.
 * Token is validated but never logged.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkPatientGeneralLimit,
  enforceFailedTokenRateLimit,
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";
import { parseStoredExercises, type PrescribedExerciseV1 } from "../../../lib/exercise-resolve";
import { getAssessmentLanguage, type AssessmentLanguage } from "../../../lib/assessment-payload";

// ── Public types (imported by patient portal pages) ────────────────────────────

export type PatientSession = {
  id: string;
  sessionNumber: number;
  title: string;
  /** Normalized prescriptions; legacy string plans resolved at read time. */
  exercises: PrescribedExerciseV1[];
  /** DB status values — portal pages map these to display states */
  status: "upcoming" | "today" | "completed" | "skipped";
  scheduledAt?: string | null;
  completedAt?: string | null;
};

export type PatientPlanData = {
  patientName: string;
  /** Derived from latest assessment language; defaults to English */
  patientLanguage: AssessmentLanguage;
  diagnosis: string | null;
  planId: string;
  planTitle: string;
  programName: string;
  phaseName: string;
  phaseGoal: string;
  sessionsPerWeek: number;
  totalWeeks: number | null;
  /** Clinician note visible to the patient */
  clinicianNotes: string;
  assignedBy: string;
  assignedAt: string;
  sessions: PatientSession[];
  // provider_id is intentionally excluded
};

// ── Service client (server-side only) ─────────────────────────────────────────

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── GET /api/patient/plan?token=... ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const general = checkPatientGeneralLimit(req, "plan");
  if (!general.allowed) {
    return rateLimitExceededResponse(general.retryAfterSec);
  }

  const tokenValue = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!tokenValue) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const admin = buildAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  // 1 — Token lookup (service role bypasses RLS on patient_access_tokens)
  type TokenRow = {
    id: string;
    patient_name: string;
    patient_id: string;
    plan_id: string;
    is_active: boolean;
    expires_at: string | null;
  };
  const { data: tokenRow, error: tokenErr } = await admin
    .from("patient_access_tokens")
    .select("id, patient_name, patient_id, plan_id, is_active, expires_at")
    .eq("token", tokenValue)
    .maybeSingle<TokenRow>();

  if (tokenErr) {
    console.error("[GET /api/patient/plan] token lookup error");
    return NextResponse.json({ error: "Token validation failed." }, { status: 500 });
  }
  if (!tokenRow) {
    const limited = enforceFailedTokenRateLimit(req);
    if (limited) return limited;
    return NextResponse.json({ error: "Invalid token." }, { status: 404 });
  }
  if (!tokenRow.is_active) {
    const limited = enforceFailedTokenRateLimit(req);
    if (limited) return limited;
    return NextResponse.json({ error: "Token is inactive." }, { status: 403 });
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    const limited = enforceFailedTokenRateLimit(req);
    if (limited) return limited;
    return NextResponse.json({ error: "Token has expired." }, { status: 403 });
  }

  // 2 — Fetch treatment plan (exclude provider_id from select)
  type PlanRow = {
    id: string;
    title: string;
    structured_data: {
      programName?: string;
      phaseName?: string;
      phaseGoal?: string;
      sessionsPerWeek?: number;
      assignedBy?: string;
    } | null;
    status: string;
    total_weeks: number | null;
    clinician_note: string | null;
    created_at: string;
  };
  const { data: plan, error: planErr } = await admin
    .from("treatment_plans")
    .select("id, title, structured_data, status, total_weeks, clinician_note, created_at")
    .eq("id", tokenRow.plan_id)
    .single<PlanRow>();

  if (planErr ?? !plan) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }

  // 3 — Fetch sessions (exclude provider_id from select)
  type SessionRow = {
    id: string;
    session_number: number;
    title: string;
    exercises: unknown;
    status: string;
    scheduled_at: string | null;
    completed_at: string | null;
  };
  const { data: sessions } = await admin
    .from("plan_sessions")
    .select("id, session_number, title, exercises, status, scheduled_at, completed_at")
    .eq("plan_id", tokenRow.plan_id)
    .order("session_number", { ascending: true })
    .returns<SessionRow[]>();

  // 4 — Fetch safe patient fields only
  type PatientRow = { diagnosis: string | null };
  const { data: patientRow } = await admin
    .from("patients")
    .select("diagnosis")
    .eq("id", tokenRow.patient_id)
    .maybeSingle<PatientRow>();

  // 5 — Latest assessment language (no schema change; read existing structured_data)
  type AssessmentLangRow = { structured_data: unknown };
  const { data: latestAssessment } = await admin
    .from("assessments")
    .select("structured_data")
    .eq("patient_id", tokenRow.patient_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssessmentLangRow>();

  const patientLanguage = getAssessmentLanguage(latestAssessment?.structured_data) ?? "en";

  const sd = plan.structured_data;

  const result: PatientPlanData = {
    patientName:     tokenRow.patient_name,
    patientLanguage,
    diagnosis:       patientRow?.diagnosis ?? null,
    planId:          plan.id,
    planTitle:       plan.title,
    programName:     sd?.programName ?? plan.title ?? "Rehabilitation Plan",
    phaseName:       sd?.phaseName ?? "Phase 1",
    phaseGoal:       sd?.phaseGoal ?? "",
    sessionsPerWeek: sd?.sessionsPerWeek ?? 3,
    totalWeeks:      plan.total_weeks ?? null,
    clinicianNotes:  plan.clinician_note ?? "",
    assignedBy:      sd?.assignedBy ?? "Your therapist",
    assignedAt:      plan.created_at,
    sessions: (sessions ?? []).map((s) => ({
      id:            s.id,
      sessionNumber: s.session_number,
      title:         s.title,
      exercises:     parseStoredExercises(s.exercises),
      status:        s.status as PatientSession["status"],
      scheduledAt:   s.scheduled_at,
      completedAt:   s.completed_at,
    })),
  };

  return NextResponse.json(result);
}
