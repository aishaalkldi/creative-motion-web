/**
 * Gate 1 — clinician-approved patient-reported facts for English PT report generation.
 * Builds a compact snapshot from reviewed translations, English originals, and
 * measured patient-reported values only. Never invents missing information.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import type { AssessmentLanguage } from "@/app/lib/assessment-payload";
import { buildClinicianReviewEntries } from "@/app/lib/patient-assessment-questions";
import { parseStoredExtraction } from "@/app/components/clinician/ExtractedFieldsPanel";
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
  | "otherNotes";

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

  return result;
}
