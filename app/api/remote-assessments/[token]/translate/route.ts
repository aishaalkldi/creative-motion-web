/**
 * POST /api/remote-assessments/[token]/translate
 *
 * Token-scoped clinical Arabic-to-English translation for the remote
 * pre-assessment flow (Phase 1). Shares translation logic with the
 * clinician-authenticated /api/assessments/[id]/translate route via
 * translateClinicalText() — same model, same prompt, same behavior.
 *
 * No structured_data is read or written here; this route is a stateless
 * translation proof for a single piece of already-transcribed text.
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
import { translateClinicalText } from "@/app/lib/ai/translate-clinical-text";

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

  const limited = checkRemoteAssessmentLimit(req, trimmed, "translate");
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
    console.error("[POST /api/remote-assessments/[token]/translate] fetch failed");
    return NextResponse.json({ error: "Translation request failed." }, { status: 500 });
  }
  if (!requestRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  let body: { text?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text } = body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text is too long." }, { status: 400 });
  }

  const originalText = text;
  const result = await translateClinicalText(keyConfig.apiKey, originalText);

  if (!result.ok) {
    console.error("[POST /api/remote-assessments/[token]/translate] translation failed:", result.code);
    if (result.code === "no_content") {
      return NextResponse.json({ error: "Translation service returned no content." }, { status: 502 });
    }
    if (result.code === "rate_limit") {
      return NextResponse.json(
        { error: "Translation service rate limit reached. Try again shortly." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Translation service unavailable." }, { status: 503 });
  }

  return NextResponse.json({
    original_transcript: originalText,
    translation: result.translation,
  });
}
