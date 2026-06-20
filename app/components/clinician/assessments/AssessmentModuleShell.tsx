"use client";

import Link from "next/link";
import type { AssessmentModuleShellConfig } from "@/app/lib/clinician/assessment-module-shells";

type Props = {
  config: AssessmentModuleShellConfig;
};

export function AssessmentModuleShell({ config }: Props) {
  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/clinician/assessments"
          className="inline-flex text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
        >
          ← Assessment Center
        </Link>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#1D9E75]">
          {config.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">{config.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">{config.description}</p>

        <div className="mt-5 rounded-[10px] border border-amber-400/20 bg-amber-400/5 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">
            Therapist review required
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{config.safetyDetail}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/clinician/results"
            className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2 text-xs font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
          >
            Open Results queue
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-bold text-white">{config.observationsSectionTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/40">{config.observationsSectionLead}</p>

          <div className="mt-4 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-4 py-8 text-center">
            <p className="text-sm font-medium text-[#9CA3AF]">{config.emptyStateTitle}</p>
            <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">{config.emptyStateBody}</p>
          </div>
        </section>

        <section className="mt-8 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-sm font-bold text-white">Planned observation metrics</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/45">{config.plannedMetricsIntro}</p>

          <dl className="mt-5 space-y-3">
            {config.plannedMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <dt className="text-[11px] font-semibold text-[#F9FAFB]">{metric.label}</dt>
                  <dd className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Planned
                  </dd>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#6B7280]">{metric.note}</p>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-6 rounded-[10px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3.5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/35">
            Review guidance
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-white/45">
            {config.reviewGuidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <p className="mt-8 text-[11px] leading-relaxed text-white/25">{config.footerNote}</p>
      </div>
    </div>
  );
}
