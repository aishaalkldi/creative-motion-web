/**
 * Gate 1 — clinician-approved patient-reported facts for English PT report generation.
 * Builds a compact snapshot from reviewed translations, English originals, and
 * measured patient-reported values only. Never invents missing information.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import type { AssessmentLanguage } from "@/app/lib/assessment-payload";
import { buildClinicianReviewEntries } from "@/app/lib/patient-assessment-questions";
import { parseStoredExtraction } from "@/app/lib/reports/chief-complaint-extraction";
import {
  isTranslatablePatientFieldKey,
  isTranslationReviewed,
  readStoredClinicalTranslation,
} from "@/app/lib/reports/patient-clinical-translation";

export { isTranslationReviewed } from "@/app/lib/reports/patient-clinical-translation";

export const APPROVED_PATIENT_REPORT_FACTS_VERSION = 1 as const;

/** Questionnaire field keys eligible for the approved fact snapshot. */
export type ApprovedPatientFactKey =
  | "chiefComplaint"
  | "painLocation"
  | "painScore"
  | "aggravating"
  | "easing"
  | "dailyImpact"
  | "goals"
  | "limitations"
  | "worseWith"
  | "weaknessDescription"
  | "activitiesAffected"
  | "difficultyDescription"
  | "fallHistory"
  | "walkingDescription"
  | "aids"
  | "standingDuration"
  | "walkingDistance"
  | "stairsAbility"
  | "otherNotes"
  /** post_stroke_intake only — when this difficulty began or last changed. No equivalent general-MSK field exists to reuse. */
  | "onsetOrChange";

export type ApprovedPatientReportFacts = {
  version: typeof APPROVED_PATIENT_REPORT_FACTS_VERSION;
  approvedAt: string;
  facts: Partial<Record<ApprovedPatientFactKey, string>>;
  /** Present only when chiefComplaint_extraction_reviewed === true. */
  chiefComplaintExtraction?: {
    body_region: string;
    side: string;
    primary_symptom: string;
    aggravating_factor: string | null;
    language: string;
    confidence: number;
  };
  /**
   * Present only for post_stroke_intake facts. Unlike general-MSK facts
   * (which are always English by construction — reviewed translation is
   * required before inclusion), post-stroke facts are approved in the
   * patient's original language; the generator translates them into
   * clinical English as part of organizing the summary.
   */
  assessmentLanguage?: AssessmentLanguage | null;
};

const FORBIDDEN_FACT_PATTERNS: RegExp[] = [
  /\bdiagnos(is|ed|e)\b/i,
  /\bprognosis\b/i,
  /\btreatment recommendation\b/i,
  /\bprescri(be|ption)\b/i,
];

export function isChiefComplaintExtractionReviewed(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  return meta?.chiefComplaint_extraction_reviewed === true;
}

/**
 * Resolves the clinician-approved English value for one patient-reported field.
 * Arabic translatable fields require a reviewed English translation.
 * English assessments and non-translatable fields use the stored original value.
 */
export function resolveApprovedFieldValue(
  fieldKey: string,
  originalValue: string,
  meta: Record<string, unknown> | null | undefined,
  assessmentLanguage: AssessmentLanguage | null,
): string | null {
  const trimmed = originalValue.trim();
  if (!trimmed) return null;

  if (assessmentLanguage === "ar" && isTranslatablePatientFieldKey(fieldKey)) {
    const translation = readStoredClinicalTranslation(meta, fieldKey);
    if (!translation || !isTranslationReviewed(meta, fieldKey)) {
      return null;
    }
    return translation;
  }

  return trimmed;
}

export function containsForbiddenClinicalClaim(text: string): boolean {
  return FORBIDDEN_FACT_PATTERNS.some((pattern) => pattern.test(text));
}

function collectDraftFieldValues(
  draft: PatientAssessmentDraft,
  includedSections: PatientSectionId[],
): { fieldKey: ApprovedPatientFactKey; value: string }[] {
  const rows: { fieldKey: ApprovedPatientFactKey; value: string }[] = [];

  for (const section of includedSections) {
    for (const entry of buildClinicianReviewEntries(section, draft)) {
      if (!entry.fieldKey || !entry.value.trim()) continue;
      rows.push({ fieldKey: entry.fieldKey as ApprovedPatientFactKey, value: entry.value });
    }
  }

  return rows;
}

/**
 * Builds the Gate 1 approved fact snapshot from structured_data and the patient draft.
 * Does not mutate structured_data.
 */
