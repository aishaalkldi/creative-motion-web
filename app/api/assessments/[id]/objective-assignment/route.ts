import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validatePatientOwnership } from "@/app/lib/validate-patient-ownership";
import {
  API_ERRORS,
  genericServerErrorResponse,
  ownershipErrorResponse,
  serviceUnavailableResponse,
} from "@/app/lib/api/safe-errors";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";
import {
  checkClinicianWriteLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import {
  assertObjectiveAssignmentPayloadSafe,
  buildFiveTimesStsAssignmentRecord,
  mergeObjectiveAssignmentIntoStructuredData,
  validateObjectiveAssignmentRequest,
} from "@/app/lib/post-stroke-objective/assignment-validation";
import {
  isActiveFiveTimesStsAssignmentStatus,
  readFiveTimesStsAssignment,
  type ObjectiveAssignmentClientRequest,
} from "@/app/lib/post-stroke-objective/types";

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
          /* read-only */
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

type AssessmentRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  structured_data: Record<string, unknown> | null;
};

function gate2ErrorResponse(reason: string) {
  switch (reason) {
    case "gate1_required":
      return NextResponse.json(
        { error: "Approve patient-reported information before assigning Objective assessments." },
        { status: 409 },
      );
    case "draft_required":
      return NextResponse.json(
        { error: "Generate the Patient-Reported Subjective Summary before assigning Objective assessments." },
        { status: 409 },
      );
    case "gate2_required":
      return NextResponse.json(
        { error: "Approve the Patient-Reported Subjective Summary before assigning Objective assessments." },
        { status: 409 },
      );
    case "stale_gate2":
      return NextResponse.json(
        { error: "Subjective approval is out of date. Re-approve the current summary before assigning Objective assessments." },
        { status: 409 },
      );
    case "invalid_protocol":
      return NextResponse.json({ error: "Invalid 5×STS protocol." }, { status: 400 });
    case "invalid_delivery_mode":
      return NextResponse.json({ error: "Invalid delivery mode." }, { status: 400 });
    case "supervision_confirmation_required":
      return NextResponse.json(
        { error: "Remote supervised assignments require explicit supervision confirmation." },
        { status: 400 },
      );
    case "supervision_confirmation_not_applicable":
      return NextResponse.json(
        { error: "Supervision confirmation applies only to remote supervised assignments." },
        { status: 400 },
      );
    case "active_assignment_conflict":
      return NextResponse.json(
        { error: "An active Objective assignment already exists for this intake." },
        { status: 409 },
      );
    default:
      return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 400 });
  }
}

/**
 * POST /api/assessments/[id]/objective-assignment
 *
 * Assigns the Post-Stroke Objective 5×STS assessment after valid Gate 2 approval.
 * Persists assignment only — no CV result, patient token, or AI calls.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return NextResponse.json({ error: "Assessment ID is required." }, { status: 400 });
  }

  const session = await requireClinicianSession();
  if (!session.ok) return session.response;
  const { user } = session;

  const limited = checkClinicianWriteLimit(user.id, "assessments:objective-assignment");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  let body: ObjectiveAssignmentClientRequest = {};
  try {
    body = (await req.json()) as ObjectiveAssignmentClientRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const clients = await buildClients();
  if (!clients) {
    return serviceUnavailableResponse();
  }
  const { adminClient } = clients;

  const { data: assessment, error: fetchError } = await adminClient
    .from("assessments")
    .select("id, patient_id, provider_id, type, structured_data")
    .eq("id", assessmentId)
    .maybeSingle();

  if (fetchError) {
    console.error("[POST objective-assignment] fetch failed:", fetchError.message);
    return genericServerErrorResponse();
  }
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const row = assessment as AssessmentRow;
  if (row.type !== "post_stroke_intake") {
    return NextResponse.json(
      { error: "Objective assignment is supported only for post-stroke intake assessments." },
      { status: 400 },
    );
  }

  const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
  if (!ownership.ok) {
    return ownershipErrorResponse(ownership);
  }

  const structuredData =
    row.structured_data && typeof row.structured_data === "object" && !Array.isArray(row.structured_data)
      ? { ...(row.structured_data as Record<string, unknown>) }
      : {};

  const existingAssignment = readFiveTimesStsAssignment(structuredData);
  if (
    existingAssignment &&
    isActiveFiveTimesStsAssignmentStatus(existingAssignment.status)
  ) {
    const retryValidation = validateObjectiveAssignmentRequest(structuredData, body, existingAssignment);
    if (!retryValidation.ok) {
      return gate2ErrorResponse(retryValidation.reason);
    }
    return NextResponse.json({
      assignment: existingAssignment,
      idempotent: true,
    });
  }

  const validation = validateObjectiveAssignmentRequest(structuredData, body, existingAssignment);
  if (!validation.ok) {
    return gate2ErrorResponse(validation.reason);
  }

  const assignedAt = new Date().toISOString();
  const assignment = buildFiveTimesStsAssignmentRecord({
    assignmentId: crypto.randomUUID(),
    protocol: validation.protocol,
    deliveryMode: validation.deliveryMode,
    assignedAt,
    assignedBy: user.id,
    supervisionConfirmed: validation.supervisionConfirmed,
  });

  const nextStructuredData = mergeObjectiveAssignmentIntoStructuredData(structuredData, assignment);
  const objectiveAssessment = (
    nextStructuredData.postStrokeIntake as Record<string, unknown>
  ).objectiveAssessment as Record<string, unknown>;

  if (!assertObjectiveAssignmentPayloadSafe(objectiveAssessment)) {
    console.error("[POST objective-assignment] unsafe payload rejected");
    return genericServerErrorResponse();
  }

  if ("result" in objectiveAssessment) {
    return NextResponse.json({ error: API_ERRORS.GENERIC }, { status: 500 });
  }

  const { error: updateError } = await adminClient
    .from("assessments")
    .update({ structured_data: nextStructuredData })
    .eq("id", assessmentId);

  if (updateError) {
    console.error("[POST objective-assignment] update failed:", updateError.message);
    return genericServerErrorResponse();
  }

  return NextResponse.json({
    assignment,
    idempotent: false,
  });
}
