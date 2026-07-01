import type { AssessmentDetailResponse } from "@/app/api/assessments/[id]/route";
import type { BackendPatient } from "@/app/lib/api";
import type { AssessmentData } from "@/app/lib/assessment-types";
import {
  extractGeneralDraft,
  extractStructuredData,
  getAssessmentLanguage,
} from "@/app/lib/assessment-payload";
import type { GeneralAssessmentDraft } from "@/app/lib/general-assessment/types";
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import {
  extractRemoteQuestionnaireDraft,
  inferIncludedSections,
} from "@/app/lib/remote-questionnaire-summary";

export type AssessmentReportKind = "general_msk" | "remote_questionnaire" | "structured";

export type ResolvedAssessmentReport = {
  kind: AssessmentReportKind | null;
  draft: GeneralAssessmentDraft | null;
  remoteQuestionnaireDraft: PatientAssessmentDraft | null;
  remoteSubmissionMeta: Record<string, unknown> | null;
  remoteIncludedSections: PatientSectionId[];
  structuredData: AssessmentData | null;
  patient: BackendPatient | null;
  resolvedPatientId: string;
  serverNotes: string | null;
  reportDate: string;
  serverBacked: boolean;
  patientAnsweredInArabic: boolean;
  loadError: string;
};

export function resolveAssessmentReportFromDetail(
  detail: AssessmentDetailResponse,
): ResolvedAssessmentReport {
  const base: ResolvedAssessmentReport = {
    kind: null,
    draft: null,
    remoteQuestionnaireDraft: null,
    remoteSubmissionMeta: null,
    remoteIncludedSections: [],
    structuredData: null,
    patient: {
      full_name: detail.patient.full_name,
      diagnosis: detail.patient.diagnosis,
    } as BackendPatient,
    resolvedPatientId: detail.patient_id,
    serverNotes: detail.notes,
    reportDate: detail.created_at,
    serverBacked: true,
    patientAnsweredInArabic: getAssessmentLanguage(detail.structured_data) === "ar",
    loadError: "",
  };

  const general = extractGeneralDraft(detail.structured_data, detail.type);
  if (general) {
    return { ...base, kind: "general_msk", draft: general };
  }

  const remoteDraft = extractRemoteQuestionnaireDraft(detail.structured_data, detail.type);
  if (remoteDraft) {
    return {
      ...base,
      kind: "remote_questionnaire",
      remoteQuestionnaireDraft: remoteDraft,
      remoteSubmissionMeta:
        typeof detail.structured_data === "object" && detail.structured_data !== null
          ? (detail.structured_data as Record<string, unknown>)
          : null,
      remoteIncludedSections: inferIncludedSections(remoteDraft),
    };
  }

  const structured = extractStructuredData(detail.structured_data);
  if (structured) {
    return { ...base, kind: "structured", structuredData: structured };
  }

  return {
    ...base,
    loadError: "Assessment data format is not supported for this report.",
  };
}