export function buildApprovedPatientReportFactsSnapshot(
  structuredData: Record<string, unknown>,
  draft: PatientAssessmentDraft,
  includedSections: PatientSectionId[],
  assessmentLanguage: AssessmentLanguage | null,
  approvedAt: string,
): ApprovedPatientReportFacts {
  const facts: Partial<Record<ApprovedPatientFactKey, string>> = {};

  for (const { fieldKey, value } of collectDraftFieldValues(draft, includedSections)) {
    const approved = resolveApprovedFieldValue(fieldKey, value, structuredData, assessmentLanguage);
    if (!approved || containsForbiddenClinicalClaim(approved)) continue;
    facts[fieldKey] = approved;
  }

  const snapshot: ApprovedPatientReportFacts = {
    version: APPROVED_PATIENT_REPORT_FACTS_VERSION,
    approvedAt,
    facts,
  };

  if (isChiefComplaintExtractionReviewed(structuredData)) {
    const extraction = parseStoredExtraction(structuredData.chiefComplaint_extraction);
    if (extraction) {
      snapshot.chiefComplaintExtraction = extraction;
    }
  }

  return snapshot;
}

export function readApprovedPatientReportFacts(
  structuredData: unknown,
): ApprovedPatientReportFacts | null {
  if (typeof structuredData !== "object" || structuredData === null) return null;
  const record = structuredData as Record<string, unknown>;
  const raw = record.approvedPatientReportFacts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== APPROVED_PATIENT_REPORT_FACTS_VERSION) return null;
  if (typeof candidate.approvedAt !== "string" || !candidate.approvedAt.trim()) return null;
  if (!candidate.facts || typeof candidate.facts !== "object" || Array.isArray(candidate.facts)) {
    return null;
  }

  const facts: Partial<Record<ApprovedPatientFactKey, string>> = {};
  for (const [key, value] of Object.entries(candidate.facts as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      facts[key as ApprovedPatientFactKey] = value.trim();
    }
  }

  const result: ApprovedPatientReportFacts = {
    version: APPROVED_PATIENT_REPORT_FACTS_VERSION,
    approvedAt: candidate.approvedAt.trim(),
    facts,
  };

  const extraction = parseStoredExtraction(candidate.chiefComplaintExtraction);
  if (extraction) {
    result.chiefComplaintExtraction = extraction;
  }

  if (candidate.assessmentLanguage === "en" || candidate.assessmentLanguage === "ar") {
    result.assessmentLanguage = candidate.assessmentLanguage;
  }

  return result;
}

/**
 * Gate 1 approved-facts mapping for post_stroke_intake — a parallel path to
 * buildApprovedPatientReportFactsSnapshot (general MSK), reusing the exact
 * same ApprovedPatientReportFacts shape so the rest of the pipeline
 * (generation, Gate 2, print gating) needs no changes for this assessment
 * type. Reuses existing general-purpose fact keys wherever the question is
 * semantically equivalent (chiefComplaint, dailyImpact, activitiesAffected,
 * goals, otherNotes) and adds exactly one new key (onsetOrChange) for the
 * one open-ended question with no existing equivalent.
 *
 * Only ever reads confirmed subjectiveNarrative responses and the
 * functionalIntake.functionalGoal field — never any unconfirmed or
 * client-only temporary text, and never anything from Stage 2 (respondent/
 * urgentGate) since those aren't part of the Subjective Summary.
 */
export function buildApprovedPatientReportFactsSnapshotForPostStrokeIntake(
  structuredData: Record<string, unknown>,
  approvedAt: string,
): ApprovedPatientReportFacts {
  const postStrokeIntake = isRecord(structuredData.postStrokeIntake) ? structuredData.postStrokeIntake : {};
  const facts: Partial<Record<ApprovedPatientFactKey, string>> = {};

  const functionalIntake = isRecord(postStrokeIntake.functionalIntake) ? postStrokeIntake.functionalIntake : {};
  const functionalGoal = functionalIntake.functionalGoal;
  if (typeof functionalGoal === "string" && functionalGoal.trim() && !containsForbiddenClinicalClaim(functionalGoal)) {
    facts.goals = functionalGoal.trim();
  }

  const subjectiveNarrative = isRecord(postStrokeIntake.subjectiveNarrative) ? postStrokeIntake.subjectiveNarrative : {};
  const responses = Array.isArray(subjectiveNarrative.responses) ? subjectiveNarrative.responses : [];
  const questionToFactKey: Record<string, ApprovedPatientFactKey> = {
    mainDifficulty: "chiefComplaint",
    onsetOrChange: "onsetOrChange",
    dailyImpact: "dailyImpact",
    mostDifficultActivities: "activitiesAffected",
    additionalInformation: "otherNotes",
  };

  for (const response of responses) {
    if (!isRecord(response)) continue;
    const questionId = response.questionId;
    const text = response.text;
    if (typeof questionId !== "string" || typeof text !== "string") continue;
    const factKey = questionToFactKey[questionId];
    if (!factKey) continue;
    const trimmed = text.trim();
    if (!trimmed || containsForbiddenClinicalClaim(trimmed)) continue;
    facts[factKey] = trimmed;
  }

  const assessmentLanguage =
    structuredData.assessmentLanguage === "en" || structuredData.assessmentLanguage === "ar"
      ? structuredData.assessmentLanguage
      : null;

  return {
    version: APPROVED_PATIENT_REPORT_FACTS_VERSION,
    approvedAt,
    facts,
    assessmentLanguage,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
