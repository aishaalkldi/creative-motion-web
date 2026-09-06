import { translateClinicalText } from "@/app/lib/ai/translate-clinical-text";
import {
  STROKE_SECTION_TITLES,
  strokeQuestionById,
  type StrokeQuestionnaireSubmission,
  type StrokeResponse,
} from "./stroke-questionnaire-schema";

const FORBIDDEN_TRANSLATION_UPGRADES = [
  "spasticity",
  "hemiparesis",
  "foot drop",
  "neglect",
  "proprioceptive deficit",
  "aphasia",
] as const;

function rawText(response: StrokeResponse): string {
  return Array.isArray(response.rawValue)
    ? response.rawValue.join(", ")
    : response.rawValue;
}

function reporterPrefix(response: StrokeResponse): string {
  return response.provenance === "CAREGIVER_REPORTED"
    ? "The caregiver reports"
    : "The patient reports";
}

function selectionTranslation(id: string, response: StrokeResponse): string {
  const question = strokeQuestionById(id);
  const values = Array.isArray(response.rawValue) ? response.rawValue : [response.rawValue];
  const labels = values.map(
    (value) => question?.options?.find((option) => option.value === value)?.en ?? value,
  );
  const provenanceLabel =
    response.provenance === "CAREGIVER_REPORTED"
      ? "Caregiver-reported response"
      : "Patient-reported response";
  return `${provenanceLabel} — ${question?.en ?? id}: ${labels.join(", ")}.`;
}

function hasForbiddenUpgrade(text: string): boolean {
  const normalized = text.toLowerCase();
  return FORBIDDEN_TRANSLATION_UPGRADES.some((term) => normalized.includes(term));
}

export async function translateStrokeSubmission(
  submission: StrokeQuestionnaireSubmission,
  apiKey: string,
): Promise<{
  submission: StrokeQuestionnaireSubmission;
  failedFieldIds: string[];
}> {
  const responses = { ...submission.responses };
  const failedFieldIds: string[] = [];
  const generatedAt = new Date().toISOString();

  for (const [id, response] of Object.entries(responses)) {
    if (!rawText(response).trim()) continue;
    if (response.rawLanguage === "en") {
      responses[id] = {
        ...response,
        clinicalEnglish:
          response.responseMethod === "selection"
            ? selectionTranslation(id, response)
            : `${reporterPrefix(response)} ${rawText(response).trim()}`,
        translation: { status: "review_required", generatedAt },
      };
      continue;
    }

    if (response.responseMethod === "selection") {
      responses[id] = {
        ...response,
        clinicalEnglish: selectionTranslation(id, response),
        translation: { status: "review_required", generatedAt },
      };
      continue;
    }

    const question = strokeQuestionById(id);
    const result = await translateClinicalText(apiKey, rawText(response), undefined, {
      fieldKey: id,
      questionLabel: question?.en ?? id,
      sectionTitle: question
        ? STROKE_SECTION_TITLES[question.sectionId].en
        : "Stroke questionnaire",
      clinicalConcept: "patient_or_caregiver_reported_stroke_intake",
      valueType: "subjective_report",
      isVoiceTranscription: response.responseMethod === "voice",
    });
    if (!result.ok || hasForbiddenUpgrade(result.translation)) {
      failedFieldIds.push(id);
      continue;
    }
    const translated = result.translation
      .replace(/^The patient reports/i, reporterPrefix(response))
      .replace(/^Patient reports/i, reporterPrefix(response));
    responses[id] = {
      ...response,
      clinicalEnglish: translated,
      translation: { status: "review_required", generatedAt },
    };
  }

  return {
    submission: {
      ...submission,
      responses,
      strokeWorkflow: {
        ...submission.strokeWorkflow,
        translation: {
          status: failedFieldIds.length === 0 ? "review_required" : "not_generated",
        },
        report: { status: "not_generated" },
      },
    },
    failedFieldIds,
  };
}

export function approveStrokeTranslations(
  submission: StrokeQuestionnaireSubmission,
  approvedBy?: string,
): StrokeQuestionnaireSubmission {
  const approvedAt = new Date().toISOString();
  const responses = Object.fromEntries(
    Object.entries(submission.responses).map(([id, response]) => [
      id,
      response.clinicalEnglish?.trim()
        ? {
            ...response,
            translation: {
              ...response.translation,
              status: "approved" as const,
              approvedAt,
              approvedBy,
            },
          }
        : response,
    ]),
  );
  return {
    ...submission,
    responses,
    strokeWorkflow: {
      ...submission.strokeWorkflow,
      translation: { status: "approved", approvedAt },
      report: { status: "not_generated" },
    },
  };
}

export function allStrokeTranslationsPresent(
  submission: StrokeQuestionnaireSubmission,
): boolean {
  return Object.values(submission.responses).every(
    (response) =>
      !rawText(response).trim() ||
      (typeof response.clinicalEnglish === "string" &&
        response.clinicalEnglish.trim().length > 0),
  );
}
