/**
 * POST /api/patient/session-complete
 *
 * Public endpoint — no Supabase auth session required.
 * Uses service role key server-side only.
 * Idempotent per plan_session_id: at most one session_logs row per session.
 *
 * Token is never logged. provider_id is never returned to client.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkPatientGeneralLimit,
  enforceFailedTokenRateLimit,
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";

// ── Types ──────────────────────────────────────────────────────────────────────

type RequestBody = {
  token?: string;
  sessionId?: string;
  effortScore?: number | null;
  painScore?: number | null;
  exercisesCompleted?: number | null;
  notes?: string | null;
};

export type SessionCompleteResponse = {
  id: string;
  completed_at: string;
  alreadyCompleted?: boolean;
};

type LogRow = { id: string; completed_at: string };

type SessionRow = {
  id: string;
  plan_id: string;
  status: string;
  completed_at: string | null;
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

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

async function fetchLatestLog(
  admin: SupabaseClient,
  sessionId: string,
): Promise<LogRow | null> {
  const { data, error } = await admin
    .from("session_logs")
    .select("id, completed_at")
    .eq("plan_session_id", sessionId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<LogRow>();

  if (error) {
    console.error("[POST /api/patient/session-complete] log lookup error");
    return null;
  }
  return data;
}

function completionResponse(
  log: LogRow,
  alreadyCompleted: boolean,
): NextResponse {
  const body: SessionCompleteResponse = {
    id: log.id,
    completed_at: log.completed_at,
    ...(alreadyCompleted ? { alreadyCompleted: true } : {}),
  };
  return NextResponse.json(body, { status: alreadyCompleted ? 200 : 201 });
}

type InsertPayload = {
  plan_id: string;
  plan_session_id: string;
  provider_id: string;
  patient_id: string;
  patient_token: string;
  effort_score: number | null;
  pain_score: number | null;
  exercises_completed: number;
  notes: string | null;
  completed_at: string;
};

async function insertSessionLog(
  admin: SupabaseClient,
  payload: InsertPayload,
): Promise<{ log: LogRow | null; duplicate: boolean; error: unknown }> {
  const { data, error } = await admin
    .from("session_logs")
    .insert(payload)
    .select("id, completed_at")
    .single<LogRow>();

  if (error) {
    if (isUniqueViolation(error)) {
      return { log: null, duplicate: true, error: null };
    }
    console.error("[POST /api/patient/session-complete] session_logs insert failed");
    return { log: null, duplicate: false, error };
  }
  return { log: data, duplicate: false, error: null };
}

async function markSessionCompleted(
  admin: SupabaseClient,
  sessionId: string,
  completedAt: string,
): Promise<boolean> {
  const { error } = await admin
    .from("plan_sessions")
    .update({ status: "completed", completed_at: completedAt })
    .eq("id", sessionId);

  if (error) {
    console.error("[POST /api/patient/session-complete] plan_sessions update failed");
    return false;
  }
  return true;
}

// ── POST /api/patient/session-complete ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const general = checkPatientGeneralLimit(req, "session-complete");
  if (!general.allowed) {
    return rateLimitExceededResponse(general.retryAfterSec);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const tokenValue = body.token?.trim() ?? "";
  const sessionId  = body.sessionId?.trim() ?? "";

  if (!tokenValue) return NextResponse.json({ error: "Token is required."    }, { status: 400 });
  if (!sessionId)  return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const effortScore        = body.effortScore        ?? null;
  const painScore          = body.painScore          ?? null;
  const exercisesCompleted = body.exercisesCompleted ?? 0;
  const notes              = body.notes?.trim()      ?? null;

  if (effortScore !== null && (effortScore < 1 || effortScore > 10)) {
    return NextResponse.json({ error: "effortScore must be between 1 and 10." }, { status: 400 });
  }
  if (painScore !== null && (painScore < 0 || painScore > 10)) {
    return NextResponse.json({ error: "painScore must be between 0 and 10." }, { status: 400 });
  }
  if (exercisesCompleted < 0) {
    return NextResponse.json({ error: "exercisesCompleted must be >= 0." }, { status: 400 });
  }

  const admin = buildAdminClient();
  if (!admin) return NextResponse.json({ error: "Service not configured." }, { status: 503 });

  // 1 — Validate token
  type TokenRow = {
    patient_id:   string;
    plan_id:      string;
    provider_id:  string;
    is_active:    boolean;
    expires_at:   string | null;
  };
  const { data: tokenRow, error: tokenErr } = await admin
    .from("patient_access_tokens")
    .select("patient_id, plan_id, provider_id, is_active, expires_at")
    .eq("token", tokenValue)
    .maybeSingle<TokenRow>();

  if (tokenErr) {
    console.error("[POST /api/patient/session-complete] token lookup error");
    return NextResponse.json({ error: "Could not validate session." }, { status: 500 });
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

  // 2 — Validate session belongs to this token's plan
  const { data: sessionRow, error: sessionErr } = await admin
    .from("plan_sessions")
    .select("id, plan_id, status, completed_at")
    .eq("id", sessionId)
    .eq("plan_id", tokenRow.plan_id)
    .maybeSingle<SessionRow>();

  if (sessionErr) {
    console.error("[POST /api/patient/session-complete] session lookup error");
    return NextResponse.json({ error: "Could not validate session." }, { status: 500 });
  }
  if (!sessionRow) {
    return NextResponse.json({ error: "Session not found for this plan." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const logPayload: InsertPayload = {
    plan_id:             tokenRow.plan_id,
    plan_session_id:     sessionId,
    provider_id:         tokenRow.provider_id,
    patient_id:          tokenRow.patient_id,
    patient_token:       tokenValue,
    effort_score:        effortScore,
    pain_score:          painScore,
    exercises_completed: exercisesCompleted,
    notes:               notes,
    completed_at:        now,
  };

  // 3 — Already completed: return existing log or backfill once
  if (sessionRow.status === "completed") {
    const existing = await fetchLatestLog(admin, sessionId);
    if (existing) {
      return completionResponse(existing, true);
    }

    const backfill = await insertSessionLog(admin, logPayload);
    if (backfill.duplicate) {
      const raced = await fetchLatestLog(admin, sessionId);
      if (raced) return completionResponse(raced, true);
      return NextResponse.json({ error: "Could not record session completion." }, { status: 500 });
    }
    if (backfill.error || !backfill.log) {
      return NextResponse.json({ error: "Could not record session completion." }, { status: 500 });
    }

    return completionResponse(backfill.log, true);
  }

  // 4 — First completion: insert log, then mark session completed
  const insert = await insertSessionLog(admin, logPayload);

  if (insert.duplicate) {
    const existing = await fetchLatestLog(admin, sessionId);
    if (!existing) {
      return NextResponse.json({ error: "Could not record session completion." }, { status: 500 });
    }
    await markSessionCompleted(admin, sessionId, existing.completed_at);
    return completionResponse(existing, true);
  }

  if (insert.error || !insert.log) {
    return NextResponse.json({ error: "Could not record session completion." }, { status: 500 });
  }

  const statusOk = await markSessionCompleted(admin, sessionId, now);
  if (!statusOk) {
    return NextResponse.json({ error: "Could not record session completion." }, { status: 500 });
  }

  return completionResponse(insert.log, false);
}
