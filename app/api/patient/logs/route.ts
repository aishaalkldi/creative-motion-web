/**
 * GET /api/patient/logs?token=...
 *
 * Public endpoint — no Supabase auth session required.
 * Uses service role key server-side only.
 * Returns session completion logs for the given token.
 * provider_id is never returned to client.
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
} from "../../../lib/api/safe-errors";
import { resolvePatientPortalAccess } from "../../../lib/patient-portal-access";

// ── Public types ───────────────────────────────────────────────────────────────

export type SessionLogEntry = {
  id: string;
  planSessionId: string | null;
  effortScore: number | null;
  painScore: number | null;
  exercisesCompleted: number;
  notes: string | null;
  completedAt: string;
};

// ── Service client ─────────────────────────────────────────────────────────────

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── GET /api/patient/logs?token=... ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const general = checkPatientGeneralLimit(req, "logs");
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
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  // Current-plan logs only (resolved plan, not token-bound plan_id)
  type LogRow = {
    id: string;
    plan_session_id: string | null;
    effort_score: number | null;
    pain_score: number | null;
    exercises_completed: number;
    notes: string | null;
    completed_at: string;
  };
  const { data: logs, error: logsErr } = await admin
    .from("session_logs")
    .select("id, plan_session_id, effort_score, pain_score, exercises_completed, notes, completed_at")
    .eq("plan_id", resolved.access.currentPlanId)
    .order("completed_at", { ascending: false })
    .returns<LogRow[]>();

  if (logsErr) {
    console.error("[GET /api/patient/logs] query failed:", logsErr.message);
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  const result: SessionLogEntry[] = (logs ?? []).map((l) => ({
    id:                 l.id,
    planSessionId:      l.plan_session_id,
    effortScore:        l.effort_score,
    painScore:          l.pain_score,
    exercisesCompleted: l.exercises_completed,
    notes:              l.notes,
    completedAt:        l.completed_at,
  }));

  return NextResponse.json(result);
}
