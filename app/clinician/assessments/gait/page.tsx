"use client";

import Link from "next/link";

const PLANNED_GAIT_METRICS = [
  {
    label: "Walking duration",
    note: "Total observed walking time during capture.",
  },
  {
    label: "Movement detected",
    note: "Whether walking movement was observed during the session.",
  },
  {
    label: "Tracking quality",
    note: "Camera and pose tracking reliability for the walking pass.",
  },
  {
    label: "Left/right body visibility",
    note: "Whether both sides remained visible during walking.",
  },
  {
    label: "Pace consistency",
    note: "How steady walking pace appeared across the observed pass.",
  },
  {
    label: "Step/cycle estimate",
    note: "Estimated step or gait-cycle count when tracking confidence is sufficient.",
  },
  {
    label: "Retest recommendation",
    note: "Whether a repeat capture may help therapist review.",
  },
  {
    label: "Therapist review required",
    note: "All gait observations require clinician review before use in care planning.",
  },
] as const;

export default function GaitAssessmentPage() {
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
          RASQ · Gait assessment
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Gait Assessment v1</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
          Camera-assisted walking observation for therapist review. Movement observations
          to support therapist review — not diagnostic gait analysis.
        </p>

        <div className="mt-5 rounded-[10px] border border-amber-400/20 bg-amber-400/5 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">
            Therapist review required
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            This module provides camera-assisted walking observation and movement observations
            to support therapist review. It is not diagnostic, does not classify gait patterns,
            and does not replace clinical examination.
          </p>
        </div>

        <div className="mt-5 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
            Coming next
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Live gait capture and structured walking metrics.
          </p>
        </div>

        <section className="mt-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-sm font-bold text-white">Review workflow shell</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Gait Assessment v1 establishes the clinician review surface. Structured walking
            metrics will populate here after live capture is enabled.
          </p>

          <dl className="mt-5 space-y-3">
            {PLANNED_GAIT_METRICS.map((metric) => (
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
            <li>Use walking observations together with your clinical examination.</li>
            <li>Repeat capture when tracking quality or visibility is limited.</li>
            <li>Do not use this module alone for treatment or progression decisions.</li>
          </ul>
        </section>

        <p className="mt-8 text-[11px] leading-relaxed text-white/25">
          Patient portal and existing CV exercise modules are unchanged in this release. Gait
          capture will connect to this review surface in a future update.
        </p>
      </div>
    </div>
  );
}
