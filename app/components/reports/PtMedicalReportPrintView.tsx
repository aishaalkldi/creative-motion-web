import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  PT_MEDICAL_REPORT_SECTION_KEYS,
  PT_MEDICAL_REPORT_SECTION_LABELS,
  PT_MEDICAL_REPORT_STATUS_LINE,
  type PtMedicalReportApproved,
  type PtMedicalReportDraft,
  type PtMedicalReportSectionKey,
} from "@/app/lib/ai/generate-pt-medical-report";
import { formatReportDateTime } from "@/app/lib/reports/format-report-date";

export const PT_MEDICAL_REPORT_PRINT_FOOTER =
  "Clinician-reviewed patient-reported information. This report does not constitute an automated diagnosis." as const;

export type PtMedicalReportExportBlockReason =
  | "gate1_required"
  | "draft_required"
  | "approval_required"
  | "stale_approval";

export const PT_MEDICAL_REPORT_EXPORT_MESSAGES: Record<PtMedicalReportExportBlockReason, string> = {
  gate1_required: "Patient-reported information must be approved before report generation.",
  draft_required: "Generate the Patient-Reported Subjective Summary before export.",
  approval_required: "Clinician approval is required before print or PDF export.",
  stale_approval: "Clinician approval is required before print or PDF export.",
};

export type PtMedicalReportExportEligibility = {
  exportable: boolean;
  blockReason: PtMedicalReportExportBlockReason | null;
  message: string | null;
  approvedSnapshot: PtMedicalReportApproved | null;
};

