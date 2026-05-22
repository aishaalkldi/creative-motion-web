/**
 * Unified assessments.structured_data shapes (no DB migration).
 */
import type { AssessmentData } from "./assessment-types";
import type { GeneralAssessmentDraft } from "./general-assessment/types";

export const GENERAL_MSK_SCHEMA_VERSION = 2 as const;

export type AssessmentLanguage = "en" | "ar";

export type GeneralMskPayload = {
  schemaVersion: typeof GENERAL_MSK_SCHEMA_VERSION;
  kind: "general_msk";
  draft: GeneralAssessmentDraft;
  /** Language the patient used when completing a remote assessment, if applicable */
  assessmentLanguage?: AssessmentLanguage;
};

export type StoredAssessmentPayload = AssessmentData | GeneralMskPayload;

export function isGeneralMskPayload(data: unknown): data is GeneralMskPayload {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  return (
    o.kind === "general_msk" &&
    o.schemaVersion === GENERAL_MSK_SCHEMA_VERSION &&
    typeof o.draft === "object" &&
    o.draft !== null
  );
}

export function isStructuredAssessmentData(data: unknown): data is AssessmentData {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  return typeof o.bodyRegion === "string" && o.kind !== "general_msk";
}

export function buildGeneralMskPayload(
  draft: GeneralAssessmentDraft,
  assessmentLanguage?: AssessmentLanguage,
): GeneralMskPayload {
  return {
    schemaVersion: GENERAL_MSK_SCHEMA_VERSION,
    kind: "general_msk",
    draft: {
      ...draft,
      updatedAt: draft.updatedAt?.trim() || new Date().toISOString(),
    },
    ...(assessmentLanguage ? { assessmentLanguage } : {}),
  };
}

export function getAssessmentLanguage(structuredData: unknown): AssessmentLanguage | null {
  if (typeof structuredData !== "object" || structuredData === null) return null;
  const lang = (structuredData as Record<string, unknown>).assessmentLanguage;
  return lang === "ar" || lang === "en" ? lang : null;
}

/** Resolve GeneralAssessmentDraft from a stored row. */
export function extractGeneralDraft(
  structuredData: unknown,
  type: string,
): GeneralAssessmentDraft | null {
  if (type === "general_msk" && isGeneralMskPayload(structuredData)) {
    return structuredData.draft;
  }
  return null;
}

export function extractStructuredData(structuredData: unknown): AssessmentData | null {
  if (isStructuredAssessmentData(structuredData)) {
    return structuredData;
  }
  return null;
}
