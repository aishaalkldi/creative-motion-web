/**
 * POST /api/patient/validate-token
 *
 * Lightweight token validation — does NOT return plan data.
 * Returns { valid: true } or an error status.
 * Token is never logged.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkPatientGeneralLimit,
  enforceFailedTokenRateLimit,
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";

export async function POST(req: NextRequest) {
  const general = checkPatientGeneralLimit(req, "validate-token");
  if (!general.allowed) {
    return rateLimitExceededResponse(general.retryAfterSec);
  }

  let token: string;
  try {
    const body = (await req.json()) as { token?: string };
    token = body.token?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  const admin = createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  type TokenRow = { is_active: boolean; expires_at: string | null };
  const { data: tokenRow, error } = await admin
    .from("patient_access_tokens")
    .select("is_active, expires_at")
    .eq("token", token)
    .maybeSingle<TokenRow>();

  if (error) {
    return NextResponse.json({ error: "Validation failed." }, { status: 500 });
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

  return NextResponse.json({ valid: true });
}
