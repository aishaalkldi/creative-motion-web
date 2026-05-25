import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import { buildFullClinicianReview } from "@/app/lib/patient-assessment-questions";
import type { RemoteQuestionnaireSummary } from "@/app/lib/remote-questionnaire-summary";
import {
  CLINICAL_DISCLAIMER_FULL,
  patientReportedLabel,
  RED_FLAG_PATIENT_REPORTED,
  SAFETY_NONE_DOCUMENTED,
  SAFETY_REVIEW_REQUIRED,
  SECTION_OVERVIEW,
  SECTION_PATIENT_REPORTED_SUMMARY,
  SECTION_SAFETY_INDICATORS,
} from "@/app/lib/reports/clinical-report-copy";
import { ReportPrintLayout, ReportPrintSection } from "./ReportPrintLayout";

function PrintFieldRows({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="divide-y divide-gray-200 border border-gray-200">
      {rows.map((row) => (
        <div key={row.label} className="px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{row.label}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrintMetricGrid({ metrics }: { metrics: { label: string; value: string }[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{metric.label}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function PrintSubmittedAnswers({
  patientDraft,
  includedSections,
  submissionMeta,
  assessmentLanguage,
}: {
  patientDraft: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
  submissionMeta?: Record<string, unknown> | null;
  assessmentLanguage?: "en" | "ar" | null;
}) {
  const blocks = buildFullClinicianReview(patientDraft, includedSections);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.section} className="print-document-section border border-gray-200">
          <h3 className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">
            {block.sectionTitle}
          </h3>
          <dl className="divide-y divide-gray-200">
            {block.entries.map((entry) => {
              const fieldKey = entry.fieldKey;
              const translation =
                assessmentLanguage === "ar" &&
                fieldKey &&
                fieldKey !== "painScore" &&
                typeof submissionMeta?.[`${fieldKey}_en`] === "string"
                  ? (submissionMeta[`${fieldKey}_en`] as string).trim()
                  : "";

              return (
                <div key={`${block.section}-${entry.label}`} className="px-3 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {patientReportedLabel(entry.label)}
                  </dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap" dir="rtl">
                    {entry.value}
                  </dd>
                  {translation ? (
                    <div className="mt-2 rounded border-l-2 border-[#1D9E75] bg-[#F0FAF6] px-3 py-2">
                      <p className="text-[10px] italic text-gray-500">
                        Translation for clinician review — verify before clinical use
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[#0D6B4F] whitespace-pre-wrap">
                        {translation}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

type Props = {
  summary: RemoteQuestionnaireSummary;
  patientName: string;
  patientId: string;
  assessmentId?: string;
  clinicianNotes?: string | null;
  submissionMeta?: Record<string, unknown> | null;
  assessmentLanguage?: "en" | "ar" | null;
};

export function RemoteQuestionnairePrintReport({
  summary,
  patientName,
  patientId,
  assessmentId,
  clinicianNotes,
  submissionMeta = null,
  assessmentLanguage = null,
}: Props) {
  const notes = clinicianNotes?.trim() ?? "";
  const hasSummaryContent =
    summary.metrics.length > 0 || summary.rows.length > 0;
  const hasAnswers = summary.includedSections.length > 0;

  return (
    <ReportPrintLayout
      meta={{
        assessmentTypeLabel: "Remote questionnaire",
        sourceLabel: "Patient-reported",
        patientName,
        patientId,
        assessmentId,
        submittedDate: summary.submittedAt,
      }}
    >
      <ReportPrintSection title={SECTION_OVERVIEW}>
        <PrintMetricGrid metrics={summary.metrics} />
        {hasSummaryContent ? <PrintFieldRows rows={summary.rows} /> : null}
      </ReportPrintSection>

      <ReportPrintSection title={SECTION_SAFETY_INDICATORS}>
        {summary.hasRedFlag ? (
          <div className="rounded border border-amber-400 bg-amber-50 px-3 py-2.5 space-y-2">
            <p className="text-sm font-semibold text-amber-900">{RED_FLAG_PATIENT_REPORTED}</p>
            <p className="text-sm text-amber-900">{SAFETY_REVIEW_REQUIRED}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-800">{SAFETY_NONE_DOCUMENTED}</p>
        )}
      </ReportPrintSection>

      {hasAnswers ? (
        <ReportPrintSection title={SECTION_PATIENT_REPORTED_SUMMARY}>
          <PrintSubmittedAnswers
            patientDraft={summary.patientDraft}
            includedSections={summary.includedSections}
            submissionMeta={submissionMeta}
            assessmentLanguage={assessmentLanguage}
          />
        </ReportPrintSection>
      ) : null}

      {notes ? (
        <ReportPrintSection title="Therapist-entered clinical note">
          <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">{notes}</p>
        </ReportPrintSection>
      ) : null}

      <section className="print-document-section">
        <p className="rounded border border-gray-300 bg-gray-50 px-3 py-2.5 text-[11px] leading-relaxed text-gray-700">
          {CLINICAL_DISCLAIMER_FULL}
        </p>
      </section>
    </ReportPrintLayout>
  );
}
