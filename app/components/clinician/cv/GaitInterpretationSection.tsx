"use client";

import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import {
  buildGaitAssistiveInterpretation,
  type GaitAssistiveInterpretation,
} from "@/app/lib/cv/gait-interpretation";

type Props = {
  metric: CvSessionMetricPublic;
};

function FindingList({ findings }: { findings: GaitAssistiveInterpretation["measuredFindings"] }) {
  return (
    <dl className="mt-2 space-y-2">
      {findings.map((finding) => (
        <div
          key={finding.label}
          className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <dt className="text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">{finding.label}</dt>
          <dd className="text-xs text-[#F9FAFB] sm:text-right">{finding.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GaitInterpretationSection({ metric }: Props) {
  const interpretation = buildGaitAssistiveInterpretation(metric);
  if (!interpretation) return null;

  const hasAssistiveLines = interpretation.interpretationLines.length > 0;

  return (
    <section className="mt-4 rounded-[8px] border border-[#1E2D42] bg-[#0F1825] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#5DCAA5]">
          AI-assisted gait interpretation
        </h3>
        <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
          For therapist review
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Measured findings
        </p>
        <FindingList findings={interpretation.measuredFindings} />
      </div>

      {hasAssistiveLines ? (
        <>
          <div className="mt-4 border-t border-[#1E2D42] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#EF9F27]">
              Assistive interpretation
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/75">
              {interpretation.interpretationLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {interpretation.reviewPrompts.length > 0 ? (
            <div className="mt-4 border-t border-[#1E2D42] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Suggested review focus
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-white/65">
                {interpretation.reviewPrompts.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-white/35">{interpretation.disclaimer}</p>
    </section>
  );
}
