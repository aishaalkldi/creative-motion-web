/**
 * Server-side batch translation for remote questionnaire submissions.
 * Preserves original patient text; writes sibling {fieldKey}_en keys only.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import {
  buildTranslationContextFromSpec,
  translateClinicalText,
  type ClinicalTranslationContext,
  type ClinicalTranslationResult,
} from "@/app/lib/ai/translate-clinical-text";
import { getAssessmentLanguage } from "@/app/lib/assessment-payload";
import { PATIENT_SECTION_QUESTIONS } from "@/app/lib/patient-assessment-questions";
import { isPatientAssessmentDraft } from "@/app/lib/remote-questionnaire-summary";
import { normalizeClinicalEnglishText } from "@/app/lib/reports/normalize-clinical-english";
import { getQuestionnaireFieldSpec } from "@/app/lib/reports/questionnaire-clinical-field-registry";
import { isTranslatablePatientFieldKey } from "@/app/lib/reports/patient-clinical-translation";

export const CLINICAL_TRANSLATION_REVIEW_WARNING =
  "Clinical English translation could not be generated for all fields. Original patient responses are shown for therapist review.";

export type TranslatableDraftField = {
  fieldKey: string;
  text: string;
  context?: ClinicalTranslationContext;
  isVoiceTranscription: boolean;
};

export function collectTranslatableDraftFields(
  draft: PatientAssessmentDraft,
  structuredData?: Record<string, unknown>,
): TranslatableDraftField[] {
  const fields: TranslatableDraftField[] = [];

  for (const sectionId of Object.keys(PATIENT_SECTION_QUESTIONS) as PatientSectionId[]) {
    const block = draft[sectionId];
    if (!block || typeof block !== "object") continue;

    for (const question of PATIENT_SECTION_QUESTIONS[sectionId]) {
      if (!isTranslatablePatientFieldKey(question.key)) continue;
      const raw = (block as Record<string, string>)[question.key];
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (!trimmed || /^\d+$/.test(trimmed)) continue;
      const spec = getQuestionnaireFieldSpec(question.key);
      const isVoiceTranscription =
        structuredData?.[`${question.key}_method`] === "voice";
      fields.push({
        fieldKey: question.key,
        text: trimmed,
        context: spec ? buildTranslationContextFromSpec(spec, isVoiceTranscription) : undefined,
        isVoiceTranscription,
      });
    }
  }

  return fields;
}

export type BatchTranslateRemoteQuestionnaireResult = {
  structuredData: Record<string, unknown>;
  failedFieldKeys: string[];
  translationAttempted: boolean;
};

export type ClinicalTextTranslator = (
  text: string,
  context?: ClinicalTranslationContext,
) => Promise<ClinicalTranslationResult>;

export type BatchTranslateOptions = {
  /** When true, overwrite existing {fieldKey}_en values. */
  regenerate?: boolean;
};

export async function batchTranslateRemoteQuestionnaire(
  structuredData: Record<string, unknown>,
  apiKey: string | null,
  translateFn?: ClinicalTextTranslator,
  options: BatchTranslateOptions = {},
): Promise<BatchTranslateRemoteQuestionnaireResult> {
  const translate =
    translateFn ??
    (async (text: string, context?: ClinicalTranslationContext) => {
      if (!apiKey) return { ok: false, code: "no_content" };
      return translateClinicalText(apiKey, text, undefined, context);
    });
  if (getAssessmentLanguage(structuredData) !== "ar" || !isPatientAssessmentDraft(structuredData)) {
    return { structuredData, failedFieldKeys: [], translationAttempted: false };
  }

  const fields = collectTranslatableDraftFields(structuredData, structuredData);
  if (fields.length === 0) {
    return { structuredData, failedFieldKeys: [], translationAttempted: false };
  }

  const updated: Record<string, unknown> = { ...structuredData };
  const failedFieldKeys: string[] = [];
  const generatedAt = new Date().toISOString();

  if (!apiKey) {
    for (const { fieldKey } of fields) {
      failedFieldKeys.push(fieldKey);
    }
    updated.clinical_translation_status = "failed";
    updated.clinical_translation_warning = CLINICAL_TRANSLATION_REVIEW_WARNING;
    return { structuredData: updated, failedFieldKeys, translationAttempted: true };
  }

  for (const { fieldKey, text, context } of fields) {
    const existingKey = `${fieldKey}_en`;
    const existing = updated[existingKey];
    if (!options.regenerate && typeof existing === "string" && existing.trim()) continue;

    const result = await translate(text, context);
    if (result.ok) {
      const normalized = normalizeClinicalEnglishText(result.translation);
      updated[existingKey] = normalized.text;
      updated[`${fieldKey}_en_ai`] = normalized.text;
      updated[`${fieldKey}_en_generated_at`] = generatedAt;
      updated[`${fieldKey}_en_reviewed`] = false;
      delete updated[`${fieldKey}_en_edited_at`];
    } else {
      failedFieldKeys.push(fieldKey);
    }
  }

  if (failedFieldKeys.length > 0) {
    updated.clinical_translation_status =
      failedFieldKeys.length === fields.length ? "failed" : "partial";
    updated.clinical_translation_warning = CLINICAL_TRANSLATION_REVIEW_WARNING;
  } else {
    updated.clinical_translation_status = "review_required";
  }

  return { structuredData: updated, failedFieldKeys, translationAttempted: true };
}
