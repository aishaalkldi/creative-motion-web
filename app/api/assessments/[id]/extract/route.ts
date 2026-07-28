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
  fromOpenAiClassified,
} from "@/app/lib/ai/ai-errors";
import { checkAiRateLimit } from "@/app/lib/ai/rate-limit";
import {
  extractStructuredClinicalFields,
  type StructuredExtraction,
} from "@/app/lib/ai/extract-clinical-fields";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";

/**
 * POST /api/assessments/[id]/extract
 *
 * Clinician-authenticated structured-field extraction from the chief
 * complaint already stored on the assessment. The request body is ignored
 * entirely — clinical text is never accepted from the client, only read
 * from structured_data.pain.chiefComplaint on the server. Reuses the same
 * extraction implementation as the token-scoped remote-assessment route
 * (extractStructuredClinicalFields) — no second extraction algorithm.
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
  structured_data: Record<string, unknown> | null;
};

function aiErrorJson(code: (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES]) {
  return NextResponse.json(
    { error: aiErrorMessage(code), code },
    { status: aiErrorHttpStatus(code) },
  );
}

/** Reads the original chief-complaint text unchanged — never trimmed, never rewritten. */
function readChiefComplaint(structuredData: Record<string, unknown>): string {
  const pain = structuredData.pain;
  if (!pain || typeof pain !== "object" || Array.isArray(pain)) return "";
  const value = (pain as Record<string, unknown>).chiefComplaint;
  return typeof value === "string" ? value : "";
}

function readAssessmentLanguage(structuredData: Record<string, unknown>): "ar" | "en" {
  return structuredData.assessmentLanguage === "ar" ? "ar" : "en";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return aiErrorJson(AI_ERROR_CODES.AI_INVALID_INPUT);
  }

  // Authenticate before touching AI configuration or building the admin
  // client, so an unauthenticated caller can never learn whether OpenAI is
  // configured on this server.
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
    .select("id, patient_id, provider_id, structured_data")
    .eq("id", assessmentId)
    .eq("provider_id", user.id)
    .maybeSingle<AssessmentRow>();

  if (queryErr) {
    console.error("[POST /api/assessments/[id]/extract] query failed:", queryErr.message);
    return aiErrorJson(AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }
  if (!assessment) {
    return aiErrorJson(AI_ERROR_CODES.AI_CONTEXT_INVALID);
  }

  const ownership = await validatePatientOwnership(adminClient, assessment.patient_id, user.id);
  if (!ownership.ok) {
    return aiErrorJson(AI_ERROR_CODES.AI_CONTEXT_INVALID);
  }

  const structuredData = (assessment.structured_data ?? {}) as Record<string, unknown>;
  const chiefComplaint = readChiefComplaint(structuredData);
  if (!chiefComplaint.trim()) {
    return aiErrorJson(AI_ERROR_CODES.AI_INVALID_INPUT);
  }

  const existingExtraction = structuredData.chiefComplaint_extraction;
  if (existingExtraction && typeof existingExtraction === "object" && !Array.isArray(existingExtraction)) {
    const generatedAt = structuredData.chiefComplaint_extraction_generated_at;
    const reviewed = structuredData.chiefComplaint_extraction_reviewed;
    return NextResponse.json({
      extraction: existingExtraction as StructuredExtraction,
      generatedAt: typeof generatedAt === "string" ? generatedAt : null,
      reviewed: reviewed === true,
      cached: true,
    });
  }

  const rateLimit = checkAiRateLimit(user.id);
  if (!rateLimit.allowed) {
    return aiErrorJson(AI_ERROR_CODES.AI_RATE_LIMITED);
  }

  // OpenAI configuration is resolved only now — after authentication,
  // ownership, stored-text validation, cache check, and rate limiting have
  // all passed — so it is checked only for a genuinely new extraction.
  const keyConfig = getOpenAiKeyConfig();
  if (!keyConfig.ok) {
    const code = fromKeyConfigCode(keyConfig.code);
    return NextResponse.json(
      { error: aiErrorMessage(code), code },
      { status: aiErrorHttpStatus(code) },
    );
  }

  const language = readAssessmentLanguage(structuredData);
  const result = await extractStructuredClinicalFields(keyConfig.apiKey, chiefComplaint, language);

  if (!result.ok) {
    if (result.code === "no_content") {
      return aiErrorJson(AI_ERROR_CODES.AI_NO_CONTENT);
    }
    if (result.code === "invalid_output") {
      console.error("[POST /api/assessments/[id]/extract] malformed model output");
      return aiErrorJson(AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
    }
    const code = fromOpenAiClassified(result.code);
    console.error("[POST /api/assessments/[id]/extract] OpenAI error:", code);
    return NextResponse.json(
      { error: aiErrorMessage(code), code },
      { status: aiErrorHttpStatus(code) },
    );
  }

  const generatedAt = new Date().toISOString();
  const updatedData: Record<string, unknown> = {
    ...structuredData,
    chiefComplaint_extraction: result.extraction,
    chiefComplaint_extraction_generated_at: generatedAt,
    chiefComplaint_extraction_reviewed: false,
  };

  const { error: updateError } = await adminClient
    .from("assessments")
    .update({ structured_data: updatedData, updated_at: generatedAt })
    .eq("id", assessmentId)
    .eq("provider_id", user.id);

  if (updateError) {
    console.error("[POST /api/assessments/[id]/extract] failed to save extraction:", updateError.code);
    return aiErrorJson(AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }

  return NextResponse.json({
    extraction: result.extraction,
    generatedAt,
    reviewed: false,
    cached: false,
  });
}
