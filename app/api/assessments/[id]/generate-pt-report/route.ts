import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validatePatientOwnership } from "@/app/lib/validate-patient-ownership";
import { getOpenAiKeyConfig } from "@/app/lib/openai/server-env";
import {
  AI_ERROR_CODES,
  aiErrorHttpStatus,
  aiErrorMessage,
  fromKeyConfigCode,
  mapPtReportGenerationError,
} from "@/app/lib/ai/ai-errors";
import { checkAiRateLimit } from "@/app/lib/ai/rate-limit";
import {
  buildPtMedicalReportDraftRecord,
  clearPtMedicalReportGate2Approval,
  generatePtMedicalReportSections,
  POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT,
  readPtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";
import { readApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";

/**
 * Assessment types this generator supports. remote_questionnaire behavior
 * (prompt, facts shape, everything downstream) is completely unchanged —
 * post_stroke_intake only adds a parallel facts path (see
 * approved-patient-facts.ts) and an extended prompt branch that additionally
 * permits translating a non-English approved fact into clinical English.
 */
const SUPPORTED_ASSESSMENT_TYPES = new Set(["remote_questionnaire", "post_stroke_intake"]);

/**
 * POST /api/assessments/[id]/generate-pt-report
 *
 * Generates an English PT medical report draft from clinician-approved
 * patient-reported facts stored on the assessment. The request body is
 * ignored — approved facts are never accepted from the client.
 */

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

function aiErrorJson(code: (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES]) {
  return NextResponse.json(
    { error: aiErrorMessage(code), code },
    { status: aiErrorHttpStatus(code) },
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return aiErrorJson(AI_ERROR_CODES.AI_INVALID_INPUT);
  }

  const session = await requireClinicianSession({ unauthorizedMessage: "Unauthorized" });
  if (!session.ok) return session.response;
  const { user } = session;

  const clients = await buildClients();
  if (!clients) {
    return aiErrorJson(AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }
  const { adminClient } = clients;

  const { data: assessment, error: queryErr } = await adminClient
    .from("assessments")
    .select("id, patient_id, provider_id, type, structured_data")
    .eq("id", assessmentId)
    .eq("provider_id", user.id)
    .maybeSingle<AssessmentRow>();

  if (queryErr) {
    console.error("[POST /api/assessments/[id]/generate-pt-report] query failed:", queryErr.message);
    return aiErrorJson(AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }
  if (!assessment) {
    return aiErrorJson(AI_ERROR_CODES.AI_CONTEXT_INVALID);
  }

  if (!SUPPORTED_ASSESSMENT_TYPES.has(assessment.type)) {
    return aiErrorJson(AI_ERROR_CODES.AI_INVALID_INPUT);
  }

  const ownership = await validatePatientOwnership(adminClient, assessment.patient_id, user.id);
  if (!ownership.ok) {
    return aiErrorJson(AI_ERROR_CODES.AI_CONTEXT_INVALID);
  }

  const structuredData = (assessment.structured_data ?? {}) as Record<string, unknown>;
  const approvedFacts = readApprovedPatientReportFacts(structuredData);
  if (!approvedFacts) {
    return NextResponse.json(
      {
        error: "Approve patient-reported information before generating the PT report.",
        code: AI_ERROR_CODES.AI_INVALID_INPUT,
      },
      { status: 400 },
    );
  }

  // Ignore any client-supplied facts — body is intentionally unread.
  void req;

  const rateLimit = checkAiRateLimit(user.id);
  if (!rateLimit.allowed) {
    return aiErrorJson(AI_ERROR_CODES.AI_RATE_LIMITED);
  }

  const keyConfig = getOpenAiKeyConfig();
  if (!keyConfig.ok) {
    const code = fromKeyConfigCode(keyConfig.code);
    return NextResponse.json(
      { error: aiErrorMessage(code), code },
      { status: aiErrorHttpStatus(code) },
    );
  }

  const generation = await generatePtMedicalReportSections(
    keyConfig.apiKey,
    approvedFacts,
    undefined,
    assessment.type === "post_stroke_intake" ? POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT : undefined,
  );
  if (!generation.ok) {
    if (generation.code === "invalid_output") {
      console.error(
        "[POST /api/assessments/[id]/generate-pt-report] invalid model output:",
        generation.code,
      );
      return aiErrorJson(AI_ERROR_CODES.AI_INVALID_OUTPUT);
    }
    if (generation.code === "no_content") {
      console.error(
        "[POST /api/assessments/[id]/generate-pt-report] invalid model output:",
        generation.code,
      );
      return aiErrorJson(AI_ERROR_CODES.AI_INVALID_OUTPUT);
    }
    const code = mapPtReportGenerationError(generation.code);
    console.error(
      "[POST /api/assessments/[id]/generate-pt-report] OpenAI error:",
      code,
    );
    return NextResponse.json(
      { error: aiErrorMessage(code), code },
      { status: aiErrorHttpStatus(code) },
    );
  }

  const generatedAt = new Date().toISOString();
  const existingDraft = readPtMedicalReportDraft(structuredData);
  const ptMedicalReportDraft = buildPtMedicalReportDraftRecord(
    existingDraft,
    approvedFacts,
    generation.sections,
    generatedAt,
  );

  const updatedData: Record<string, unknown> = clearPtMedicalReportGate2Approval({
    ...structuredData,
    ptMedicalReportDraft,
  });

  const { error: updateError } = await adminClient
    .from("assessments")
    .update({ structured_data: updatedData, updated_at: generatedAt })
    .eq("id", assessmentId)
    .eq("provider_id", user.id);

  if (updateError) {
    console.error(
      "[POST /api/assessments/[id]/generate-pt-report] failed to save draft:",
      updateError.code,
    );
    return aiErrorJson(AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }

  return NextResponse.json({
    generated: true,
    ptMedicalReportDraft,
  });
}
