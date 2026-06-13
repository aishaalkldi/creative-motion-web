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
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";
import {
  API_ERRORS,
  invalidPatientTokenResponse,
  serviceUnavailableResponse,
  unableToCompleteResponse,
} from "../../../lib/api/safe-errors";
import { parseStoredExercises, type PrescribedExerciseV1 } from "../../../lib/exercise-resolve";
import { getAssessmentLanguage, type AssessmentLanguage } from "../../../lib/assessment-payload";
import {
  extractPlanProgramMetadata,
  resolvePatientRehabFocus,
} from "../../../lib/plan-program-metadata";
import {
  fetchPatientLifetimeSummary,
  type PatientLifetimeSummary,
} from "../../../lib/patient-lifetime-summary";
import { resolvePatientPortalAccess } from "../../../lib/patient-portal-access";

// Re-export for portal consumers
export type { PatientLifetimeSummary };

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
  /** Patient-facing rehab focus (from program metadata or safe fallback) */
  patientRehabFocus: string;
  /** Explicit patient-friendly goal from plan metadata, if set by clinician */
  patientFriendlyGoal: string | null;
  /** Pilot template id when plan was created from a program template */
  programTemplateId: string | null;
  sessionsPerWeek: number;
  totalWeeks: number | null;
  /** Clinician note visible to the patient */
  clinicianNotes: string;
  assignedBy: string;
  assignedAt: string;
  sessions: PatientSession[];
  /** Aggregate counts across all plans for this patient (no historical details). */
  lifetimeSummary: PatientLifetimeSummary;
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
    return serviceUnavailableResponse();
  }

  const resolved = await resolvePatientPortalAccess(admin, tokenValue);
  if (!resolved.ok) {
    if (resolved.reason === "invalid_token") {
      return invalidPatientTokenResponse(req);
    }
    if (resolved.reason === "plan_not_found") {
      return unableToCompleteResponse(404);
    }
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  const { access } = resolved;
  const plan = access.currentPlan;

  const lifetimeSummaryPromise = fetchPatientLifetimeSummary(admin, {
    patientId: access.patientId,
    providerId: access.providerId,
  });

  // Fetch sessions for the resolved current plan
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
    .eq("plan_id", access.currentPlanId)
    .order("session_number", { ascending: true })
    .returns<SessionRow[]>();

  // 4 — Fetch safe patient fields only
  type PatientRow = { diagnosis: string | null };
  const { data: patientRow } = await admin
    .from("patients")
    .select("diagnosis")
    .eq("id", access.patientId)
    .maybeSingle<PatientRow>();

  // 5 — Latest assessment language (no schema change; read existing structured_data)
  type AssessmentLangRow = { structured_data: unknown };
  const { data: latestAssessment } = await admin
    .from("assessments")
    .select("structured_data")
    .eq("patient_id", access.patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssessmentLangRow>();

  const patientLanguage = getAssessmentLanguage(latestAssessment?.structured_data) ?? "en";

  const lifetimeSummary = await lifetimeSummaryPromise;

  const sd = plan.structured_data;
  const programMeta = extractPlanProgramMetadata(sd);

  const result: PatientPlanData = {
    patientName:     access.patientName,
    patientLanguage,
    diagnosis:       patientRow?.diagnosis ?? null,
    planId:          plan.id,
    planTitle:       plan.title,
    programName:     sd?.programName ?? plan.title ?? "Rehabilitation Plan",
    phaseName:       sd?.phaseName ?? "Phase 1",
    phaseGoal:       sd?.phaseGoal ?? "",
    patientRehabFocus: resolvePatientRehabFocus(sd, sd?.phaseGoal, patientLanguage),
    patientFriendlyGoal: programMeta.patientFriendlyGoal ?? null,
    programTemplateId: programMeta.programTemplateId ?? null,
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
    lifetimeSummary,
  };

  return NextResponse.json(result);
}
