/**

 * Clinician-controlled remote questionnaire workflow helpers.

 * Original patient text is never overwritten; _en fields and PT report are stored separately.

 */

import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";

import { getAssessmentLanguage } from "@/app/lib/assessment-payload";

import { collectTranslatableDraftFields } from "@/app/lib/reports/batch-translate-remote-questionnaire";

import {

  extractTranslationMeta,

  isTranslatablePatientFieldKey,

  readStoredClinicalTranslation,

} from "@/app/lib/reports/patient-clinical-translation";

import { isPatientAssessmentDraft } from "@/app/lib/remote-questionnaire-summary";

import type { PtClinicalReportDraft } from "./pt-clinical-report-draft";



export type ClinicalTranslationStatus =

  | "not_generated"

  | "not_required"

  | "review_required"

  | "partial"

  | "failed"

  | "approved";



/** Legacy stored value — treated as review_required until approved. */

const LEGACY_COMPLETE_STATUS = "complete";



export type PtClinicalReportStatus =

  | "not_generated"

  | "draft_ready"

  | "failed"

  | "finalized";



export type RemoteQuestionnaireWorkflowStep =

  | "submitted"

  | "clinical_english_pending"

  | "translation_review"

  | "translation_approved"

  | "report_draft"

  | "report_finalized";



export function normalizeClinicalTranslationStatus(

  structuredData: Record<string, unknown> | null | undefined,

): ClinicalTranslationStatus {

  const raw = structuredData?.clinical_translation_status;

  if (raw === LEGACY_COMPLETE_STATUS) return "review_required";

  if (

    raw === "not_generated" ||

    raw === "not_required" ||

    raw === "review_required" ||

    raw === "partial" ||

    raw === "failed" ||

    raw === "approved"

  ) {

    return raw;

  }

  if (getAssessmentLanguage(structuredData ?? {}) === "en") return "not_required";

  return "not_generated";

}



export function readClinicalTranslationStatus(

  structuredData: Record<string, unknown> | null | undefined,

): ClinicalTranslationStatus {

  return normalizeClinicalTranslationStatus(structuredData);

}



export function readPtClinicalReportStatus(

  structuredData: Record<string, unknown> | null | undefined,

): PtClinicalReportStatus {

  const raw = structuredData?.pt_clinical_report_status;

  if (

    raw === "not_generated" ||

    raw === "draft_ready" ||

    raw === "failed" ||

    raw === "finalized"

  ) {

    return raw;

  }

  if (structuredData?.pt_clinical_report_final) return "finalized";

  return structuredData?.pt_clinical_report_draft ? "draft_ready" : "not_generated";

}



export function readPtClinicalReportDraft(

  structuredData: Record<string, unknown> | null | undefined,

): PtClinicalReportDraft | null {

  const draft = structuredData?.pt_clinical_report_draft;

  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;

  return draft as PtClinicalReportDraft;

}



export function readPtClinicalReportFinal(

  structuredData: Record<string, unknown> | null | undefined,

): PtClinicalReportDraft | null {

  const final = structuredData?.pt_clinical_report_final;

  if (!final || typeof final !== "object" || Array.isArray(final)) return null;

  return final as PtClinicalReportDraft;

}



export function readPtClinicalReportForDisplay(

  structuredData: Record<string, unknown> | null | undefined,

): PtClinicalReportDraft | null {

  return readPtClinicalReportFinal(structuredData) ?? readPtClinicalReportDraft(structuredData);

}



export function isClinicalTranslationApproved(structuredData: Record<string, unknown>): boolean {

  if (getAssessmentLanguage(structuredData) === "en") return true;

  return (
    structuredData.clinical_translation_reviewed === true &&
    structuredData.clinical_translation_status === "approved"
  );

}



export function hasAllClinicalEnglishFields(

  structuredData: Record<string, unknown>,

  draft: PatientAssessmentDraft,

): boolean {

  const status = readClinicalTranslationStatus(structuredData);

  if (status === "not_required") return true;

  const fields = collectTranslatableDraftFields(draft);

  if (fields.length === 0) return true;

  return fields.every(({ fieldKey }) => readStoredClinicalTranslation(structuredData, fieldKey).length > 0);

}



