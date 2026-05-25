"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDashboardStats, type DashboardStats } from "@/app/lib/api";

// ── Helpers (same format as dashboard pilot snapshot) ───────────────────────────

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

// ── Static content ────────────────────────────────────────────────────────────

const EVIDENCE_ITEMS = [
  "clinician feedback",
  "patient clarity feedback",
  "assessment completion rate",
  "session completion rate",
  "review flag usefulness",
  "one proof-moment screenshot",
];

const PILOT_DOCS = [
  "docs/pilot/clinic-pilot-script.md",
  "docs/pilot/clinician-feedback-form.md",
  "docs/pilot/patient-feedback-message.md",
  "docs/pilot/pilot-evidence-log.md",
  "docs/pilot/investor-proof-template.md",
];

type ChecklistItem = {
  step: number;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

function buildChecklist(patientId: string | null, patientReady: boolean): ChecklistItem[] {
  const planHref = patientReady && patientId
    ? `/clinician/plans/new?patientId=${encodeURIComponent(patientId)}`
    : "/clinician/plans/new";
  const profileHref = patientReady && patientId
    ? `/clinician/patients/${encodeURIComponent(patientId)}`
    : undefined;
  const assessmentReportHref = patientReady && patientId
    ? `/clinician/assessment/report?patientId=${encodeURIComponent(patientId)}`
    : undefined;

  return [
    {
      step: 1,
      title: "Create or select patient",
      description: "Open the patient list or create a new record for the demo.",
      href: "/clinician/patients",
      linkLabel: "Patients",
    },
    {
      step: 2,
      title: "Send remote assessment",
      description: "Generate and share a remote assessment link from the patient profile or request flow.",
      href: profileHref ?? "/clinician/assessment/start",
      linkLabel: profileHref ? "Patient profile" : "Start assessment",
    },
    {
      step: 3,
      title: "Review Clinical Assessment Summary",
      description: "Open the assessment report and confirm the clinical summary before assigning a plan.",
      href: assessmentReportHref,
      linkLabel: assessmentReportHref ? "Assessment report" : undefined,
    },
    {
      step: 4,
      title: "Assign rehabilitation plan",
      description: "Build and assign a structured plan aligned with the assessment findings.",
      href: planHref,
      linkLabel: "Build plan",
    },
    {
      step: 5,
      title: "Open patient portal",
      description: "Copy the patient access link from the profile and open it on a second device.",
      href: profileHref ?? "/clinician/patients",
      linkLabel: profileHref ? "Patient profile" : "Patients",
    },
    {
      step: 6,
      title: "Complete session",
      description: "Patient completes a home session and reports effort and pain in the portal.",
    },
    {
      step: 7,
      title: "Review Results / Review Queue",
      description: "Check adherence, review flags, and the results queue after the session.",
      href: "/clinician/results",
      linkLabel: "Results",
    },
    {
      step: 8,
      title: "Capture feedback",
      description: "Record clinician and patient feedback using the internal pilot docs below.",
    },
  ];
}

// ── Components ──────────────────────────────────────────────────────────────────

function ChecklistCard({ item }: { item: ChecklistItem }) {
  return (
    <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[11px] font-bold text-[#5DCAA5]"
          aria-hidden
        >
          {item.step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-5 text-white/35">{item.description}</p>
          {item.href && item.linkLabel && (
            <Link
              href={item.href}
              className="mt-2 inline-block text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
            >
              {item.linkLabel} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function PilotWorkspaceContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "unavailable">("idle");
  const [patientReady, setPatientReady] = useState(false);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (copyFeedback === "idle") return;
    const timer = window.setTimeout(() => setCopyFeedback("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => {
    if (!patientId) {
      setPatientReady(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/patients/${encodeURIComponent(patientId)}`, { cache: "no-store" })
      .then((r) => {
        if (!cancelled) setPatientReady(r.ok);
      })
      .catch(() => {
        if (!cancelled) setPatientReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

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

  const snapshotRows = [
    { label: "Patients created", value: formatSnapshotMetric(stats?.totalPatients, loading) },
    { label: "Active rehabilitation plans", value: formatSnapshotMetric(stats?.activeCases, loading) },
    { label: "Unreviewed review flags", value: formatSnapshotMetric(stats?.pendingReviews, loading) },
    { label: "Pending assessment links", value: formatSnapshotMetric(stats?.remoteAssessmentsPending, loading) },
    { label: "Generated", value: formatGeneratedAt(stats?.generatedAt, loading) },
  ];

  const checklist = buildChecklist(patientId, patientReady);

  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl">

        {/* ── Header ── */}
        <div className="mb-8">
          <Link
            href="/clinician"
            className="text-xs font-semibold text-white/30 transition hover:text-white/55"
          >
            ← Dashboard
          </Link>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-white/25">Internal pilot</p>
          <h1 className="mt-1.5 text-2xl font-bold text-white">Pilot Workspace</h1>
          <p className="mt-1 text-sm text-white/40">
            Run a controlled clinic pilot, track evidence, and collect feedback.
          </p>
        </div>

        {/* ── Section A: Pilot Snapshot ── */}
        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Pilot Snapshot</h2>
              <p className="mt-1 text-xs text-white/35">
                Live metrics from your clinician account. No patient names or IDs.
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

        {/* ── Section B: Demo Flow Checklist ── */}
        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-sm font-bold text-white">Demo Flow Checklist</h2>
          <p className="mt-1 text-xs text-white/35">
            Static guide for clinic demos. Add{" "}
            <code className="rounded bg-[#0B1220] px-1 py-0.5 text-[10px] text-white/50">?patientId=</code>{" "}
            to enable patient-specific assessment report links.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {checklist.map((item) => (
              <ChecklistCard key={item.step} item={item} />
            ))}
          </div>
        </section>

        {/* ── Section C: Evidence to collect ── */}
        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-sm font-bold text-white">Evidence to collect</h2>
          <p className="mt-1 text-xs text-white/35">During the pilot, collect:</p>
          <ul className="mt-3 space-y-1.5">
            {EVIDENCE_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-white/55">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#5DCAA5]/60" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Section D: Safe product positioning ── */}
        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-5 py-4">
          <h2 className="text-sm font-bold text-white">Safe product positioning</h2>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            RASQ supports clinician-led rehabilitation follow-up. It does not diagnose, prescribe
            treatment autonomously, or replace clinician judgment.
          </p>
        </section>

        {/* ── Section E: Pilot docs references ── */}
        <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-sm font-bold text-white">Pilot docs references</h2>
          <p className="mt-1 text-xs text-white/35">Internal references for clinic leads. Not exposed to patients.</p>
          <ul className="mt-3 space-y-1.5">
            {PILOT_DOCS.map((doc) => (
              <li
                key={doc}
                className="font-mono text-[11px] text-white/40"
                style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
              >
                {doc}
              </li>
            ))}
          </ul>
        </section>

      </div>
    </div>
  );
}

function PilotWorkspaceFallback() {
  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-white/40">Loading pilot workspace…</p>
      </div>
    </div>
  );
}

export default function PilotWorkspacePage() {
  return (
    <Suspense fallback={<PilotWorkspaceFallback />}>
      <PilotWorkspaceContent />
    </Suspense>
  );
}
