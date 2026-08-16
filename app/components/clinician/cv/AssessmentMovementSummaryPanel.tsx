import type { AssessmentMovementSummary } from "@/app/lib/cv/assessment-movement-summary";
import { THERAPIST_REVIEW_BANNER } from "@/app/lib/reports/clinical-report-copy";

type Props = {
  summary: AssessmentMovementSummary;
};

export function AssessmentMovementSummaryPanel({ summary }: Props) {
  return (
    <details
      open
      className="mt-3 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)]"
      style={{ borderWidth: "0.5px" }}
    >
      <summary className="cursor-pointer list-none border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--foreground)]">{summary.title}</span>
          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[9px] font-medium text-[var(--muted)]">
            Assessment review
          </span>
        </span>
      </summary>

      <div className="space-y-2.5 px-3 py-2.5">
        <p className="rounded-[6px] border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-relaxed text-amber-100/95">
          {THERAPIST_REVIEW_BANNER}
        </p>

        <dl className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {summary.measuredRows.map((row) => (
            <div
              key={row.label}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2"
            >
              <dt className="text-[10px] uppercase tracking-[0.06em] text-[var(--muted)]">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
            Assistive interpretation
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
            {summary.interpretationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[6px] border border-amber-400/25 bg-amber-400/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-400">
            Review prompts
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
            {summary.reviewPrompts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] leading-relaxed text-[var(--muted)]">{summary.disclaimer}</p>
      </div>
    </details>
  );
}
