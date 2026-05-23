import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { validatePatientOwnership } from "../../../../lib/validate-patient-ownership";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return NextResponse.json({ error: "Assessment ID is required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Translation is not configured yet", code: "not_configured" },
      { status: 503 },
    );
  }

  const clients = await buildClients();
  if (!clients) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }
  const { sessionClient, adminClient } = clients;

  const {
    data: { user },
    error: authErr,
  } = await sessionClient.auth.getUser();
  if (authErr ?? !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fieldKey?: unknown; text?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { fieldKey, text } = body;

  if (!fieldKey || typeof fieldKey !== "string") {
    return NextResponse.json({ error: "fieldKey is required" }, { status: 400 });
  }
  if (!text || typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (/^\d+$/.test(text.trim())) {
    return NextResponse.json(
      { error: "Numeric values do not require translation" },
      { status: 400 },
    );
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { error: "Text too long for translation" },
      { status: 400 },
    );
  }

  const { data: assessment, error: queryErr } = await adminClient
    .from("assessments")
    .select("id, patient_id, provider_id, structured_data")
    .eq("id", assessmentId)
    .eq("provider_id", user.id)
    .maybeSingle<AssessmentRow>();

  if (queryErr) {
    console.error("[POST /api/assessments/[id]/translate] query failed:", queryErr.message);
    return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
  }
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownership = await validatePatientOwnership(adminClient, assessment.patient_id, user.id);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.message }, { status: ownership.httpStatus });
  }

  const structuredData = (assessment.structured_data ?? {}) as Record<string, unknown>;
  const existingKey = `${fieldKey}_en`;
  const existingTranslation = structuredData[existingKey];
  if (typeof existingTranslation === "string" && existingTranslation.trim()) {
    const generatedAt = structuredData[`${fieldKey}_en_generated_at`];
    return NextResponse.json({
      translation: existingTranslation,
      generatedAt: typeof generatedAt === "string" ? generatedAt : null,
      cached: true,
    });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let translation: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a clinical Arabic-to-English translator for physiotherapy assessment reports.

Your task: translate the provided Arabic patient statement into clear, accurate English.

Rules:
- Translate only what the patient stated.
- Do not add clinical interpretation.
- Do not infer symptoms not explicitly mentioned.
- Do not generate diagnosis or clinical impression.
- Do not add medical terminology not present in the original.
- If a word is ambiguous, use the most literal translation and add [translator note: ambiguous term] in brackets.
- Return only the translated text.
- Do not include preamble, explanation, or quotation marks.
- Do not translate numeric values.

Output format: translated text only, one paragraph.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });
    translation = response.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    console.error(
      "Translation error:",
      typeof error === "object" ? "OpenAI API error" : "Unknown error",
    );
    return NextResponse.json(
      { error: "Translation service unavailable" },
      { status: 503 },
    );
  }

  if (!translation) {
    return NextResponse.json(
      { error: "Translation returned empty result" },
      { status: 500 },
    );
  }

  const generatedAt = new Date().toISOString();
  const updatedData: Record<string, unknown> = {
    ...structuredData,
    [existingKey]: translation,
    [`${fieldKey}_en_generated_at`]: generatedAt,
    [`${fieldKey}_en_reviewed`]: false,
  };

  const { error: updateError } = await adminClient
    .from("assessments")
    .update({ structured_data: updatedData, updated_at: generatedAt })
    .eq("id", assessmentId)
    .eq("provider_id", user.id);

  if (updateError) {
    console.error("Failed to save translation:", updateError.code);
    return NextResponse.json({ error: "Failed to save translation" }, { status: 500 });
  }

  return NextResponse.json({
    translation,
    generatedAt,
    cached: false,
  });
}
