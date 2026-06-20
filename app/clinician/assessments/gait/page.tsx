"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CvReviewSummary } from "@/app/components/clinician/cv/CvReviewSummary";
import {
  GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES,
  isGaitAssessmentExerciseId,
} from "@/app/lib/cv/gait-assessment-exercise-ids";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";

const FETCH_LIMIT = 50;
const DISPLAY_MAX = 10;

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
  const exerciseNameById = useMemo(
    () => ({ ...GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES }),
    [],
  );

  const [metrics, setMetrics] = useState<CvSessionMetricPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/cv/session-metrics?limit=${FETCH_LIMIT}`);
      if (!res.ok) {
        setError(true);
        setMetrics([]);
        return;
      }
      const data = (await res.json()) as { metrics?: CvSessionMetricPublic[] };
      const gaitMetrics = (data.metrics ?? []).filter((row) =>
        isGaitAssessmentExerciseId(row.exerciseId),
      );
      setMetrics(gaitMetrics);
    } catch {
      setError(true);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const hasPatientLinkedSessions = metrics.some((row) => Boolean(row.patientId));
  const showGaitEmptyState = !loading && !error && metrics.length === 0;

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
            to support therapist review. It is not diagnostic, does not classify walking
            patterns, and does not replace clinical examination.
          </p>
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
          <h2 className="text-sm font-bold text-white">Recorded walking observations</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/40">
            Saved assessment movement sessions appear here when gait capture is enabled in a
            future release.
          </p>

          {loading ? (
            <p className="mt-4 text-xs text-[#6B7280]">Loading walking observations…</p>
          ) : error ? (
            <p className="mt-4 text-xs text-rose-300">
              Could not load walking observations. Try again later.
            </p>
          ) : showGaitEmptyState ? (
            <div className="mt-4 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[#9CA3AF]">
                No gait observations have been captured yet
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
                When bounded walking capture is available, saved sessions will appear here for
                therapist review. Live capture is not enabled in this release.
              </p>
            </div>
          ) : (
            <CvReviewSummary
              metrics={metrics}
              exerciseNameById={exerciseNameById}
              loading={false}
              error={false}
              showPatientLinks={hasPatientLinkedSessions}
              maxSessions={DISPLAY_MAX}
            />
          )}
        </section>

        <section className="mt-8 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-sm font-bold text-white">Planned observation metrics</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Structured walking metrics will populate after live capture is enabled. All values
            will remain assistive observations for therapist review only.
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
          Patient portal exercise modules are unchanged. Gait capture will connect to this review
          surface in a future update.
        </p>
      </div>
    </div>
  );
}
