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
import { validatePostStrokeIntakeDraftSave } from "@/app/lib/post-stroke-intake/submission-validation";

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
  assessment_type: string;
};

/**
 * POST /api/remote-assessments/[token]/save-draft
 *
 * Partial, non-terminal persistence for a post-stroke intake that cleared
 * the urgent-symptom gate (exactly "no_new_urgent_symptoms"). Unlike
 * /submit, this endpoint never touches remote_assessment_requests.status or
 * submitted_at — the token remains "pending" and reusable, and Stage 3 can
 * later resume from and update the same draft. A repeated call reuses the
 * already-linked draft (update) instead of creating a second assessment row.
 *
 * A genuine urgent-stop must go through /submit instead — this endpoint
 * rejects anything other than exactly ["no_new_urgent_symptoms"].
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

  const limited = checkRemoteAssessmentLimit(req, trimmed, "save-draft");
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
    .select("id, patient_id, provider_id, status, assessment_id, assessment_type")
    .eq("token", trimmed)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (fetchError) {
    console.error("[POST /api/remote-assessments/[token]/save-draft] fetch failed");
    return NextResponse.json({ error: "Failed to save draft." }, { status: 500 });
  }

  if (!requestRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // A request that already reached a terminal state cannot accept a new draft.
  if (requestRow.status !== "pending") {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (requestRow.assessment_type !== "post_stroke_intake") {
    return NextResponse.json(
      { error: "This endpoint only supports post-stroke intake requests." },
      { status: 400 },
    );
  }

  const draftValidation = validatePostStrokeIntakeDraftSave(validated.data);
  if (!draftValidation.ok) {
    return NextResponse.json({ error: draftValidation.error }, { status: 400 });
  }

  // Idempotent: reuse the already-linked draft assessment if one exists —
  // never create a second row for the same request.
  if (requestRow.assessment_id) {
    const { data: updated, error: updateErr } = await admin
      .from("assessments")
      .update({
        structured_data: draftValidation.structuredData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow.assessment_id)
      .eq("patient_id", requestRow.patient_id)
      .eq("provider_id", requestRow.provider_id)
      .select("id")
      .single();

    if (updateErr) {
      console.error("[POST /api/remote-assessments/[token]/save-draft] draft update failed");
      return NextResponse.json({ error: "Failed to save draft." }, { status: 500 });
    }

    return NextResponse.json({ saved: true, assessmentId: updated.id });
  }

  const { data: assessment, error: insertError } = await admin
    .from("assessments")
    .insert({
      patient_id: requestRow.patient_id,
      provider_id: requestRow.provider_id,
      type: "post_stroke_intake",
      structured_data: draftValidation.structuredData,
      status: "draft",
      mode: "remote",
      selected_tests: [],
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[POST /api/remote-assessments/[token]/save-draft] draft insert failed");
    return NextResponse.json({ error: "Failed to save draft." }, { status: 500 });
  }

  const { error: linkError } = await admin
    .from("remote_assessment_requests")
    .update({ assessment_id: assessment.id })
    .eq("token", trimmed);

  if (linkError) {
    console.error("[POST /api/remote-assessments/[token]/save-draft] request link failed");
    return NextResponse.json({ error: "Failed to save draft." }, { status: 500 });
  }

  return NextResponse.json({ saved: true, assessmentId: assessment.id });
}
