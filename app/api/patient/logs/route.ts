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
  enforceFailedTokenRateLimit,
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";

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
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  // Validate token first
  type TokenRow = { is_active: boolean; expires_at: string | null };
  const { data: tokenRow, error: tokenErr } = await admin
    .from("patient_access_tokens")
    .select("is_active, expires_at")
    .eq("token", tokenValue)
    .maybeSingle<TokenRow>();

  if (tokenErr) {
    return NextResponse.json({ error: "Could not validate token." }, { status: 500 });
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

  // Fetch logs (safe fields only — no provider_id, no patient_id)
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
    .eq("patient_token", tokenValue)
    .order("completed_at", { ascending: false })
    .returns<LogRow[]>();

  if (logsErr) {
    console.error("[GET /api/patient/logs] query failed:", logsErr.message);
    return NextResponse.json({ error: "Could not load session logs." }, { status: 500 });
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
