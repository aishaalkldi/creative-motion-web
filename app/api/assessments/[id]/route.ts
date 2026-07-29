import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validatePatientOwnership, type PatientRow } from "../../../lib/validate-patient-ownership";
import {
  buildGeneralMskPayload,
  extractGeneralDraft,
  getAssessmentLanguage,
  type AssessmentLanguage,
} from "../../../lib/assessment-payload";
import type { GeneralAssessmentDraft } from "../../../lib/general-assessment/types";
import type { StoredAssessmentPayload } from "../../../lib/assessment-payload";
import {
  ownershipErrorResponse,
  serviceUnavailableResponse,
} from "../../../lib/api/safe-errors";
import { requireClinicianSession } from "../../../lib/api/require-clinician-session";
import {
  checkClinicianWriteLimit,
  rateLimitExceededResponse,
} from "../../../lib/rate-limit";
import {
  buildApprovedPatientReportFactsSnapshot,
} from "../../../lib/reports/approved-patient-facts";
import { readApprovedPatientReportFacts } from "../../../lib/reports/approved-patient-facts";
import {
  applyEditedSectionsToDraft,
  buildPtMedicalReportApprovedSnapshot,
  clearPtMedicalReportGate2Approval,
  invalidatePtMedicalReportForGate1Reapproval,
  parseClientPtReportSections,
  readPtMedicalReportApproved,
  readPtMedicalReportDraft,
  validateAndSanitizePtReportSections,
} from "../../../lib/ai/generate-pt-medical-report";
import {
  extractRemoteQuestionnaireDraft,
  inferIncludedSections,
} from "../../../lib/remote-questionnaire-summary";

export type AssessmentDetailResponse = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  structured_data: StoredAssessmentPayload | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  patient: Pick<PatientRow, "id" | "full_name" | "diagnosis" | "age" | "gender" | "sport" | "status">;
};

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

type AssessmentDbRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  structured_data: unknown;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

// ── GET /api/assessments/[id] ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return NextResponse.json({ error: "Assessment ID is required." }, { status: 400 });
  }

  const clients = await buildClients();
  if (!clients) {
    return serviceUnavailableResponse();
  }
  const { adminClient } = clients;

  const session = await requireClinicianSession();
  if (!session.ok) return session.response;
  const { user } = session;

  const { data: row, error: queryErr } = await adminClient
    .from("assessments")
    .select("id, patient_id, provider_id, type, structured_data, notes, status, created_at, updated_at")
    .eq("id", assessmentId)
    .eq("provider_id", user.id)
    .maybeSingle<AssessmentDbRow>();

  if (queryErr) {
    console.error("[GET /api/assessments/[id]] query failed:", queryErr.message);
    return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
  if (!ownership.ok) {
    return ownershipErrorResponse(ownership);
  }

  const patient = ownership.patient;
  const response: AssessmentDetailResponse = {
    id: row.id,
    patient_id: row.patient_id,
    provider_id: row.provider_id,
    type: row.type,
    structured_data: row.structured_data as StoredAssessmentPayload | null,
    notes: row.notes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    patient: {
      id: patient.id,
      full_name: patient.full_name,
      diagnosis: patient.diagnosis,
      age: patient.age,
      gender: patient.gender,
      sport: patient.sport,
      status: patient.status,
    },
  };

  return NextResponse.json(response);
}

