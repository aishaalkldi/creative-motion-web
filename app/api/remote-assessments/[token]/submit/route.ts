import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function adminClient() {
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

function isStructuredData(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as object).length > 0
  );
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

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  let body: { structuredData?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isStructuredData(body.structuredData)) {
    return NextResponse.json(
      { error: "structuredData must be a non-empty object." },
      { status: 400 },
    );
  }

  const { data: requestRow, error: fetchError } = await admin
    .from("remote_assessment_requests")
    .select("id, patient_id, provider_id, status, assessment_id, submitted_at")
    .eq("token", trimmed)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (fetchError) {
    if (fetchError.code === "42P01") {
      return NextResponse.json(
        { error: "remote_assessment_requests table missing. Apply migration 006." },
        { status: 500 },
      );
    }
    console.error("[POST /api/remote-assessments/[token]/submit] fetch failed:", fetchError.message);
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
      structured_data: body.structuredData,
      status: "completed",
      mode: "remote",
      selected_tests: [],
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("[POST /api/remote-assessments/[token]/submit] assessment insert failed:", insertError.message);
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
    console.error("[POST /api/remote-assessments/[token]/submit] request update failed:", updateError.message);
    return NextResponse.json({ error: "Failed to finalize submission." }, { status: 500 });
  }

  return NextResponse.json({
    assessmentId: assessment.id,
    submittedAt,
  });
}
