import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import { buildFullClinicianReview } from "@/app/lib/patient-assessment-questions";
import type { RemoteQuestionnaireSummary } from "@/app/lib/remote-questionnaire-summary";
import type { AssessmentInterpretationDraft } from "@/app/lib/reports/assessment-interpretation-draft";
import { AssessmentInterpretationDraftSection } from "@/app/components/reports/AssessmentInterpretationDraftSection";
import { PtClinicalReportSection } from "@/app/components/reports/PtClinicalReportSection";
import {
  clinicalEnglishLabel,
  ptClinicalReportLabel,
  readClinicalTranslationStatus,
  readEnrichedPtClinicalReportForDisplay,
  readPtClinicalReportStatus,
} from "@/app/lib/reports/remote-questionnaire-workflow";
import { PatientClinicalTranslationDisplay } from "@/app/components/reports/PatientClinicalTranslationDisplay";
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
import {
  isTranslatablePatientFieldKey,
  readStoredClinicalTranslation,
} from "@/app/lib/reports/patient-clinical-translation";
import { ReportPrintLayout, ReportPrintSection } from "./ReportPrintLayout";

function PrintMetricGrid({
  metrics,
}: {
  metrics: {
    label: string;
    value: string;
    originalValue?: string;
    clinicalEnglish?: string;
    translationMissing?: boolean;
  }[];
}) {
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

function PrintTraceabilityAppendix({
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
      <p className="text-[11px] leading-relaxed text-gray-600">
        Appendix — original patient responses and approved Clinical English for traceability.
      </p>
      {blocks.map((block) => (
        <div key={block.section} className="print-document-section border border-gray-200">
          <h3 className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700">
            {block.sectionTitle}
          </h3>
          <dl className="divide-y divide-gray-200">
            {block.entries.map((entry) => {
              const fieldKey = entry.fieldKey;
              const showBilingual =
                assessmentLanguage === "ar" && isTranslatablePatientFieldKey(fieldKey);
              const clinicalEnglish = showBilingual && fieldKey
                ? readStoredClinicalTranslation(submissionMeta, fieldKey)
                : "";

              return (
                <div key={`${block.section}-${entry.label}`} className="px-3 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {patientReportedLabel(entry.label)}
                  </dt>
                  <dd className="mt-0.5">
                    {showBilingual ? (
                      <PatientClinicalTranslationDisplay
                        originalText={entry.value}
                        clinicalEnglish={clinicalEnglish}
                        variant="print"
                        showDisclaimer={false}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
                        {entry.value}
                      </p>
                    )}
                  </dd>
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
  interpretationDraft: AssessmentInterpretationDraft;
  patientName: string;
  patientId: string;
  assessmentId?: string;
  clinicianNotes?: string | null;
  submissionMeta?: Record<string, unknown> | null;
  assessmentLanguage?: "en" | "ar" | null;
};

export function RemoteQuestionnairePrintReport({
  summary,
  interpretationDraft,
  patientName,
  patientId,
  assessmentId,
  clinicianNotes,
  submissionMeta = null,
  assessmentLanguage = null,
}: Props) {
  const notes = clinicianNotes?.trim() ?? "";
  const ptReport = readEnrichedPtClinicalReportForDisplay(
    submissionMeta,
    summary.patientDraft,
    summary.includedSections,
  );
  const reportStatus = readPtClinicalReportStatus(submissionMeta);
  const translationStatus = readClinicalTranslationStatus(submissionMeta);
  const hasAnswers = summary.includedSections.length > 0;
  const usePolishedLayout = Boolean(ptReport);

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
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Patient</dt>
            <dd className="text-sm font-semibold text-gray-900">{patientName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Assessment date</dt>
            <dd className="text-sm text-gray-900">{summary.submittedAt}</dd>
          </div>
          {assessmentLanguage ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Original language</dt>
              <dd className="text-sm text-gray-900">{assessmentLanguage === "ar" ? "Arabic" : "English"}</dd>
            </div>
          ) : null}
          {assessmentLanguage === "ar" ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Clinical English</dt>
              <dd className="text-sm text-gray-900">{clinicalEnglishLabel(translationStatus)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">PT Clinical Report</dt>
            <dd className="text-sm text-gray-900">{ptClinicalReportLabel(reportStatus)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <PrintMetricGrid
            metrics={summary.metrics.filter((metric) => metric.label !== "Body region" || !usePolishedLayout)}
          />
        </div>
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

      {usePolishedLayout && ptReport ? (
        <ReportPrintSection title="PT Clinical Report">
          <PtClinicalReportSection
            report={ptReport}
            variant="print"
            showSectionLetters
            condensed
            finalized={reportStatus === "finalized"}
          />
        </ReportPrintSection>
      ) : (
        <>
          {hasAnswers ? (
            <ReportPrintSection title={SECTION_PATIENT_REPORTED_SUMMARY}>
              <PrintTraceabilityAppendix
                patientDraft={summary.patientDraft}
                includedSections={summary.includedSections}
                submissionMeta={submissionMeta}
                assessmentLanguage={assessmentLanguage}
              />
            </ReportPrintSection>
          ) : null}
          <AssessmentInterpretationDraftSection draft={interpretationDraft} variant="print" />
        </>
      )}

      {notes ? (
        <ReportPrintSection title="Therapist-entered clinical note">
          <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">{notes}</p>
        </ReportPrintSection>
      ) : null}

      {usePolishedLayout && hasAnswers ? (
        <ReportPrintSection title={`Appendix: ${SECTION_PATIENT_REPORTED_SUMMARY}`}>
          <p className="mb-3 text-[11px] leading-relaxed text-gray-600">
            Traceability appendix — original patient responses and approved Clinical English. Not part of the main clinical report.
          </p>
          <PrintTraceabilityAppendix
            patientDraft={summary.patientDraft}
            includedSections={summary.includedSections}
            submissionMeta={submissionMeta}
            assessmentLanguage={assessmentLanguage}
          />
        </ReportPrintSection>
      ) : null}

      <section className="print-document-section">
        <p className="rounded border border-gray-300 bg-gray-50 px-3 py-2.5 text-[11px] leading-relaxed text-gray-700">
          {usePolishedLayout && ptReport
            ? ptReport.disclaimer
            : CLINICAL_DISCLAIMER_FULL}
        </p>
      </section>
    </ReportPrintLayout>
  );
}

