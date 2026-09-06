import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOpenAiKeyConfig } from "@/app/lib/openai/server-env";
import {
  AI_ERROR_CODES,
  aiErrorHttpStatus,
  aiErrorMessage,
  fromKeyConfigCode,
} from "@/app/lib/ai/ai-errors";
import { checkAiRateLimit } from "@/app/lib/ai/rate-limit";
import {
  batchTranslateRemoteQuestionnaire,
  CLINICAL_TRANSLATION_REVIEW_WARNING,
  collectTranslatableDraftFields,
} from "@/app/lib/reports/batch-translate-remote-questionnaire";
import {
  aiErrorJson,
  loadRemoteQuestionnaireAssessment,
  saveAssessmentStructuredData,
} from "@/app/lib/reports/assessment-workflow-route-auth";
import {
  applyClinicalEnglishFieldEdit,
  readStoredClinicalTranslation,
} from "@/app/lib/reports/patient-clinical-translation";
import {
  assertPatientAssessmentDraft,
  hasAllClinicalEnglishFields,
  invalidatePtReportOnTranslationChange,
  readClinicalTranslationStatus,
} from "@/app/lib/reports/remote-questionnaire-workflow";

export const TRANSLATION_FAILURE_MESSAGE =
  "Translation could not be generated. Original patient responses are unchanged.";

type TranslateBody = {
  regenerate?: unknown;
  markReviewed?: unknown;
  approve?: unknown;
  saveFieldEdits?: unknown;
};

type FieldEdit = { fieldKey?: unknown; clinicalEnglish?: unknown };

/**
 * POST /api/assessments/[id]/translate-questionnaire
 * Clinician-initiated batch translation for remote questionnaire submissions.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await params;
  if (!assessmentId?.trim()) {
    return aiErrorJson(AI_ERROR_CODES.AI_INVALID_INPUT);
  }

  let body: TranslateBody = {};
  try {
    body = (await req.json()) as TranslateBody;
  } catch {
    body = {};
  }
  const regenerate = body.regenerate === true;
  const approve = body.approve === true || body.markReviewed === true;
  const saveFieldEdits = Array.isArray(body.saveFieldEdits) ? body.saveFieldEdits : null;

  const loaded = await loadRemoteQuestionnaireAssessment(assessmentId);
  if (!loaded.ok) return loaded.response;

  const { assessment, adminClient } = loaded;
  let structuredData = { ...(assessment.structured_data ?? {}) };
  const draft = assertPatientAssessmentDraft(structuredData);
  if (!draft) {
    return aiErrorJson(AI_ERROR_CODES.AI_CONTEXT_INVALID);
  }

  if (saveFieldEdits && saveFieldEdits.length > 0) {
    for (const edit of saveFieldEdits as FieldEdit[]) {
      const fieldKey = typeof edit.fieldKey === "string" ? edit.fieldKey.trim() : "";
      const clinicalEnglish =
        typeof edit.clinicalEnglish === "string" ? edit.clinicalEnglish.trim() : "";
      if (!fieldKey || !clinicalEnglish) continue;
      structuredData = applyClinicalEnglishFieldEdit(structuredData, fieldKey, clinicalEnglish);
    }
    structuredData = invalidatePtReportOnTranslationChange(structuredData);
    const status = readClinicalTranslationStatus(structuredData);
    if (status !== "failed" && status !== "partial" && status !== "not_generated") {
      structuredData.clinical_translation_status = "review_required";
    }

    const saved = await saveAssessmentStructuredData(
      adminClient,
      assessment.id,
      assessment.provider_id,
      structuredData,
    );
    if (!saved.ok) return saved.response;

    return NextResponse.json({
      clinicalTranslationStatus: structuredData.clinical_translation_status,
      reviewed: false,
      savedFieldEdits: saveFieldEdits.length,
    });
  }

  if (approve) {
    if (!hasAllClinicalEnglishFields(structuredData, draft)) {
      return NextResponse.json(
        {
          error: "Clinical English is incomplete. Generate or complete all field translations before approval.",
          code: AI_ERROR_CODES.AI_INVALID_INPUT,
        },
        { status: 400 },
      );
    }

    const approvedAt = new Date().toISOString();
    structuredData.clinical_translation_reviewed = true;
    structuredData.clinical_translation_reviewed_at = approvedAt;
    structuredData.clinical_translation_approved_at = approvedAt;
    structuredData.clinical_translation_status = "approved";
    delete structuredData.clinical_translation_warning;

    const saved = await saveAssessmentStructuredData(
      adminClient,
      assessment.id,
      assessment.provider_id,
      structuredData,
    );
    if (!saved.ok) return saved.response;
    return NextResponse.json({
      clinicalTranslationStatus: structuredData.clinical_translation_status,
      reviewed: true,
      approved: true,
    });
  }

  const keyConfig = getOpenAiKeyConfig();
  if (!keyConfig.ok) {
    const code = fromKeyConfigCode(keyConfig.code);
    return NextResponse.json(
      { error: aiErrorMessage(code), code, userMessage: TRANSLATION_FAILURE_MESSAGE },
      { status: aiErrorHttpStatus(code) },
    );
  }

  const rateLimit = checkAiRateLimit(assessment.provider_id);
  if (!rateLimit.allowed) {
    return aiErrorJson(AI_ERROR_CODES.AI_RATE_LIMITED);
  }

  const translation = await batchTranslateRemoteQuestionnaire(
    structuredData,
    keyConfig.apiKey,
    undefined,
    { regenerate },
  );

  let nextData: Record<string, unknown> = invalidatePtReportOnTranslationChange({
    ...translation.structuredData,
    clinical_translation_reviewed: false,
  });

  if (translation.translationAttempted && translation.failedFieldKeys.length > 0) {
    nextData.clinical_translation_warning = CLINICAL_TRANSLATION_REVIEW_WARNING;
  } else if (translation.translationAttempted) {
    delete nextData.clinical_translation_warning;
  }

  const saved = await saveAssessmentStructuredData(
    adminClient,
    assessment.id,
    assessment.provider_id,
    nextData,
  );
  if (!saved.ok) return saved.response;

  if (translation.translationAttempted && translation.failedFieldKeys.length > 0) {
    return NextResponse.json({
      clinicalTranslationStatus: nextData.clinical_translation_status,
      failedFieldKeys: translation.failedFieldKeys,
      userMessage: TRANSLATION_FAILURE_MESSAGE,
      partial: translation.failedFieldKeys.length < collectTranslatableDraftFields(draft).length,
      reviewed: false,
    });
  }

  return NextResponse.json({
    clinicalTranslationStatus: nextData.clinical_translation_status,
    failedFieldKeys: translation.failedFieldKeys,
    reviewed: false,
    translations: collectTranslatableDraftFields(draft).map(({ fieldKey }) => ({
      fieldKey,
      clinicalEnglish: readStoredClinicalTranslation(nextData, fieldKey),
    })),
  });
}
