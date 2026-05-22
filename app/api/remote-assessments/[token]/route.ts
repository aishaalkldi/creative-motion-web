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
  patient_id: string;
  assessment_type: string;
  included_sections: unknown;
  expires_at: string;
};

/**
 * GET /api/remote-assessments/[token]
 * Patient-facing lookup — no auth, token only.
 */
export async function GET(
  _req: NextRequest,
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

  const { data: row, error } = await admin
    .from("remote_assessment_requests")
    .select("patient_id, assessment_type, included_sections, expires_at")
    .eq("token", trimmed)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "remote_assessment_requests table missing. Apply migration 006." },
        { status: 500 },
      );
    }
    console.error("[GET /api/remote-assessments/[token]] query failed:", error.message);
    return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({
    patientId: row.patient_id,
    assessmentType: row.assessment_type,
    includedSections: Array.isArray(row.included_sections) ? row.included_sections : [],
    expiresAt: row.expires_at,
  });
}
