"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDashboardStats, type DashboardStats } from "@/app/lib/api";

// ── Static data ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { title: "Add Patient",          description: "Create a new patient file",              href: "/clinician/patients/new" },
  { title: "Start Assessment",     description: "In-clinic or remote patient link",       href: "/clinician/assessment/start" },
  { title: "Review Results",       description: "Assessment queue and rehab progress",    href: "/clinician/results" },
  { title: "Build Plan",           description: "Assign a rehabilitation programme",      href: "/clinician/plans/new" },
  { title: "Patient List",         description: "Open any patient chart",                 href: "/clinician/patients" },
  { title: "Generate Remote Link", description: "Send a remote assessment request",     href: "/clinician/request" },
];

const WORKFLOW_STEPS = [
  { title: "1. Add Patient",          description: "Create a patient file from the clinician portal.",           href: "/clinician/patients/new" },
  { title: "2. Open Patient Profile", description: "Review details, send a remote link, or start in clinic.",   href: "/clinician/patients" },
  { title: "3. Start Assessment",     description: "Patient completes remotely or you document in clinic.",      href: "/clinician/assessment/start" },
  { title: "4. Review Report",        description: "Open the assessment summary and clinician notes.",           href: "/clinician/results" },
  { title: "5. Assign Plan",          description: "Build and assign a structured rehabilitation plan.",         href: "/clinician/plans/new" },
  { title: "6. Patient Portal",       description: "Patient completes home sessions and reports effort/pain.",   href: "/clinician/patients" },
  { title: "7. Track Progress",       description: "Review adherence, flags, and the review queue.",             href: "/clinician/results" },
];

// ── Components ─────────────────────────────────────────────────────────────────

function MetricCard({ title, value, subtitle, attention = false }: {
  title: string; value: string; subtitle: string; attention?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/35">{title}</p>
      <p className={`mt-3 font-mono text-3xl font-bold ${attention ? "text-amber-300" : "text-[#5DCAA5]"}`}
         style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-white/35">{subtitle}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function formatMetric(value: number | null | undefined, loading: boolean): string {
  if (loading) return "…";
  if (value === null || value === undefined) return "–";
  return String(value);
}

function formatStatsTime(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

export default function ClinicianDashboardPage() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const metricCards = [
    { title: "Total Patients",              value: formatMetric(stats?.totalPatients, loading),              subtitle: "Connected patient records",           attention: false },
    { title: "Active Cases",                value: formatMetric(stats?.activeCases, loading),                subtitle: "Currently active patients",           attention: false },
    { title: "Pending Reviews",             value: formatMetric(stats?.pendingReviews, loading),             subtitle: "Awaiting clinician review",           attention: true  },
    { title: "Remote Assessments Pending",  value: formatMetric(stats?.remoteAssessmentsPending, loading), subtitle: "Patient links not yet completed",     attention: false },
  ];

  const statsUpdatedAt = formatStatsTime(stats?.generatedAt);

  const activityQueue =
    !loading && stats
      ? [
          stats.pendingReviews === null
            ? "Review queue unavailable"
            : stats.pendingReviews === 0
              ? "No pending reviews"
              : `${stats.pendingReviews} patient${stats.pendingReviews > 1 ? "s" : ""} awaiting review`,
          stats.remoteAssessmentsPending === null
            ? "Remote assessment count unavailable"
            : stats.remoteAssessmentsPending === 0
              ? "No remote assessments pending"
              : `${stats.remoteAssessmentsPending} remote assessment${stats.remoteAssessmentsPending > 1 ? "s" : ""} pending`,
          stats.pendingReviews != null && stats.pendingReviews > 0
            ? "Open Results to review flagged patients"
            : "Review queue is clear",
        ]
      : ["Loading activity…", "Loading activity…", "Loading activity…"];

  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Provider workspace</p>
            <h1 className="mt-1.5 text-2xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-white/40">
              Manage patients, assessments, and rehabilitation plans from one place.
            </p>
            {!loading && statsUpdatedAt && (
              <p className="mt-1 text-[11px] text-white/25">
                Data updated: {statsUpdatedAt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/clinician/patients/new" className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]">
              + Add Patient
            </Link>
            <Link href="/clinician/results" className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:border-[#1D9E75]/25 hover:text-white">
              Review Results
            </Link>
            <Link href="/clinician/assessment/start" className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:border-[#1D9E75]/25 hover:text-white">
              Start Assessment
            </Link>
          </div>
        </div>

        {/* ── Clinical pathway hint ── */}
        <div className="mb-6 rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-5 py-3.5 text-sm text-white/40">
          <span className="font-semibold text-white/65">Clinical pathway:</span>{" "}
          Patient →{" "}
          <Link href="/clinician/assessment/start" className="text-[#5DCAA5] hover:text-[#1D9E75]">Assessment</Link>{" "}
          →{" "}
          <Link href="/clinician/results" className="text-[#5DCAA5] hover:text-[#1D9E75]">Results</Link>{" "}
          →{" "}
          <Link href="/clinician/plans/new" className="text-[#5DCAA5] hover:text-[#1D9E75]">Assign Plan</Link>{" "}
          →{" "}
          <Link href="/clinician/patients" className="text-[#5DCAA5] hover:text-[#1D9E75]">Patient Portal</Link>{" "}
          →{" "}
          <Link href="/clinician/results" className="text-[#5DCAA5] hover:text-[#1D9E75]">Progress</Link>
        </div>

        {/* ── Metric cards ── */}
        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((c) => (
            <MetricCard key={c.title} title={c.title} value={c.value} subtitle={c.subtitle} attention={c.attention} />
          ))}
        </section>

        {/* ── Main columns ── */}
        <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">

          {/* Quick actions + activity */}
          <div className="space-y-5">
            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-base font-bold text-white">Quick Actions</h2>
              <p className="mt-1 text-sm text-white/35">Common tasks to keep your workflow moving.</p>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4 transition hover:border-[#1D9E75]/25 hover:bg-[#0d1f18]"
                  >
                    <p className="text-sm font-semibold text-white group-hover:text-[#5DCAA5]">{action.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/35">{action.description}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-base font-bold text-white">Clinical Activity</h2>
              <p className="mt-1 text-sm text-white/35">Pending review and follow-up queue.</p>
              <div className="mt-4 space-y-2">
                {activityQueue.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-sm text-white/50">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E2D42]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow map */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
            <h2 className="text-base font-bold text-white">Workflow Map</h2>
            <p className="mt-1 text-sm text-white/35">Recommended clinical sequence from intake to outcome.</p>

            <div className="mt-4 space-y-2">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step.title} className="flex gap-3">
                  {/* Step number */}
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1E2D42] bg-[#0B1220] text-[11px] font-bold text-[#5DCAA5]/60">
                      {i + 1}
                    </span>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-[#1E2D42]" />
                    )}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-sm font-semibold text-white">{step.title.replace(/^\d+\. /, "")}</p>
                    <p className="mt-0.5 text-xs leading-5 text-white/35">{step.description}</p>
                    {step.href && (
                      <Link href={step.href} className="mt-1 inline-block text-xs font-semibold text-[#5DCAA5] hover:text-[#1D9E75]">
                        Open →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