export function readGate2ApprovedAt(structuredData: unknown): string | null {
  if (typeof structuredData !== "object" || structuredData === null) return null;
  const value = (structuredData as Record<string, unknown>).gate2ApprovedAt;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Body section keys in stable print order — excludes document title. */
export const PT_MEDICAL_REPORT_PRINT_BODY_SECTION_KEYS: readonly PtMedicalReportSectionKey[] =
  PT_MEDICAL_REPORT_SECTION_KEYS.filter((key) => key !== "title");

export function getApprovedPrintSectionKeys(
  approved: PtMedicalReportApproved,
): PtMedicalReportSectionKey[] {
  return PT_MEDICAL_REPORT_PRINT_BODY_SECTION_KEYS.filter((key) =>
    Boolean(approved.sections[key]?.trim()),
  );
}

export function resolvePtMedicalReportExportEligibility(input: {
  approvedFacts: ApprovedPatientReportFacts | null;
  draft: PtMedicalReportDraft | null;
  approved: PtMedicalReportApproved | null;
  gate2ApprovedAt: string | null;
}): PtMedicalReportExportEligibility {
  if (!input.approvedFacts) {
    return {
      exportable: false,
      blockReason: "gate1_required",
      message: PT_MEDICAL_REPORT_EXPORT_MESSAGES.gate1_required,
      approvedSnapshot: null,
    };
  }

  if (!input.draft) {
    return {
      exportable: false,
      blockReason: "draft_required",
      message: PT_MEDICAL_REPORT_EXPORT_MESSAGES.draft_required,
      approvedSnapshot: null,
    };
  }

  if (!input.approved || !input.gate2ApprovedAt) {
    return {
      exportable: false,
      blockReason: "approval_required",
      message: PT_MEDICAL_REPORT_EXPORT_MESSAGES.approval_required,
      approvedSnapshot: null,
    };
  }

  if (
    input.approved.sourceDraftVersion !== input.draft.version ||
    input.draft.sourceFactsVersion !== input.approvedFacts.version
  ) {
    return {
      exportable: false,
      blockReason: "stale_approval",
      message: PT_MEDICAL_REPORT_EXPORT_MESSAGES.stale_approval,
      approvedSnapshot: null,
    };
  }

  return {
    exportable: true,
    blockReason: null,
    message: null,
    approvedSnapshot: input.approved,
  };
}

export function shouldInvokeApprovedPtMedicalReportPrint(
  eligibility: PtMedicalReportExportEligibility,
): boolean {
  return eligibility.exportable && eligibility.approvedSnapshot !== null;
}

/** Shown when patients.file_number has not been assigned. Never falls back to the patient UUID. */
export const PT_MEDICAL_REPORT_NO_FILE_NUMBER_LABEL = "Not assigned" as const;

/** Shown when patients.age is not recorded. */
export const PT_MEDICAL_REPORT_NO_AGE_LABEL = "Not recorded" as const;

/** Patient reference for print/export — always the clinic-visible file number, never patients.id. */
export function formatPatientReferenceForPrint(fileNumber: string | null | undefined): string {
  const trimmed = fileNumber?.trim();
  return trimmed ? trimmed : PT_MEDICAL_REPORT_NO_FILE_NUMBER_LABEL;
}

export function formatPatientAgeForPrint(age: number | null | undefined): string {
  return typeof age === "number" && Number.isFinite(age) && age > 0
    ? String(age)
    : PT_MEDICAL_REPORT_NO_AGE_LABEL;
}

export type PtMedicalReportPrintViewProps = {
  approved: PtMedicalReportApproved;
  patientName: string;
  /** patients.file_number — never patients.id or assessments.id. */
  patientFileNumber: string | null;
  patientAge: number | null;
  assessmentDate: string;
  sourceLanguage: "Arabic" | "English";
  gate2ApprovedAt: string;
};

export function PtMedicalReportPrintView({
  approved,
  patientName,
  patientFileNumber,
  patientAge,
  assessmentDate,
  sourceLanguage,
  gate2ApprovedAt,
}: PtMedicalReportPrintViewProps) {
  const documentTitle =
    approved.sections.title?.trim() || PT_MEDICAL_REPORT_SECTION_LABELS.title;
  const sectionKeys = getApprovedPrintSectionKeys(approved);

  return (
    <div className="print-document pt-medical-report-print-root">
      <header className="print-report-header border-b border-gray-300 pb-4">
        <p className="text-base font-bold text-black">RASQ by Creative Motion Lab</p>
        <h1 className="mt-3 text-xl font-bold text-black">{documentTitle}</h1>
        <p className="mt-1 text-xs font-semibold text-gray-600">{PT_MEDICAL_REPORT_STATUS_LINE}</p>
        <dl className="mt-4 grid gap-3 text-sm text-gray-800 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Patient reference
            </dt>
            <dd className="mt-0.5 font-semibold text-black">{patientName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Patient file number
            </dt>
            <dd className="mt-0.5 text-gray-800">{formatPatientReferenceForPrint(patientFileNumber)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Patient age
            </dt>
            <dd className="mt-0.5 text-gray-800">{formatPatientAgeForPrint(patientAge)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Assessment date
            </dt>
            <dd className="mt-0.5 text-gray-800">{formatReportDateTime(assessmentDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Source language
            </dt>
            <dd className="mt-0.5 text-gray-800">{sourceLanguage}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Report approval
            </dt>
            <dd className="mt-0.5 text-gray-800">
              Approved for print and PDF · {formatReportDateTime(gate2ApprovedAt)}
            </dd>
          </div>
        </dl>
      </header>

      <div className="print-report-body mt-6 space-y-5">
        {sectionKeys.map((key) => (
          <section key={key} className="print-document-section print-section">
            <h2 className="print-section-title text-sm font-bold uppercase tracking-wide text-gray-800">
              {PT_MEDICAL_REPORT_SECTION_LABELS[key]}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
              {approved.sections[key]}
            </p>
          </section>
        ))}
      </div>

      <footer className="print-report-footer mt-8 border-t border-gray-300 pt-4">
        <p className="text-[11px] leading-relaxed text-gray-700">{PT_MEDICAL_REPORT_PRINT_FOOTER}</p>
      </footer>
    </div>
  );
}
