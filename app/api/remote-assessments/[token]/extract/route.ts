/**
 * POST /api/remote-assessments/[token]/extract
 *
 * Token-scoped constrained structured-field extraction for the remote
 * pre-assessment flow (Phase 1). Input is an already-transcribed patient
 * statement (Arabic or English text) — this route does not accept audio.
 *
 * Output is exactly six whitelisted fields (body_region, side,
 * primary_symptom, aggravating_factor, language, confidence). Extraction
 * only — pathway selection, branching, safety gating, and any diagnosis
 * or treatment conclusion are explicitly out of scope for this route.
 *
 * No structured_data is read or written here; this route is a stateless
 * extraction proof for a single piece of already-transcribed text.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";
import { getOpenAiKeyConfig } from "@/app/lib/openai/server-env";
import { extractStructuredClinicalFields } from "@/app/lib/ai/extract-clinical-fields";

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

type RequestRow = { id: string; status: string };

const MAX_TEXT_LENGTH = 2000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "extract");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  const keyConfig = getOpenAiKeyConfig();
  if (!keyConfig.ok) {
    return serviceUnavailableResponse();
  }

  const admin = adminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  const { data: requestRow, error: fetchError } = await admin
    .from("remote_assessment_requests")
    .select("id, status")
    .eq("token", trimmed)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (fetchError) {
    console.error("[POST /api/remote-assessments/[token]/extract] fetch failed");
    return NextResponse.json({ error: "Extraction request failed." }, { status: 500 });
  }
  if (!requestRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  let body: { text?: unknown; language?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, language: languageInput } = body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text is too long." }, { status: 400 });
  }
  const language = languageInput === "en" ? "en" : "ar";

  const originalText = text;
  const result = await extractStructuredClinicalFields(keyConfig.apiKey, originalText, language);

  if (!result.ok) {
    console.error("[POST /api/remote-assessments/[token]/extract] extraction failed:", result.code);
    if (result.code === "rate_limit") {
      return NextResponse.json(
        { error: "AI service rate limit reached. Try again shortly." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Structured extraction is temporarily unavailable." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    original_transcript: originalText,
    extraction: result.extraction,
  });
}
