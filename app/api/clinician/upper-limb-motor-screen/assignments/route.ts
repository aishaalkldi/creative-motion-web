import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateUpperLimbMotorScreenAssignment } from "@/app/lib/upper-limb-motor-screen/assignment-validation";
import { validatePatientOwnership } from "@/app/lib/validate-patient-ownership";
import {
  API_ERRORS,
  genericServerErrorResponse,
  ownershipErrorResponse,
  serviceUnavailableResponse,
} from "@/app/lib/api/safe-errors";
import {
  checkClinicianWriteLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";
import { computeMotorScreenTokenExpiresAt } from "@/app/lib/upper-limb-motor-screen-api/constants";
import { validateClinicianAssignmentRequestBody } from "@/app/lib/upper-limb-motor-screen-api/request-validation";
import {
  generatePatientAccessToken,
  hashPatientAccessToken,
} from "@/app/lib/upper-limb-motor-screen-api/token";

async function buildClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) return null;

  const cookieStore = await cookies();
  const sessionClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* Route Handler context */
        }
      },
    },
  });

  const adminClient = serviceKey
    ? createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : sessionClient;

  return { sessionClient, adminClient };
}

type ClinicianAssignmentRequestBody = {
  patientId?: string;
  screenDefinitionId?: string;
  affectedSide?: unknown;
  configuration?: unknown;
  taskAssignmentGroups?: unknown;
};

function mapValidationFailure(
  result: Extract<
    ReturnType<typeof validateUpperLimbMotorScreenAssignment>,
    { ok: false }
  >,
): NextResponse {
  return NextResponse.json(
    {
      error: "Assignment validation failed.",
      reason: result.reason,
      ...(result.detail ? { detail: result.detail } : {}),
    },
    { status: 400 },
  );
}

/**
 * POST /api/clinician/upper-limb-motor-screen/assignments
 * Clinician assigns a Forward Reach Motor Screen task to a patient.
 */
export async function POST(req: NextRequest) {
  const clients = await buildClients();
  if (!clients) {
    return serviceUnavailableResponse();
  }
  const { adminClient } = clients;

  const session = await requireClinicianSession();
  if (!session.ok) return session.response;
  const { user } = session;

  const limited = checkClinicianWriteLimit(user.id, "motor-screen:assign");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  let body: ClinicianAssignmentRequestBody;
  try {
    body = (await req.json()) as ClinicianAssignmentRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const boundary = validateClinicianAssignmentRequestBody(body);
  if (!boundary.ok) {
    return NextResponse.json(
      { error: boundary.error, ...(boundary.detail ? { detail: boundary.detail } : {}) },
      { status: 400 },
    );
  }

  const { patientId, screenDefinitionId } = boundary;

  const ownership = await validatePatientOwnership(adminClient, patientId, user.id);
  if (!ownership.ok) {
    return ownershipErrorResponse(ownership);
  }

  const assignmentId = crypto.randomUUID();
  const assignedAt = new Date().toISOString();

  const assignmentCandidate = {
    id: assignmentId,
    screenDefinitionId,
    status: "assigned" as const,
    assignedAt,
    assignedBy: user.id,
    affectedSide: body.affectedSide,
    configuration: body.configuration,
    taskAssignmentGroups: body.taskAssignmentGroups,
  };

  const validation = validateUpperLimbMotorScreenAssignment(assignmentCandidate);
  if (!validation.ok) {
    return mapValidationFailure(validation);
  }

  const assignment = validation.assignment;
  const rawToken = generatePatientAccessToken();
  const tokenHash = hashPatientAccessToken(rawToken);
  const tokenExpiresAt = computeMotorScreenTokenExpiresAt().toISOString();

  const { data: row, error: insertError } = await adminClient
    .from("upper_limb_motor_screen_assignments")
    .insert({
      id: assignment.id,
      patient_id: patientId,
      provider_id: user.id,
      screen_definition_id: assignment.screenDefinitionId,
      status: assignment.status,
      assigned_at: assignment.assignedAt,
      affected_side: assignment.affectedSide,
      delivery_mode: assignment.configuration.deliveryMode,
      assignment_payload: assignment,
      token_hash: tokenHash,
      token_expires_at: tokenExpiresAt,
    })
    .select("id, token_expires_at")
    .single();

  if (insertError) {
    if (insertError.code === "42P01") {
      console.error(
        "[POST /api/clinician/upper-limb-motor-screen/assignments] table missing",
      );
      return genericServerErrorResponse();
    }
    console.error(
      "[POST /api/clinician/upper-limb-motor-screen/assignments] insert failed:",
      insertError.message,
    );
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  return NextResponse.json(
    {
      assignmentId: row.id,
      patientAccessToken: rawToken,
      expiresAt: row.token_expires_at,
    },
    { status: 201 },
  );
}
