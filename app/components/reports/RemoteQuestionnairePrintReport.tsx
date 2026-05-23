import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import { buildFullClinicianReview } from "@/app/lib/patient-assessment-questions";
import type { RemoteQuestionnaireSummary } from "@/app/lib/remote-questionnaire-summary";
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
}: {
  patientDraft: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
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
            {block.entries.map((entry) => (
              <div key={`${block.section}-${entry.label}`} className="px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {entry.label}
                </dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
                  {entry.value}
                </dd>
              </div>
            ))}
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
};

export function RemoteQuestionnairePrintReport({
  summary,
  patientName,
  patientId,
  assessmentId,
  clinicianNotes,
}: Props) {
  const notes = clinicianNotes?.trim() ?? "";
  const hasSummaryContent =
    summary.metrics.length > 0 || summary.rows.length > 0;
  const hasAnswers = summary.includedSections.length > 0;

  return (
    <ReportPrintLayout
      meta={{
        assessmentTypeLabel: "Remote Questionnaire",
        patientName,
        patientId,
        assessmentId,
        submittedDate: summary.submittedAt,
      }}
    >
      {hasSummaryContent ? (
        <ReportPrintSection title="Clinical Assessment Summary">
          <PrintMetricGrid metrics={summary.metrics} />
          {summary.metrics.length > 0 && summary.rows.length > 0 ? (
            <div className="mt-4" />
          ) : null}
          <PrintFieldRows rows={summary.rows} />
        </ReportPrintSection>
      ) : null}

      {summary.hasRedFlag ? (
        <ReportPrintSection title="Red Flags">
          <div className="rounded border border-amber-400 bg-amber-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-amber-900">
              Patient reported a possible red flag — review before proceeding.
            </p>
          </div>
        </ReportPrintSection>
      ) : null}

      {hasAnswers ? (
        <ReportPrintSection title="Patient Submitted Answers">
          <PrintSubmittedAnswers
            patientDraft={summary.patientDraft}
            includedSections={summary.includedSections}
          />
        </ReportPrintSection>
      ) : null}

      {notes ? (
        <ReportPrintSection title="Clinician Notes">
          <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">{notes}</p>
        </ReportPrintSection>
      ) : null}
    </ReportPrintLayout>
  );
}
