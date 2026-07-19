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
};

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

  let body: { structuredData?: unknown };
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
    .select("id, patient_id, provider_id, status, assessment_id, submitted_at")
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

  const { data: assessment, error: insertError } = await admin
    .from("assessments")
    .insert({
      patient_id: requestRow.patient_id,
      provider_id: requestRow.provider_id,
      type: "remote_questionnaire",
      structured_data: validated.data,
      status: "completed",
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
