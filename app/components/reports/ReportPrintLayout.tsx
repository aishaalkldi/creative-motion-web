import type { ReactNode } from "react";
import { formatReportDateTime } from "@/app/lib/reports/format-report-date";
import {
  CLINICAL_DISCLAIMER_FULL,
  CLINICAL_REPORT_INTRO,
  CLINICAL_REPORT_SUBTITLE,
  CLINICAL_REPORT_TITLE,
} from "@/app/lib/reports/clinical-report-copy";

export type ReportPrintMeta = {
  assessmentTypeLabel: string;
  patientName: string;
  patientId: string;
  assessmentId?: string;
  submittedDate: string;
  generatedDate?: string;
  sourceLabel?: string;
};

function RasqMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
      <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#179165" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.5" fill="#1D9E75" />
    </svg>
  );
}

export function ReportPrintSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <section className="print-document-section print-section">
      <h2 className="print-section-title">{title}</h2>
      <div className="print-section-body">{children}</div>
    </section>
  );
}

export function ReportPrintLayout({
  meta,
  children,
}: {
  meta: ReportPrintMeta;
  children: ReactNode;
}) {
  const generated = meta.generatedDate ?? new Date().toISOString();

  return (
    <div className="print-document">
      <header className="print-report-header">
        <div className="flex items-center gap-3 border-b border-gray-300 pb-3">
          <RasqMark />
          <div>
            <p className="text-base font-bold text-black">RASQ by Creative Motion Lab</p>
            <p className="text-[11px] text-gray-600">{CLINICAL_REPORT_SUBTITLE}</p>
          </div>
        </div>

        <h1 className="mt-4 text-xl font-bold text-black">{CLINICAL_REPORT_TITLE}</h1>
        <p className="mt-1 text-xs text-gray-600">{CLINICAL_REPORT_INTRO}</p>
        <p className="mt-2 text-sm font-semibold text-gray-800">
          Assessment type: {meta.assessmentTypeLabel}
          {meta.sourceLabel ? ` · Source: ${meta.sourceLabel}` : ""}
        </p>

        <dl className="mt-4 grid gap-2 text-sm text-gray-800 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Patient</dt>
            <dd className="mt-0.5 font-semibold text-black">{meta.patientName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Patient ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-gray-800">{meta.patientId}</dd>
          </div>
          {meta.assessmentId ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Reference ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-gray-800">{meta.assessmentId}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Submitted</dt>
            <dd className="mt-0.5 text-gray-800">{formatReportDateTime(meta.submittedDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Report generated</dt>
            <dd className="mt-0.5 text-gray-800">{formatReportDateTime(generated)}</dd>
          </div>
        </dl>
      </header>

      <div className="print-report-body space-y-4">{children}</div>

      <footer className="print-report-footer">
        <p className="text-sm font-semibold text-black">RASQ by Creative Motion Lab</p>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-700">{CLINICAL_DISCLAIMER_FULL}</p>
      </footer>
    </div>
  );
}