export function canGeneratePtClinicalReport(

  structuredData: Record<string, unknown>,

  draft: PatientAssessmentDraft,

): boolean {

  if (!isClinicalTranslationApproved(structuredData)) return false;

  return hasAllClinicalEnglishFields(structuredData, draft);

}



/** @deprecated Use canGeneratePtClinicalReport — kept for test migration. */

export function hasClinicalEnglishForPtReport(

  structuredData: Record<string, unknown>,

  draft: PatientAssessmentDraft,

): boolean {

  return canGeneratePtClinicalReport(structuredData, draft);

}



export function resolveRemoteQuestionnaireWorkflowStep(

  structuredData: Record<string, unknown>,

  draft: PatientAssessmentDraft,

): RemoteQuestionnaireWorkflowStep {

  const reportStatus = readPtClinicalReportStatus(structuredData);

  if (reportStatus === "finalized") return "report_finalized";

  if (reportStatus === "draft_ready" || structuredData.pt_clinical_report_draft) {

    return "report_draft";

  }



  const translationStatus = readClinicalTranslationStatus(structuredData);

  if (translationStatus === "not_required" || isClinicalTranslationApproved(structuredData)) {

    return "translation_approved";

  }

  if (

    translationStatus === "review_required" ||

    translationStatus === "partial" ||

    translationStatus === "failed"

  ) {

    return "translation_review";

  }

  if (translationStatus === "not_generated") {

    return getAssessmentLanguage(structuredData) === "ar"

      ? "clinical_english_pending"

      : "translation_approved";

  }

  return "submitted";

}



export function invalidatePtReportOnTranslationChange(

  structuredData: Record<string, unknown>,

): Record<string, unknown> {

  const next = { ...structuredData };

  next.clinical_translation_reviewed = false;

  delete next.clinical_translation_reviewed_at;

  delete next.clinical_translation_approved_at;

  const status = normalizeClinicalTranslationStatus(structuredData);

  if (status === "approved") {

    next.clinical_translation_status = "review_required";

  }

  delete next.pt_clinical_report_draft;

  delete next.pt_clinical_report_final;

  delete next.pt_clinical_report_generated_at;

  delete next.pt_clinical_report_finalized_at;

  delete next.pt_clinical_report_edited_at;

  next.pt_clinical_report_status = "not_generated";

  return next;

}



export function clinicalEnglishLabel(status: ClinicalTranslationStatus): string {

  switch (status) {

    case "not_generated":

      return "Not Generated";

    case "not_required":

      return "Not required (English submission)";

    case "review_required":

      return "Generated — Review Required";

    case "partial":

      return "Partially generated — Review Required";

    case "failed":

      return "Generation failed";

    case "approved":

      return "Approved";

  }

}



export function ptClinicalReportLabel(status: PtClinicalReportStatus): string {

  switch (status) {

    case "not_generated":

      return "Not Generated";

    case "draft_ready":

      return "Draft — Therapist Review Required";

    case "failed":

      return "Generation failed";

    case "finalized":

      return "Finalized";

  }

}



export function readClinicalFieldForReport(

  structuredData: Record<string, unknown>,

  fieldKey: string,

  original: string | undefined,

): string {

  if (!isTranslatablePatientFieldKey(fieldKey)) {

    return original?.trim() ?? "";

  }

  const language = getAssessmentLanguage(structuredData);

  if (language === "en") return original?.trim() ?? "";

  return readStoredClinicalTranslation(structuredData, fieldKey);

}



export function assertPatientAssessmentDraft(

  structuredData: unknown,

): PatientAssessmentDraft | null {

  if (!isPatientAssessmentDraft(structuredData)) return null;

  return structuredData;

}



export function countStoredTranslations(structuredData: Record<string, unknown>): number {

  return Object.keys(extractTranslationMeta(structuredData).translations).length;

}



/** Patient submit persistence — original answers only; no automatic translation. */

export function prepareRemoteQuestionnaireSubmission(

  structuredData: Record<string, unknown>,

): Record<string, unknown> {

  return {

    ...structuredData,

    clinical_translation_status:

      getAssessmentLanguage(structuredData) === "ar" ? "not_generated" : "not_required",

    pt_clinical_report_status: "not_generated",

  };

}


