import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import {
  API_ERRORS,
  invalidPatientTokenResponse,
  serviceUnavailableResponse,
} from "@/app/lib/api/safe-errors";
import { MOTOR_SCREEN_ACTIVE_ASSIGNMENT_STATUSES } from "@/app/lib/upper-limb-motor-screen-api/constants";
import {
  toPatientAssignmentView,
  validateStoredMotorScreenAssignmentMvp,
} from "@/app/lib/upper-limb-motor-screen-api/request-validation";
import { hashPatientAccessToken } from "@/app/lib/upper-limb-motor-screen-api/token";

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

type AssignmentRow = {
  id: string;
  status: string;
  token_expires_at: string;
  assignment_payload: unknown;
  patient_id: string;
  provider_id: string;
  token_hash: string;
  assigned_by?: string;
};

/**
 * GET /api/patient/upper-limb-motor-screen/assignments/[token]
 * Read-only patient-facing assignment lookup — token only, no auth.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return invalidPatientTokenResponse(req);
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "motor-screen-get");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  const admin = adminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  const tokenHash = hashPatientAccessToken(trimmed);

  const { data: row, error } = await admin
    .from("upper_limb_motor_screen_assignments")
    .select("id, status, token_expires_at, assignment_payload, patient_id, provider_id, token_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle<AssignmentRow>();

  if (error) {
    console.error("[GET /api/patient/upper-limb-motor-screen/assignments/[token]] query failed");
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  if (!row) {
    return invalidPatientTokenResponse(req);
  }

  if (
    !MOTOR_SCREEN_ACTIVE_ASSIGNMENT_STATUSES.includes(
      row.status as (typeof MOTOR_SCREEN_ACTIVE_ASSIGNMENT_STATUSES)[number],
    )
  ) {
    return invalidPatientTokenResponse(req);
  }

  if (new Date(row.token_expires_at).getTime() <= Date.now()) {
    return invalidPatientTokenResponse(req);
  }

  const payloadValidation = validateStoredMotorScreenAssignmentMvp(row.assignment_payload);
  if (!payloadValidation.ok) {
    console.error(
      "[GET /api/patient/upper-limb-motor-screen/assignments/[token]] stored payload invalid",
    );
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  const { assignment } = payloadValidation;

  return NextResponse.json(
    toPatientAssignmentView({
      assignment,
      expiresAt: row.token_expires_at,
    }),
  );
}