// ── PATCH /api/assessments/[id] — general_msk draft updates (SOAP, etc.) ─────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return NextResponse.json({ error: "Assessment ID is required." }, { status: 400 });
  }

  const clients = await buildClients();
  if (!clients) {
    return serviceUnavailableResponse();
  }
  const { adminClient } = clients;

  const session = await requireClinicianSession();
  if (!session.ok) return session.response;
  const { user } = session;

  const limited = checkClinicianWriteLimit(user.id, "assessments:update");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  let body: {
    draft?: GeneralAssessmentDraft;
    notes?: string;
    fieldKey?: string;
    markTranslationReviewed?: boolean;
    markChiefComplaintExtractionReviewed?: boolean;
    approvePatientReportFacts?: boolean;
    savePtMedicalReportDraft?: { sections?: Record<string, unknown> };
    approvePtMedicalReport?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.markTranslationReviewed && body.fieldKey?.trim()) {
    const fieldKey = body.fieldKey.trim();
    const { data: row, error: fetchErr } = await adminClient
      .from("assessments")
      .select("id, patient_id, provider_id, structured_data")
      .eq("id", assessmentId)
      .eq("provider_id", user.id)
      .maybeSingle<AssessmentDbRow>();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
    if (!ownership.ok) {
      return ownershipErrorResponse(ownership);
    }

    const existing =
      typeof row.structured_data === "object" && row.structured_data !== null
        ? (row.structured_data as Record<string, unknown>)
        : {};

    const updatedData = {
      ...existing,
      [`${fieldKey}_en_reviewed`]: true,
    };

    const { error: updateErr } = await adminClient
      .from("assessments")
      .update({ structured_data: updatedData, updated_at: new Date().toISOString() })
      .eq("id", assessmentId)
      .eq("provider_id", user.id);

    if (updateErr) {
      console.error("[PATCH /api/assessments/[id]] translation review failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update assessment." }, { status: 500 });
    }

    return NextResponse.json({ reviewed: true });
  }

  if (body.markChiefComplaintExtractionReviewed === true) {
    const { data: row, error: fetchErr } = await adminClient
      .from("assessments")
      .select("id, patient_id, provider_id, structured_data")
      .eq("id", assessmentId)
      .eq("provider_id", user.id)
      .maybeSingle<AssessmentDbRow>();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
    if (!ownership.ok) {
      return ownershipErrorResponse(ownership);
    }

    const existing =
      typeof row.structured_data === "object" && row.structured_data !== null
        ? (row.structured_data as Record<string, unknown>)
        : {};

    const existingExtraction = existing.chiefComplaint_extraction;
    if (!existingExtraction || typeof existingExtraction !== "object" || Array.isArray(existingExtraction)) {
      return NextResponse.json({ error: "No extraction to confirm." }, { status: 400 });
    }

    // Fixed key only — never derived from client input, unlike markTranslationReviewed's
    // fieldKey. Extraction confirmation always targets exactly this one stored key.
    const updatedData = {
      ...existing,
      chiefComplaint_extraction_reviewed: true,
    };

    const { error: updateErr } = await adminClient
      .from("assessments")
      .update({ structured_data: updatedData, updated_at: new Date().toISOString() })
      .eq("id", assessmentId)
      .eq("provider_id", user.id);

    if (updateErr) {
      console.error("[PATCH /api/assessments/[id]] extraction review failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update assessment." }, { status: 500 });
    }

    return NextResponse.json({ reviewed: true });
  }

  if (body.savePtMedicalReportDraft?.sections) {
    const { data: row, error: fetchErr } = await adminClient
      .from("assessments")
      .select("id, patient_id, provider_id, type, structured_data")
      .eq("id", assessmentId)
      .eq("provider_id", user.id)
      .maybeSingle<AssessmentDbRow>();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.type !== "remote_questionnaire") {
      return NextResponse.json(
        { error: "Only remote questionnaire assessments support PT report editing." },
        { status: 400 },
      );
    }

    const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
    if (!ownership.ok) {
      return ownershipErrorResponse(ownership);
    }

    const existing =
      typeof row.structured_data === "object" && row.structured_data !== null
        ? (row.structured_data as Record<string, unknown>)
        : {};

    if (!readApprovedPatientReportFacts(existing)) {
      return NextResponse.json(
        { error: "Approve patient-reported information before saving the PT report." },
        { status: 400 },
      );
    }

    const currentDraft = readPtMedicalReportDraft(existing);
    if (!currentDraft) {
      return NextResponse.json(
        { error: "Generate the PT report draft before saving edits." },
        { status: 400 },
      );
    }

    const parsedSections = parseClientPtReportSections(body.savePtMedicalReportDraft.sections);
    if (!parsedSections) {
      return NextResponse.json({ error: "Invalid report sections." }, { status: 400 });
    }

    const validated = validateAndSanitizePtReportSections(parsedSections);
    if (!validated.ok) {
      return NextResponse.json(
        { error: "Report content includes unsupported clinical claims." },
        { status: 400 },
      );
    }

    const ptMedicalReportDraft = applyEditedSectionsToDraft(currentDraft, validated.sections);
    const hadGate2Approval = Boolean(readPtMedicalReportApproved(existing) || existing.gate2ApprovedAt);

    let updatedData: Record<string, unknown> = {
      ...existing,
      ptMedicalReportDraft,
    };
    if (hadGate2Approval) {
      updatedData = clearPtMedicalReportGate2Approval(updatedData);
    }

    const updatedAt = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from("assessments")
      .update({ structured_data: updatedData, updated_at: updatedAt })
      .eq("id", assessmentId)
      .eq("provider_id", user.id);

    if (updateErr) {
      console.error("[PATCH /api/assessments/[id]] PT report draft save failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update assessment." }, { status: 500 });
    }

    return NextResponse.json({
      saved: true,
      ptMedicalReportDraft,
      gate2Invalidated: hadGate2Approval,
    });
  }

  if (body.approvePtMedicalReport === true) {
    const { data: row, error: fetchErr } = await adminClient
      .from("assessments")
      .select("id, patient_id, provider_id, type, structured_data")
      .eq("id", assessmentId)
      .eq("provider_id", user.id)
      .maybeSingle<AssessmentDbRow>();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.type !== "remote_questionnaire") {
      return NextResponse.json(
        { error: "Only remote questionnaire assessments support PT report approval." },
        { status: 400 },
      );
    }

    const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
    if (!ownership.ok) {
      return ownershipErrorResponse(ownership);
    }

    const existing =
      typeof row.structured_data === "object" && row.structured_data !== null
        ? (row.structured_data as Record<string, unknown>)
        : {};

    if (!readApprovedPatientReportFacts(existing)) {
      return NextResponse.json(
        { error: "Approve patient-reported information before approving the PT report." },
        { status: 400 },
      );
    }

    const currentDraft = readPtMedicalReportDraft(existing);
    if (!currentDraft) {
      return NextResponse.json(
        { error: "Generate and review the PT report draft before approval." },
        { status: 400 },
      );
    }

    const approvedAt = new Date().toISOString();
    const existingApproved = readPtMedicalReportApproved(existing);
    const ptMedicalReportApproved = buildPtMedicalReportApprovedSnapshot(
      currentDraft,
      approvedAt,
      existingApproved,
    );

    const updatedData = {
      ...existing,
      ptMedicalReportApproved,
      gate2ApprovedAt: approvedAt,
    };

    const { error: updateErr } = await adminClient
      .from("assessments")
      .update({ structured_data: updatedData, updated_at: approvedAt })
      .eq("id", assessmentId)
      .eq("provider_id", user.id);

    if (updateErr) {
      console.error("[PATCH /api/assessments/[id]] PT report approval failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update assessment." }, { status: 500 });
    }

    return NextResponse.json({ approved: true, ptMedicalReportApproved });
  }

  if (body.approvePatientReportFacts === true) {
    const { data: row, error: fetchErr } = await adminClient
      .from("assessments")
      .select("id, patient_id, provider_id, type, structured_data")
      .eq("id", assessmentId)
      .eq("provider_id", user.id)
      .maybeSingle<AssessmentDbRow>();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (row.type !== "remote_questionnaire") {
      return NextResponse.json(
        { error: "Only remote questionnaire assessments support patient fact approval." },
        { status: 400 },
      );
    }

    const ownership = await validatePatientOwnership(adminClient, row.patient_id, user.id);
    if (!ownership.ok) {
      return ownershipErrorResponse(ownership);
    }

    const existing =
      typeof row.structured_data === "object" && row.structured_data !== null
        ? (row.structured_data as Record<string, unknown>)
        : {};

    const draft = extractRemoteQuestionnaireDraft(existing, row.type);
    if (!draft) {
      return NextResponse.json({ error: "Invalid assessment payload." }, { status: 400 });
    }

    const includedSections = inferIncludedSections(draft);
    const assessmentLanguage = getAssessmentLanguage(existing);
    const approvedAt = new Date().toISOString();
    const approvedPatientReportFacts = buildApprovedPatientReportFactsSnapshot(
      existing,
      draft,
      includedSections,
      assessmentLanguage,
      approvedAt,
    );

    const updatedData = invalidatePtMedicalReportForGate1Reapproval({
      ...existing,
      approvedPatientReportFacts,
      gate1ApprovedAt: approvedAt,
    });

    const { error: updateErr } = await adminClient
      .from("assessments")
      .update({ structured_data: updatedData, updated_at: approvedAt })
      .eq("id", assessmentId)
      .eq("provider_id", user.id);

    if (updateErr) {
      console.error("[PATCH /api/assessments/[id]] patient fact approval failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update assessment." }, { status: 500 });
    }

    return NextResponse.json({ approved: true, approvedPatientReportFacts });
  }

  const { data: row, error: fetchErr } = await adminClient
    .from("assessments")
    .select("id, patient_id, provider_id, type, structured_data, notes")
    .eq("id", assessmentId)
    .eq("provider_id", user.id)
    .maybeSingle<AssessmentDbRow>();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (row.type !== "general_msk") {
    return NextResponse.json(
      { error: "Only general_msk assessments can be updated via this endpoint." },
      { status: 400 },
    );
  }

  const existing = extractGeneralDraft(row.structured_data, row.type);
  if (!existing) {
    return NextResponse.json({ error: "Invalid assessment payload." }, { status: 400 });
  }

  if (!body.draft) {
    return NextResponse.json({ error: "draft is required." }, { status: 400 });
  }

  const merged: GeneralAssessmentDraft = {
    ...existing,
    ...body.draft,
    soap: { ...existing.soap, ...body.draft.soap },
    subjective: { ...existing.subjective, ...body.draft.subjective },
    updatedAt: new Date().toISOString(),
  };

  const existingLang = getAssessmentLanguage(row.structured_data);
  const { data: updated, error: updateErr } = await adminClient
    .from("assessments")
    .update({
      structured_data: buildGeneralMskPayload(merged, existingLang ?? undefined),
      notes: body.notes?.trim() ?? row.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId)
    .eq("provider_id", user.id)
    .select("id, patient_id, provider_id, type, structured_data, notes, status, created_at, updated_at")
    .single<AssessmentDbRow>();

  if (updateErr) {
    console.error("[PATCH /api/assessments/[id]] update failed:", updateErr.message);
    return NextResponse.json({ error: "Failed to update assessment." }, { status: 500 });
  }

  const ownership = await validatePatientOwnership(adminClient, updated.patient_id, user.id);
  if (!ownership.ok) {
    return ownershipErrorResponse(ownership);
  }

  const response: AssessmentDetailResponse = {
    id: updated.id,
    patient_id: updated.patient_id,
    provider_id: updated.provider_id,
    type: updated.type,
    structured_data: updated.structured_data as StoredAssessmentPayload | null,
    notes: updated.notes,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
    patient: {
      id: ownership.patient.id,
      full_name: ownership.patient.full_name,
      diagnosis: ownership.patient.diagnosis,
      age: ownership.patient.age,
      gender: ownership.patient.gender,
      sport: ownership.patient.sport,
      status: ownership.patient.status,
    },
  };

  return NextResponse.json(response);
}
