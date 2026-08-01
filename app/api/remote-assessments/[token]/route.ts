import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";
import {
  isValidPostStrokeAssistanceType,
  isValidPostStrokeAssistiveDevice,
  isValidPostStrokeCommunicationSupport,
  isValidPostStrokeFallsOrNearFalls,
  isValidPostStrokeFunctionalAbility,
  isValidPostStrokeMoreAffectedSide,
  isValidPostStrokeRespondentType,
  isValidPostStrokeSubjectiveInputMode,
  isValidPostStrokeSubjectiveQuestionId,
  isValidPostStrokeUpperLimbUse,
  isValidPostStrokeWalkingAbility,
} from "@/app/lib/post-stroke-intake/types";
import { isValidPostStrokeUrgentSymptom } from "@/app/lib/post-stroke-intake/urgent-gate";

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

type RequestRow = {
  assessment_type: string;
  included_sections: unknown;
  expires_at: string;
  assessment_id: string | null;
};

type AssessmentRow = {
  structured_data: unknown;
};

/** Patient-facing resumable draft — deliberately excludes assessment_id and every other internal/provider field. */
type ResumableDraft = {
  respondent?: unknown;
  urgentGate?: unknown;
  functionalIntake?: unknown;
  subjectiveNarrative?: unknown;
  assessmentLanguage?: "en" | "ar";
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Re-validates the stored respondent shape before it's ever handed back to
 * the client — defense in depth so a resume response can never echo back
 * something that shouldn't have been persisted in the first place.
 */
function sanitizeRespondent(raw: unknown): unknown {
  if (!isPlainObject(raw) || !isValidPostStrokeRespondentType(raw.type)) return undefined;
  if (raw.assistanceType !== undefined && !isValidPostStrokeAssistanceType(raw.assistanceType)) {
    return { type: raw.type };
  }
  return raw.assistanceType !== undefined ? { type: raw.type, assistanceType: raw.assistanceType } : { type: raw.type };
}

function sanitizeUrgentGate(raw: unknown): unknown {
  if (!isPlainObject(raw) || !Array.isArray(raw.symptoms) || !raw.symptoms.every(isValidPostStrokeUrgentSymptom)) {
    return undefined;
  }
  return raw;
}

/** Drops any field that fails its closed-enum guard rather than erroring — this is a read path, not a write boundary. */
function sanitizeFunctionalIntake(raw: unknown): unknown {
  if (!isPlainObject(raw)) return undefined;
  const out: Record<string, unknown> = {};
  if (isValidPostStrokeMoreAffectedSide(raw.moreAffectedSide)) out.moreAffectedSide = raw.moreAffectedSide;
  if (isValidPostStrokeFunctionalAbility(raw.sittingAbility)) out.sittingAbility = raw.sittingAbility;
  if (isValidPostStrokeFunctionalAbility(raw.standingAbility)) out.standingAbility = raw.standingAbility;
  if (isValidPostStrokeWalkingAbility(raw.walkingAbility)) out.walkingAbility = raw.walkingAbility;
  if (isValidPostStrokeAssistiveDevice(raw.assistiveDevice)) out.assistiveDevice = raw.assistiveDevice;
  if (typeof raw.assistiveDeviceOtherText === "string") out.assistiveDeviceOtherText = raw.assistiveDeviceOtherText;
  if (isValidPostStrokeFallsOrNearFalls(raw.recentFalls)) out.recentFalls = raw.recentFalls;
  if (isValidPostStrokeUpperLimbUse(raw.upperLimbUse)) out.upperLimbUse = raw.upperLimbUse;
  if (isValidPostStrokeCommunicationSupport(raw.communicationSupport)) out.communicationSupport = raw.communicationSupport;
  if (typeof raw.communicationSupportOtherText === "string") {
    out.communicationSupportOtherText = raw.communicationSupportOtherText;
  }
  if (typeof raw.functionalGoal === "string") out.functionalGoal = raw.functionalGoal;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Drops any malformed response entry rather than erroring — this is a read
 * path, not a write boundary. Never includes patientConfirmedAt beyond what
 * validation already wrote server-side; this function only re-derives the
 * shape, it never trusts or recomputes it.
 */
function sanitizeSubjectiveNarrative(raw: unknown): unknown {
  if (!isPlainObject(raw) || !Array.isArray(raw.responses)) return undefined;

  const responses: Record<string, unknown>[] = [];
  for (const item of raw.responses) {
    if (!isPlainObject(item)) continue;
    if (!isValidPostStrokeSubjectiveQuestionId(item.questionId)) continue;
    if (!isValidPostStrokeSubjectiveInputMode(item.inputMode)) continue;
    if (typeof item.text !== "string" || !item.text.trim()) continue;
    responses.push({ questionId: item.questionId, inputMode: item.inputMode, text: item.text });
  }

  if (responses.length === 0) return undefined;

  const out: Record<string, unknown> = { responses };
  if (typeof raw.patientConfirmedAt === "string" && raw.patientConfirmedAt.trim()) {
    out.patientConfirmedAt = raw.patientConfirmedAt;
  }
  return out;
}

/**
 * Builds the patient-facing resumable draft from a stored assessment's
 * structured_data — only the fields needed to restore the form. Returns
 * undefined if there is nothing resumable (malformed or empty data).
 */
function buildResumableDraft(structuredData: unknown): ResumableDraft | undefined {
  if (!isPlainObject(structuredData)) return undefined;
  const postStrokeIntake = structuredData.postStrokeIntake;
  if (!isPlainObject(postStrokeIntake)) return undefined;

  const draft: ResumableDraft = {};
  const respondent = sanitizeRespondent(postStrokeIntake.respondent);
  if (respondent !== undefined) draft.respondent = respondent;
  const urgentGate = sanitizeUrgentGate(postStrokeIntake.urgentGate);
  if (urgentGate !== undefined) draft.urgentGate = urgentGate;
  const functionalIntake = sanitizeFunctionalIntake(postStrokeIntake.functionalIntake);
  if (functionalIntake !== undefined) draft.functionalIntake = functionalIntake;
  const subjectiveNarrative = sanitizeSubjectiveNarrative(postStrokeIntake.subjectiveNarrative);
  if (subjectiveNarrative !== undefined) draft.subjectiveNarrative = subjectiveNarrative;
  if (structuredData.assessmentLanguage === "en" || structuredData.assessmentLanguage === "ar") {
    draft.assessmentLanguage = structuredData.assessmentLanguage;
  }

  return Object.keys(draft).length > 0 ? draft : undefined;
}

/**
 * GET /api/remote-assessments/[token]
 * Patient-facing lookup — no auth, token only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "get");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  const admin = adminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  const { data: row, error } = await admin
    .from("remote_assessment_requests")
    .select("assessment_type, included_sections, expires_at, assessment_id")
    .eq("token", trimmed)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (error) {
    console.error("[GET /api/remote-assessments/[token]] query failed");
    return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // Resume support: only post_stroke_intake ever has a linked draft worth
  // returning here — every other assessment type keeps the prior response
  // shape unchanged, and assessment_id itself is never exposed to the client.
  let draft: ResumableDraft | undefined;
  if (row.assessment_type === "post_stroke_intake" && row.assessment_id) {
    const { data: assessmentRow, error: assessmentError } = await admin
      .from("assessments")
      .select("structured_data")
      .eq("id", row.assessment_id)
      .maybeSingle<AssessmentRow>();

    if (assessmentError) {
      console.error("[GET /api/remote-assessments/[token]] draft lookup failed");
      return NextResponse.json({ error: "Failed to load assessment." }, { status: 500 });
    }

    draft = assessmentRow ? buildResumableDraft(assessmentRow.structured_data) : undefined;
  }

  return NextResponse.json({
    assessmentType: row.assessment_type,
    includedSections: Array.isArray(row.included_sections) ? row.included_sections : [],
    expiresAt: row.expires_at,
    ...(draft ? { draft } : {}),
  });
}
