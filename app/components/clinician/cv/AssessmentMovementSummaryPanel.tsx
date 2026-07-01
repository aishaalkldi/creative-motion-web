import type { AssessmentMovementSummary } from "@/app/lib/cv/assessment-movement-summary";

type Props = {
  summary: AssessmentMovementSummary;
};

export function AssessmentMovementSummaryPanel({ summary }: Props) {
  return (
    <details
      open
      className="mt-3 overflow-hidden rounded-[8px] border border-[#1E2D42] bg-[#070D16]"
      style={{ borderWidth: "0.5px" }}
    >
      <summary className="cursor-pointer list-none border-b border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#F9FAFB]">{summary.title}</span>
          <span className="rounded-[4px] border border-[#1E2D42] bg-[#0F1825] px-2 py-0.5 text-[9px] font-medium text-[#9CA3AF]">
            Assessment review
          </span>
        </span>
      </summary>

      <div className="space-y-2.5 px-3 py-2.5">
        <dl className="grid gap-2 sm:grid-cols-2">
          {summary.measuredRows.map((row) => (
            <div
              key={row.label}
              className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-2"
            >
              <dt className="text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">{row.label}</dt>
              <dd className="mt-0.5 text-xs font-semibold text-[#F9FAFB]">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
            Assistive interpretation
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-[#D1D5DB]">
            {summary.interpretationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[6px] border border-[#EF9F27]/25 bg-[#EF9F27]/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#EF9F27]">
            Review prompts
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-[#D1D5DB]">
            {summary.reviewPrompts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] leading-relaxed text-[#6B7280]">{summary.disclaimer}</p>
      </div>
    </details>
  );
}
