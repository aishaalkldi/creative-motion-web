/**
 * POST /api/clinician/ai-motion-review
 *
 * Clinician-only AI draft from SessionMotionEvidenceSummary JSON only.
 * No timeline, landmarks, patient notes, or treatment recommendations.
 */
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { classifyOpenAiError } from "@/app/lib/openai/classify-openai-error";
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
  AI_MOTION_REVIEW_DISCLAIMER,
  AI_MOTION_REVIEW_FORBIDDEN_INPUT_KEYS,
  AI_MOTION_REVIEW_SCHEMA_VERSION,
} from "@/app/lib/ai/motion-review-constants";
import {
  AI_MOTION_REVIEW_SYSTEM_PROMPT,
  buildMotionReviewUserPrompt,
} from "@/app/lib/ai/motion-review-prompt";
import {
  buildSafeFallbackMotionReview,
  validateMotionReviewDraft,
} from "@/app/lib/ai/motion-review-validate";
import { findForbiddenMotionEvidenceKey } from "@/app/lib/cv/motion-evidence-privacy";
import {
  genericServerErrorResponse,
  serviceUnavailableResponse,
  unableToCompleteResponse,
} from "@/app/lib/api/safe-errors";

async function buildClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return null;

  const cookieStore = await cookies();
  const sessionClient = createServerClient(url, anon, {
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
  const adminClient = svc
    ? createAdminClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
    : sessionClient;
  return { sessionClient, adminClient };
}

type RequestBody = {
  motionSummaryId?: unknown;
};

export function parseAiMotionReviewRequestBody(
  body: RequestBody,
): { ok: true; motionSummaryId: string } | { ok: false } {
  const motionSummaryId =
    typeof body.motionSummaryId === "string" ? body.motionSummaryId.trim() : "";
  if (!motionSummaryId) return { ok: false };
  return { ok: true, motionSummaryId };
}

function parseJsonFromModel(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const clients = await buildClients();
  if (!clients) return serviceUnavailableResponse();
  const { sessionClient, adminClient } = clients;

  const {
    data: { user },
    error: authErr,
  } = await sessionClient.auth.getUser();
  if (authErr ?? !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parseAiMotionReviewRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "motionSummaryId is required." }, { status: 400 });
  }

  const { data: row, error: rowErr } = await adminClient
    .from("session_motion_summaries")
    .select("id, provider_id, summary_json")
    .eq("id", parsed.motionSummaryId)
    .maybeSingle<{ id: string; provider_id: string; summary_json: unknown }>();

  if (rowErr) {
    console.error("[POST /api/clinician/ai-motion-review] fetch failed");
    return genericServerErrorResponse();
  }
  if (!row || row.provider_id !== user.id) {
    return unableToCompleteResponse(404);
  }

  if (findForbiddenMotionEvidenceKey(row.summary_json)) {
    return genericServerErrorResponse();
  }

  for (const key of AI_MOTION_REVIEW_FORBIDDEN_INPUT_KEYS) {
    if (key in (row.summary_json as Record<string, unknown>)) {
      return genericServerErrorResponse();
    }
  }

  const summaryJson = JSON.stringify(row.summary_json);

  const keyConfig = getOpenAiKeyConfig();
  if (!keyConfig.ok) {
    const code = fromKeyConfigCode(keyConfig.code);
    return NextResponse.json(
      { error: aiErrorMessage(code), code },
      { status: aiErrorHttpStatus(code) },
    );
  }

  const rateLimit = checkAiRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: aiErrorMessage(AI_ERROR_CODES.AI_RATE_LIMITED) },
      { status: aiErrorHttpStatus(AI_ERROR_CODES.AI_RATE_LIMITED) },
    );
  }

  const fallback = buildSafeFallbackMotionReview();
  const openai = new OpenAI({ apiKey: keyConfig.apiKey });
  let draft = fallback;
  let usedFallback = true;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 280,
      temperature: 0.2,
      messages: [
        { role: "system", content: AI_MOTION_REVIEW_SYSTEM_PROMPT },
        { role: "user", content: buildMotionReviewUserPrompt(summaryJson) },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const parsedJson = raw ? parseJsonFromModel(raw) : null;
    const withDisclaimer =
      parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)
        ? { ...(parsedJson as Record<string, unknown>), disclaimer: AI_MOTION_REVIEW_DISCLAIMER }
        : null;
    const validated = withDisclaimer ? validateMotionReviewDraft(withDisclaimer) : null;
    if (validated) {
      draft = validated;
      usedFallback = false;
    }
  } catch (error) {
    const classified = classifyOpenAiError(error);
    const code = fromOpenAiClassified(classified.code);
    console.error("[POST /api/clinician/ai-motion-review] OpenAI error:", code);
    return NextResponse.json(
      {
        draft,
        disclaimer: AI_MOTION_REVIEW_DISCLAIMER,
        schemaVersion: AI_MOTION_REVIEW_SCHEMA_VERSION,
        fallback: true,
        warning: aiErrorMessage(code),
      },
      { status: 200 },
    );
  }

  await adminClient
    .from("session_motion_summaries")
    .update({ ai_review_draft: draft })
    .eq("id", row.id)
    .eq("provider_id", user.id);

  return NextResponse.json({
    draft,
    disclaimer: AI_MOTION_REVIEW_DISCLAIMER,
    schemaVersion: AI_MOTION_REVIEW_SCHEMA_VERSION,
    fallback: usedFallback,
  });
}
