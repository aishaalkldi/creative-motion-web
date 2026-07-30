import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import {
  isRemoteAssessmentBodyTooLarge,
  validateRemoteAssessmentStructuredData,
} from "@/app/lib/remote-assessment-validation";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";
import { backfillTranscriptionSessionAssessmentId } from "@/app/lib/speech-ai/transcription-session-persistence";
import {
  validatePostStrokeIntakeCompletion,
  validatePostStrokeIntakeSubmission,
} from "@/app/lib/post-stroke-intake/submission-validation";

/** Explicit final-submission action for Stage 3 — never inferred from field completeness alone. */
const COMPLETE_POST_STROKE_INTAKE_ACTION = "complete_post_stroke_intake";

let serviceRoleClientOverride: SupabaseClient | null = null;

/** Test-only hook for route tests — not used in production. */
export function __setServiceRoleClientForTests(client: SupabaseClient | null): void {
  serviceRoleClientOverride = client;
}

function adminClient() {
  if (serviceRoleClientOverride) return serviceRoleClientOverride;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type RequestRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  status: string;
  assessment_id: string | null;
  submitted_at: string | null;
  assessment_type: string;
};

/** Assessment types allowed to persist as their own assessments.type value on submit. */
const PASSTHROUGH_ASSESSMENT_TYPES = new Set(["post_stroke_intake"]);

/** Existing remote_questionnaire behavior is the default for every other/unrecognized type. */
export function resolveAssessmentTypeForInsert(requestAssessmentType: string): string {
  return PASSTHROUGH_ASSESSMENT_TYPES.has(requestAssessmentType)
    ? requestAssessmentType
    : "remote_questionnaire";
}

/**
 * A stopped urgent post-stroke intake is not clinically complete — it must
 * never be persisted as "completed". Every other case (including a
 * non-stopped post-stroke submission and every remote_questionnaire
 * submission) keeps the existing "completed" behavior unchanged. No new
 * "interrupted" status is introduced; the interruption itself remains
 * detectable through structured_data.postStrokeIntake.urgentGate.stopped
 * and its server-computed operational flags.
 */
export function resolveAssessmentStatusForInsert(resolvedType: string, stopped: boolean): string {
  return resolvedType === "post_stroke_intake" && stopped ? "draft" : "completed";
}

type CompletionAssessmentRow = { id: string };

/**
 * Final Stage 3 submission — reached only via the explicit
 * `complete_post_stroke_intake` action, never inferred from field
 * completeness. Updates the same linked draft assessment when one exists
 * (the expected case: /save-draft already created and linked it before any
 * Stage 3 screen was reachable); creates and links exactly one otherwise, as
 * a defensive fallback. assessments.status stays "draft" — submission here
 * means "awaiting clinician review", never a clinical decision or exercise
 * clearance. The request is only marked "submitted" after the assessment
 * write succeeds, so a failed write never falsely consumes the token.
 */
