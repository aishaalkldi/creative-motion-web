"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import { PilotChecklistCard } from "@/app/components/clinician/PilotChecklistCard";
import { DemoOfflineBanner } from "@/app/components/clinician/DemoOfflineBanner";
import { getDashboardStats, type DashboardStats } from "@/app/lib/api";
import {
  mergeDemoMeta,
  parsePatientsList,
  type PatientsListPayload,
} from "@/app/lib/api/demo-fallback-client";
import {
  buildPilotAttentionQueue,
  type PilotAttentionItem,
  type PilotAttentionPriority,
} from "@/app/lib/clinician/pilot-attention-queue";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

// ── Static data ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { title: "Add Patient",          description: "Create a new patient file",              href: "/clinician/patients/new" },
  { title: "Assessment Center",    description: "Plan and review movement assessments.",  href: "/clinician/assessments" },
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

function priorityBadgeClass(priority: PilotAttentionPriority): string {
  if (priority === "high") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (priority === "medium") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-[#1E2D42] bg-[#0B1220] text-white/45";
}

function PilotAttentionQueueRow({ item }: { item: PilotAttentionItem }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">{item.patientName}</p>
          <span
            className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityBadgeClass(item.priority)}`}
          >
            {item.priority}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/45">{item.reason}</p>
      </div>
      <Link
        href={item.href}
        className="shrink-0 rounded-[6px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
      >
        {item.actionLabel}
      </Link>
    </div>
  );
}

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

function formatSnapshotMetric(value: number | null | undefined, loading: boolean): string {
  if (loading) return "…";
  if (value === null || value === undefined) return "Not available";
  return String(value);
}

function formatGeneratedAt(iso: string | undefined, loading: boolean): string {
  if (loading) return "…";
  if (!iso) return "Not available";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "Not available";
  }
}

function buildPilotSummaryText(stats: DashboardStats | null, loading: boolean): string | null {
  if (loading || !stats) return null;
  return [
    "RASQ Pilot Snapshot",
    `Patients created: ${formatSnapshotMetric(stats.totalPatients, false)}`,
    `Active rehabilitation plans: ${formatSnapshotMetric(stats.activeCases, false)}`,
    `Unreviewed review flags: ${formatSnapshotMetric(stats.pendingReviews, false)}`,
    `Pending assessment links: ${formatSnapshotMetric(stats.remoteAssessmentsPending, false)}`,
    `Generated: ${formatGeneratedAt(stats.generatedAt, false)}`,
  ].join("\n");
}

export default function ClinicianDashboardPage() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [results, setResults] = useState<ClinicianResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "unavailable">("idle");
  const [demoMode, setDemoMode] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    Promise.all([
      getDashboardStats().catch(() => null),
      fetch("/api/patients")
        .then(async (res) => {
          const json = (await res.json()) as PatientsListPayload;
          if (!res.ok && !Array.isArray(json) && !("patients" in json)) {
            return { patients: [] as PatientRow[], demoMode: false, demoNotice: null };
          }
          return parsePatientsList(json);
        })
        .catch(() => ({ patients: [] as PatientRow[], demoMode: false, demoNotice: null })),
      fetch("/api/clinician/results")
        .then(async (res) =>
          res.ok ? (res.json() as Promise<ClinicianResultsResponse>) : null,
        )
        .catch(() => null),
    ])
      .then(([statsData, patientsPayload, resultsData]) => {
        if (!isMounted) return;
        setStats(statsData);
        setPatients(patientsPayload.patients);
        setResults(resultsData);
        let meta = mergeDemoMeta(
          { demoMode: false, demoNotice: null },
          patientsPayload,
        );
        if (statsData?.demoMode) {
          meta = mergeDemoMeta(meta, {
            demoMode: true,
            demoNotice: statsData.demoNotice ?? null,
          });
        }
        if (resultsData?.demoMode) {
          meta = mergeDemoMeta(meta, {
            demoMode: true,
            demoNotice: resultsData.demoNotice ?? null,
          });
        }
        setDemoMode(meta.demoMode);
        setDemoNotice(meta.demoNotice);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (copyFeedback === "idle") return;
    const timer = window.setTimeout(() => setCopyFeedback("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  async function handleCopyPilotSummary() {
    const text = buildPilotSummaryText(stats, loading);
    if (!text) {
      setCopyFeedback("unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("unavailable");
    }
  }

  const metricCards = [
    { title: "Total Patients",              value: formatMetric(stats?.totalPatients, loading),              subtitle: "Connected patient records",              attention: false },
    { title: "Active Cases",                value: formatMetric(stats?.activeCases, loading),                subtitle: "Patients with active rehabilitation plans", attention: false },
    { title: "Pending Reviews",             value: formatMetric(stats?.pendingReviews, loading),             subtitle: "Unreviewed clinical review flags",        attention: true  },
    { title: "Remote Assessments Pending",  value: formatMetric(stats?.remoteAssessmentsPending, loading), subtitle: "Assessment links awaiting response",      attention: false },
  ];

  const snapshotRows = [
    { label: "Patients created", value: formatSnapshotMetric(stats?.totalPatients, loading) },
    { label: "Active rehabilitation plans", value: formatSnapshotMetric(stats?.activeCases, loading) },
    { label: "Unreviewed review flags", value: formatSnapshotMetric(stats?.pendingReviews, loading) },
    { label: "Pending assessment links", value: formatSnapshotMetric(stats?.remoteAssessmentsPending, loading) },
    { label: "Generated", value: formatGeneratedAt(stats?.generatedAt, loading) },
  ];

  const statsUpdatedAt = formatStatsTime(stats?.generatedAt);

  const attentionQueue = useMemo(
    () =>
      buildPilotAttentionQueue({
        patients,
        stats,
        results,
        limit: 8,
      }),
    [patients, stats, results],
  );

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

        <PilotChecklistCard />

        <DemoOfflineBanner visible={demoMode} notice={demoNotice} />

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
        <section className="mb-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((c) => (
              <MetricCard key={c.title} title={c.title} value={c.value} subtitle={c.subtitle} attention={c.attention} />
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/25">
            These metrics reflect the current clinician account and are intended for pilot monitoring.
          </p>
        </section>

        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Movement assessments</h2>
              <p className="mt-1 text-xs text-white/35">
                Launch camera-assisted capture modules for demo-ready therapist review.
              </p>
            </div>
            <Link
              href="/clinician/assessments"
              className="shrink-0 rounded-[6px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3 py-1.5 text-[11px] font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
            >
              Assessment Center
            </Link>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { href: "/clinician/assessments/gait", title: "Gait v1", detail: "Walking observation capture" },
              { href: "/clinician/assessments/single-leg-stance", title: "Single Leg Stance", detail: "Hold-time capture" },
              { href: "/clinician/assessments/functional-reach", title: "Functional Reach", detail: "Reach cycle capture" },
              { href: "/clinician/assessments/timed-up-and-go", title: "Timed Up and Go", detail: "Manual task timer" },
            ].map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4 transition hover:border-[#1D9E75]/25"
              >
                <p className="text-sm font-semibold text-white">{module.title}</p>
                <p className="mt-1 text-xs text-white/35">{module.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Pilot evidence snapshot ── */}
        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Pilot Evidence Snapshot</h2>
              <p className="mt-1 text-xs text-white/35">
                Compact summary for clinic demos and investor evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyPilotSummary()}
              disabled={loading || !stats}
              className="shrink-0 rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:border-[#1D9E75]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copyFeedback === "copied"
                ? "Copied"
                : copyFeedback === "unavailable"
                  ? "Copy unavailable"
                  : "Copy pilot summary"}
            </button>
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {snapshotRows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5"
              >
                <dt className="text-[11px] text-white/40">{row.label}</dt>
                <dd
                  className="text-[12px] font-semibold text-white/70"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Pilot Attention Queue</h2>
                  <p className="mt-1 text-sm text-white/35">
                    Actionable follow-up from assessments, plans, and session activity.
                  </p>
                </div>
                <Link
                  href="/clinician/results"
                  className="shrink-0 text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
                >
                  View full results queue →
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {loading ? (
                  <p className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-sm text-white/40">
                    Loading follow-up queue…
                  </p>
                ) : attentionQueue.length === 0 ? (
                  <p className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-sm leading-relaxed text-white/45">
                    No active follow-up items. Continue monitoring patient activity and submitted assessments.
                  </p>
                ) : (
                  attentionQueue.map((item) => (
                    <PilotAttentionQueueRow
                      key={`${item.patientId || "aggregate"}-${item.source}-${item.reason}`}
                      item={item}
                    />
                  ))
                )}
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
