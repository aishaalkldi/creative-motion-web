/**
 * Clinician-facing summary and Gate 1 review entries for submitted
 * post_stroke_intake assessments. Shows only confirmed patient-reported
 * subjective fields — never Stage 2 operational intake beyond functionalGoal,
 * and never client-only confirmation state.
 */
import { getAssessmentLanguage } from "@/app/lib/assessment-payload";
import {
  ASSISTANCE_TYPE_LABELS,
  clinicianText,
  FUNCTIONAL_GOAL_VOICE_LABEL,
  INPUT_MODE_LABELS,
  RESPONDENT_TYPE_LABELS,
  SUBJECTIVE_NARRATIVE_QUESTION_LABELS,
} from "@/app/lib/post-stroke-intake/questions";
import type {
  PostStrokeAssistanceType,
  PostStrokeRespondent,
  PostStrokeSubjectiveQuestionId,
  PostStrokeSubjectiveResponse,
} from "@/app/lib/post-stroke-intake/types";
import {
  isValidPostStrokeAssistanceType,
  isValidPostStrokeRespondentType,
  POST_STROKE_SUBJECTIVE_QUESTION_IDS,
  SUBJECTIVE_NARRATIVE_REQUIRED_QUESTION_IDS,
} from "@/app/lib/post-stroke-intake/types";

export const POST_STROKE_INTAKE_ASSESSMENT_TITLE = "Post-Stroke Intake Assessment" as const;

export type PostStrokeClinicianReviewEntry = {
  fieldKey: string;
  label: string;
  value: string;
  inputMode?: "text" | "voice";
  optional?: boolean;
};

export type PostStrokeIntakeClinicianSummary = {
  title: string;
  submittedAt: string;
  metrics: { label: string; value: string }[];
  rows: { label: string; value: string }[];
  hasRedFlag: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isPostStrokeIntakeStructuredData(structuredData: unknown): boolean {
  if (!isRecord(structuredData)) return false;
  return isRecord(structuredData.postStrokeIntake);
}

export function extractPostStrokeIntakeSubmissionMeta(
  structuredData: unknown,
  type: string,
): Record<string, unknown> | null {
  if (type !== "post_stroke_intake") return null;
  if (!isPostStrokeIntakeStructuredData(structuredData)) return null;
  return structuredData as Record<string, unknown>;
}

function readRespondent(postStrokeIntake: Record<string, unknown>): PostStrokeRespondent | null {
  const respondent = postStrokeIntake.respondent;
  if (!isRecord(respondent) || !isValidPostStrokeRespondentType(respondent.type)) return null;
  const assistanceTypeRaw = respondent.assistanceType;
  const assistanceType: PostStrokeAssistanceType | undefined =
    isValidPostStrokeAssistanceType(assistanceTypeRaw) ? assistanceTypeRaw : undefined;
  return { type: respondent.type, assistanceType };
}

function formatRespondent(respondent: PostStrokeRespondent): string {
  const base = clinicianText(RESPONDENT_TYPE_LABELS[respondent.type]);
  if (respondent.assistanceType) {
    return `${base} (${clinicianText(ASSISTANCE_TYPE_LABELS[respondent.assistanceType])})`;
  }
  return base;
}

function readSubjectiveResponses(
  postStrokeIntake: Record<string, unknown>,
): PostStrokeSubjectiveResponse[] {
  const subjectiveNarrative = postStrokeIntake.subjectiveNarrative;
  if (!isRecord(subjectiveNarrative) || !Array.isArray(subjectiveNarrative.responses)) {
    return [];
  }
  return subjectiveNarrative.responses.filter(
    (item): item is PostStrokeSubjectiveResponse =>
      isRecord(item) &&
      typeof item.questionId === "string" &&
      typeof item.text === "string" &&
      (item.inputMode === "text" || item.inputMode === "voice"),
  );
}

const NARRATIVE_FACT_KEYS = new Set<PostStrokeSubjectiveQuestionId>(
  POST_STROKE_SUBJECTIVE_QUESTION_IDS,
);

/**
 * Gate 1 review rows in stable display order. Functional goal is sourced
 * only from functionalIntake — never duplicated from narrative responses.
 */
export function buildPostStrokeIntakeClinicianReviewEntries(
  structuredData: Record<string, unknown>,
): PostStrokeClinicianReviewEntry[] {
  const postStrokeIntake = isRecord(structuredData.postStrokeIntake) ? structuredData.postStrokeIntake : {};
  const entries: PostStrokeClinicianReviewEntry[] = [];

  const respondent = readRespondent(postStrokeIntake);
  if (respondent) {
    entries.push({
      fieldKey: "respondent",
      label: "Respondent",
      value: formatRespondent(respondent),
    });
  }

  const functionalIntake = isRecord(postStrokeIntake.functionalIntake) ? postStrokeIntake.functionalIntake : {};
  const functionalGoal = asTrimmedString(functionalIntake.functionalGoal);
  if (functionalGoal) {
    entries.push({
      fieldKey: "functionalGoal",
      label: clinicianText(FUNCTIONAL_GOAL_VOICE_LABEL),
      value: functionalGoal,
    });
  }

  const responsesById = new Map<PostStrokeSubjectiveQuestionId, PostStrokeSubjectiveResponse>();
  for (const response of readSubjectiveResponses(postStrokeIntake)) {
    if (!NARRATIVE_FACT_KEYS.has(response.questionId)) continue;
    responsesById.set(response.questionId, response);
  }

  for (const questionId of POST_STROKE_SUBJECTIVE_QUESTION_IDS) {
    const response = responsesById.get(questionId);
    const text = response ? asTrimmedString(response.text) : null;
    if (!text) continue;
    entries.push({
      fieldKey: questionId,
      label: clinicianText(SUBJECTIVE_NARRATIVE_QUESTION_LABELS[questionId]),
      value: text,
      inputMode: response?.inputMode,
      optional: !SUBJECTIVE_NARRATIVE_REQUIRED_QUESTION_IDS.includes(questionId),
    });
  }

  const assessmentLanguage = getAssessmentLanguage(structuredData);
  if (assessmentLanguage) {
    entries.push({
      fieldKey: "assessmentLanguage",
      label: "Assessment language",
      value: assessmentLanguage === "ar" ? "Arabic" : "English",
    });
  }

  return entries;
}

export function buildPostStrokeIntakeSummary(
  structuredData: unknown,
  createdAt: string,
): PostStrokeIntakeClinicianSummary | null {
  if (!isPostStrokeIntakeStructuredData(structuredData)) return null;

  const entries = buildPostStrokeIntakeClinicianReviewEntries(
    structuredData as Record<string, unknown>,
  );
  const rows = entries
    .filter((entry) => entry.fieldKey !== "assessmentLanguage")
    .slice(0, 4)
    .map((entry) => ({ label: entry.label, value: entry.value }));

  const functionalGoal = entries.find((entry) => entry.fieldKey === "functionalGoal");
  const metrics = functionalGoal ? [{ label: functionalGoal.label, value: functionalGoal.value }] : [];

  return {
    title: POST_STROKE_INTAKE_ASSESSMENT_TITLE,
    submittedAt: createdAt,
    metrics,
    rows,
    hasRedFlag: false,
  };
}

export function formatPostStrokeInputModeIndicator(inputMode: "text" | "voice"): string {
  return clinicianText(INPUT_MODE_LABELS[inputMode]);
}