async function completePostStrokeIntake(
  admin: SupabaseClient,
  token: string,
  requestRow: RequestRow,
  rawStructuredData: unknown,
) {
  const completion = validatePostStrokeIntakeCompletion(rawStructuredData);
  if (!completion.ok) {
    return NextResponse.json({ error: completion.error }, { status: 400 });
  }

  let assessmentId = requestRow.assessment_id;

  if (assessmentId) {
    const { error: updateErr } = await admin
      .from("assessments")
      .update({
        structured_data: completion.structuredData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assessmentId)
      .eq("patient_id", requestRow.patient_id)
      .eq("provider_id", requestRow.provider_id)
      .select("id")
      .single();

    if (updateErr) {
      console.error("[POST /api/remote-assessments/[token]/submit] completion update failed");
      return NextResponse.json({ error: "Failed to submit assessment." }, { status: 500 });
    }
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("assessments")
      .insert({
        patient_id: requestRow.patient_id,
        provider_id: requestRow.provider_id,
        type: "post_stroke_intake",
        structured_data: completion.structuredData,
        status: "draft",
        mode: "remote",
        selected_tests: [],
      })
      .select("id")
      .single<CompletionAssessmentRow>();

    if (insertErr || !inserted) {
      console.error("[POST /api/remote-assessments/[token]/submit] completion insert failed");
      return NextResponse.json({ error: "Failed to submit assessment." }, { status: 500 });
    }
    assessmentId = inserted.id;
  }

  // Mark submitted only now that the assessment write has succeeded.
  const submittedAt = new Date().toISOString();
  const { error: requestUpdateErr } = await admin
    .from("remote_assessment_requests")
    .update({
      status: "submitted",
      submitted_at: submittedAt,
      assessment_id: assessmentId,
    })
    .eq("token", token);

  if (requestUpdateErr) {
    console.error("[POST /api/remote-assessments/[token]/submit] completion request update failed");
    return NextResponse.json({ error: "Failed to finalize submission." }, { status: 500 });
  }

  return NextResponse.json({
    assessmentId,
    submittedAt,
  });
}

/**
 * POST /api/remote-assessments/[token]/submit
 * Patient submission — no auth, token only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "submit");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  if (isRemoteAssessmentBodyTooLarge(req.headers.get("content-length"))) {
    return NextResponse.json({ error: "Assessment data exceeds allowed size." }, { status: 413 });
  }

  const admin = adminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  let body: { structuredData?: unknown; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateRemoteAssessmentStructuredData(body.structuredData);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data: requestRow, error: fetchError } = await admin
    .from("remote_assessment_requests")
    .select("id, patient_id, provider_id, status, assessment_id, submitted_at, assessment_type")
    .eq("token", trimmed)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (fetchError) {
    console.error("[POST /api/remote-assessments/[token]/submit] fetch failed");
    return NextResponse.json({ error: "Failed to submit assessment." }, { status: 500 });
  }

  if (!requestRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (requestRow.status === "submitted") {
    return NextResponse.json({
      alreadySubmitted: true,
      assessmentId: requestRow.assessment_id,
      submittedAt: requestRow.submitted_at,
    });
  }

  if (requestRow.status !== "pending") {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (body.action === COMPLETE_POST_STROKE_INTAKE_ACTION) {
    if (requestRow.assessment_type !== "post_stroke_intake") {
      return NextResponse.json(
        { error: "This action only applies to post-stroke intake requests." },
        { status: 400 },
      );
    }
    return completePostStrokeIntake(admin, trimmed, requestRow, validated.data);
  }

  const resolvedType = resolveAssessmentTypeForInsert(requestRow.assessment_type);

  let finalStructuredData: Record<string, unknown> = validated.data;
  let stopped = false;

  if (resolvedType === "post_stroke_intake") {
    // Server-authoritative: recomputes stopped/flags/recordedAt from the
    // validated symptom selection — never trusts the client's values.
    const postStrokeValidation = validatePostStrokeIntakeSubmission(validated.data);
    if (!postStrokeValidation.ok) {
      return NextResponse.json({ error: postStrokeValidation.error }, { status: 400 });
    }
    if (!postStrokeValidation.stopped) {
      // This endpoint is the terminal urgent-stop path only. A cleared
      // (no new urgent symptoms) post-stroke intake is not terminal and must
      // go through /save-draft instead, so it is never marked "completed".
      return NextResponse.json(
        { error: "Not an urgent-stop submission. Use the draft-save endpoint instead." },
        { status: 400 },
      );
    }
    finalStructuredData = postStrokeValidation.structuredData;
    stopped = postStrokeValidation.stopped;
  }

  const { data: assessment, error: insertError } = await admin
    .from("assessments")
    .insert({
      patient_id: requestRow.patient_id,
      provider_id: requestRow.provider_id,
      type: resolvedType,
      structured_data: finalStructuredData,
      status: resolveAssessmentStatusForInsert(resolvedType, stopped),
      mode: "remote",
      selected_tests: [],
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("[POST /api/remote-assessments/[token]/submit] assessment insert failed");
    return NextResponse.json({ error: "Failed to save assessment." }, { status: 500 });
  }

  const submittedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("remote_assessment_requests")
    .update({
      status: "submitted",
      submitted_at: submittedAt,
      assessment_id: assessment.id,
    })
    .eq("token", trimmed);

  if (updateError) {
    console.error("[POST /api/remote-assessments/[token]/submit] request update failed");
    return NextResponse.json({ error: "Failed to finalize submission." }, { status: 500 });
  }

  const backfilled = await backfillTranscriptionSessionAssessmentId(
    admin,
    requestRow.id,
    assessment.id,
  );
  if (!backfilled) {
    console.warn(
      "[POST /api/remote-assessments/[token]/submit] transcription session assessment backfill skipped",
    );
  }

  return NextResponse.json({
    assessmentId: assessment.id,
    submittedAt,
  });
}
