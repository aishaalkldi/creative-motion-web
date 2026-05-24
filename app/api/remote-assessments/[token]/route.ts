import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type RequestRow = {
  assessment_type: string;
  included_sections: unknown;
  expires_at: string;
};

/**
 * GET /api/remote-assessments/[token]
 * Patient-facing lookup — no auth, token only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "get");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  const admin = adminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  const { data: row, error } = await admin
    .from("remote_assessment_requests")
    .select("assessment_type, included_sections, expires_at")
    .eq("token", trimmed)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (error) {
    console.error("[GET /api/remote-assessments/[token]] query failed");
    return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({
    assessmentType: row.assessment_type,
    includedSections: Array.isArray(row.included_sections) ? row.included_sections : [],
    expiresAt: row.expires_at,
  });
}
