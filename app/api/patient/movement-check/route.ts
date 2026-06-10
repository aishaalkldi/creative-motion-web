/**
 * GET /api/patient/movement-check?token=...
 *
 * Token-scoped patient-safe movement check metrics only.
 * Returns rep counts / hold duration — no clinical or tracking fields.
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
import {
  isPatientMovementCheckExerciseId,
  patientMovementCheckValue,
  type PatientMovementCheckMetricRow,
} from "../../../lib/patient-movement-check";

export type PatientMovementCheckResponse = {
  metrics: PatientMovementCheckMetricRow[];
};

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const general = checkPatientGeneralLimit(req, "movement-check");
  if (!general.allowed) {
    return rateLimitExceededResponse(general.retryAfterSec);
  }

  const tokenValue = new URL(req.url).searchParams.get("token")?.trim() ?? "";
  if (!tokenValue) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const admin = buildAdminClient();
  if (!admin) return serviceUnavailableResponse();

  type TokenRow = {
    patient_id: string;
    plan_id: string;
    is_active: boolean;
    expires_at: string | null;
  };

  const { data: tokenRow, error: tokenErr } = await admin
    .from("patient_access_tokens")
    .select("patient_id, plan_id, is_active, expires_at")
    .eq("token", tokenValue)
    .maybeSingle<TokenRow>();

  if (tokenErr) {
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }
  if (!tokenRow || !tokenRow.is_active) {
    return invalidPatientTokenResponse(req);
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return invalidPatientTokenResponse(req);
  }

  type MetricRow = {
    exercise_id: string;
    rep_count: number | null;
    session_duration_s: number | null;
    recorded_at: string;
  };

  const { data: rows, error: metricsErr } = await admin
    .from("cv_session_metrics")
    .select("exercise_id, rep_count, session_duration_s, recorded_at")
    .eq("patient_id", tokenRow.patient_id)
    .eq("plan_id", tokenRow.plan_id)
    .order("recorded_at", { ascending: true });

  if (metricsErr) {
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  const metrics: PatientMovementCheckMetricRow[] = [];

  for (const row of rows ?? []) {
    const exerciseId = row.exercise_id?.trim().toLowerCase() ?? "";
    if (!isPatientMovementCheckExerciseId(exerciseId)) continue;
    const value = patientMovementCheckValue(
      exerciseId,
      row.rep_count,
      row.session_duration_s,
    );
    if (value == null) continue;
    metrics.push({
      exerciseId,
      recordedAt: row.recorded_at,
      value,
    });
  }

  return NextResponse.json({ metrics } satisfies PatientMovementCheckResponse);
}
