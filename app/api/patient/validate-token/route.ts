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
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";
import {
  API_ERRORS,
  invalidPatientTokenResponse,
  serviceUnavailableResponse,
} from "../../../lib/api/safe-errors";
import { lookupPatientPortalToken } from "../../../lib/patient-portal-access";

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
    return serviceUnavailableResponse();
  }

  const admin = createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const lookup = await lookupPatientPortalToken(admin, token);
  if (!lookup.ok) {
    if (lookup.reason === "invalid_token") {
      return invalidPatientTokenResponse(req);
    }
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  return NextResponse.json({ valid: true });
}
