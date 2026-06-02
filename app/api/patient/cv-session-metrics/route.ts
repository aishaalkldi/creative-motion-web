/**
 * POST /api/patient/cv-session-metrics
 *
 * Token-scoped public endpoint — derived CV metrics (allowlisted exercises only).
 * No video, landmarks, or clinical interpretation. Service role insert.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CV_MIN_SAVE_DURATION_S, isCvEnabledExercise } from "@/app/lib/cv/cv-patient-config";
import {
  patientCvPrototypeVersion,
  type CvTrackingQuality,
  type PatientCvExerciseId,
} from "@/app/lib/cv/bio-0-contracts";
import { validateCvMotionQualityPayload } from "@/app/lib/cv/cv-motion-quality-payload";
import { bodyHasForbiddenCvKeys } from "@/app/lib/cv/cv-forbidden-keys";
import {
  checkPatientGeneralLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import {
  API_ERRORS,
  invalidPatientTokenResponse,
  serviceUnavailableResponse,
  unableToCompleteResponse,
} from "@/app/lib/api/safe-errors";

const TRACKING_QUALITIES = new Set<CvTrackingQuality>(["good", "fair", "poor", "unknown"]);

function isAllowedPatientCvExerciseId(value: string): value is PatientCvExerciseId {
  return isCvEnabledExercise(value);
}

type RequestBody = {
  token?: string;
  sessionId?: string;
  exerciseId?: string;
  repCount?: number;
  sessionDurationS?: number;
  trackingQuality?: string;
  movementDetected?: boolean;
  framesWithPose?: number;
  framesTotal?: number;
  motion_quality?: Record<string, unknown>;
};

type TokenRow = {
  patient_id: string;
  plan_id: string;
  provider_id: string;
  is_active: boolean;
  expires_at: string | null;
};

type SessionRow = {
  id: string;
  plan_id: string;
};

function buildAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(req: NextRequest) {
  const general = checkPatientGeneralLimit(req, "cv-session-metrics");
  if (!general.allowed) {
    return rateLimitExceededResponse(general.retryAfterSec);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const forbiddenKey = bodyHasForbiddenCvKeys(body as Record<string, unknown>);
  if (forbiddenKey) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }

  const tokenValue = body.token?.trim() ?? "";
  const sessionId = body.sessionId?.trim() ?? "";

  if (!tokenValue) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const exerciseId = (body.exerciseId?.trim() ?? "").toLowerCase();
  if (!isAllowedPatientCvExerciseId(exerciseId)) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }

  const trackingQuality = body.trackingQuality?.trim() as CvTrackingQuality | undefined;
  if (trackingQuality && !TRACKING_QUALITIES.has(trackingQuality)) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }

  if (body.repCount !== undefined && !isNonNegativeInt(body.repCount)) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }
  if (body.sessionDurationS !== undefined && !isNonNegativeInt(body.sessionDurationS)) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }
  if (body.framesWithPose !== undefined && !isNonNegativeInt(body.framesWithPose)) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }
  if (body.framesTotal !== undefined && !isNonNegativeInt(body.framesTotal)) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }
  if (body.movementDetected !== undefined && typeof body.movementDetected !== "boolean") {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }

  const motionQualityError = validateCvMotionQualityPayload(body.motion_quality);
  if (motionQualityError) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }

  const sessionDurationS = body.sessionDurationS ?? 0;
  if (sessionDurationS < CV_MIN_SAVE_DURATION_S) {
    return NextResponse.json({ error: API_ERRORS.UNABLE }, { status: 400 });
  }

  const admin = buildAdminClient();
  if (!admin) return serviceUnavailableResponse();

  const { data: tokenRow, error: tokenErr } = await admin
    .from("patient_access_tokens")
    .select("patient_id, plan_id, provider_id, is_active, expires_at")
    .eq("token", tokenValue)
    .maybeSingle<TokenRow>();

  if (tokenErr) {
    console.error("[POST /api/patient/cv-session-metrics] token lookup error");
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }
  if (!tokenRow || !tokenRow.is_active) {
    return invalidPatientTokenResponse(req);
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return invalidPatientTokenResponse(req);
  }

  const { data: sessionRow, error: sessionErr } = await admin
    .from("plan_sessions")
    .select("id, plan_id")
    .eq("id", sessionId)
    .eq("plan_id", tokenRow.plan_id)
    .maybeSingle<SessionRow>();

  if (sessionErr) {
    console.error("[POST /api/patient/cv-session-metrics] session lookup error");
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }
  if (!sessionRow) {
    return unableToCompleteResponse(404);
  }

  const { data: inserted, error: insertErr } = await admin
    .from("cv_session_metrics")
    .insert({
      provider_id: tokenRow.provider_id,
      patient_id: tokenRow.patient_id,
      plan_id: tokenRow.plan_id,
      plan_session_id: sessionId,
      exercise_id: exerciseId,
      rep_count: body.repCount ?? null,
      session_duration_s: body.sessionDurationS ?? null,
      tracking_quality: trackingQuality ?? null,
      movement_detected: body.movementDetected ?? false,
      frames_with_pose: body.framesWithPose ?? null,
      frames_total: body.framesTotal ?? null,
      source: "patient_session",
      prototype_version: patientCvPrototypeVersion(exerciseId),
      motion_quality: body.motion_quality ?? null,
    })
    .select("id, recorded_at")
    .single<{ id: string; recorded_at: string }>();

  if (insertErr) {
    console.error("[POST /api/patient/cv-session-metrics] insert failed");
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  return NextResponse.json({
    saved: true,
    id: inserted.id,
    recordedAt: inserted.recorded_at,
  });
}
