"use client";

import type { MotionAnalysisReport, MotionAnalysisSummaryLabel } from "@/app/lib/cv/motion-analysis-report";

const SUMMARY_BADGE_CLASS: Record<MotionAnalysisSummaryLabel, string> = {
  "Limited visibility": "border-amber-500/35 bg-amber-500/10 text-amber-200",
  "Review suggested": "border-[#EF9F27]/35 bg-[#EF9F27]/10 text-[#EF9F27]",
  "Movement data available": "border-[#1D9E75]/35 bg-[#1D9E75]/12 text-[#5DCAA5]",
  "Session completed": "border-[#1E2D42] bg-[#0F1825] text-[#9CA3AF]",
};

type MotionAnalysisReportPanelProps = {
  report: MotionAnalysisReport;
};

function formatTimelineAt(atSecond: number | null): string | null {
  if (atSecond === null) return null;
  const mm = Math.floor(atSecond / 60);
  const ss = atSecond % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function MotionAnalysisReportPanel({ report }: MotionAnalysisReportPanelProps) {
  const badgeClass = SUMMARY_BADGE_CLASS[report.summaryLabel];

  return (
    <details className="mt-3 rounded-[6px] border border-[#1E2D42] bg-[#070D16] px-3 py-2">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-[#9CA3AF] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>Motion analysis report</span>
          <span
            className={`rounded-[4px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
          >
            {report.summaryLabel}
          </span>
        </span>
      </summary>

      <div className="mt-2 border-t border-[#1E2D42] pt-2">
        <p className="text-[10px] leading-relaxed text-[#6B7280]">
          Structured assistive summary from recorded metrics only. For clinician review — not a
          clinical assessment.
        </p>

        {report.movementTimeline.length > 0 ? (
          <ol className="mt-2 space-y-1.5">
            {report.movementTimeline.map((item, index) => {
              const at = formatTimelineAt(item.atSecond);
              return (
                <li
                  key={`${item.label}-${index}`}
                  className="flex gap-2 text-[11px] leading-snug text-[#D1D5DB]"
                >
                  {at ? (
                    <span
                      className="shrink-0 tabular-nums text-[#6B7280]"
                      style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                    >
                      {at}
                    </span>
                  ) : (
                    <span className="w-[42px] shrink-0 text-[#4B5563]">—</span>
                  )}
                  <span>
                    <span className="font-medium text-[#F9FAFB]">{item.label}</span>
                    {item.detail ? (
                      <span className="text-[#9CA3AF]"> — {item.detail}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-[11px] text-[#6B7280]">Insufficient recorded metrics for a timeline.</p>
        )}
      </div>
    </details>
  );
}
