"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ClinicianResultCard, ClinicianResultStatus } from "@/app/api/clinician/results/route";

type TabType = "all" | "pending" | "active" | "completed";

const STATUS_LABELS: Record<ClinicianResultStatus, string> = {
  pending_review: "Pending review",
  active: "Active",
  completed: "Completed",
};

const STATUS_STYLES: Record<ClinicianResultStatus, string> = {
  pending_review: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  active: "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#5DCAA5]",
  completed: "border-[#1E2D42] bg-[#0B1220] text-white/50",
};

export default function UnifiedResultsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [results, setResults] = useState<ClinicianResultCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/clinician/results");
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed to load (${res.status})`);
        }
        setResults((await res.json()) as ClinicianResultCard[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load results.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === "all") return results;
    if (activeTab === "pending") return results.filter((r) => r.status === "pending_review");
    if (activeTab === "active") return results.filter((r) => r.status === "active");
    return results.filter((r) => r.status === "completed");
  }, [results, activeTab]);

  const pendingCount = results.filter((r) => r.status === "pending_review").length;
  const activeCount = results.filter((r) => r.status === "active").length;
  const completedCount = results.filter((r) => r.status === "completed").length;
  const uniquePatients = new Set(results.map((r) => r.patientId)).size;

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
              Clinician workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">Patient Progress & Results</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/45">
              Rehabilitation outcomes from Supabase — session completions, effort, and pain scores per treatment plan.
            </p>
          </div>
          <Link
            href="/clinician"
            className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <MiniStat label="Treatment plans" value={String(results.length)} />
          <MiniStat label="Pending review" value={String(pendingCount)} />
          <MiniStat label="Active" value={String(activeCount)} />
          <MiniStat label="Patients" value={String(uniquePatients)} />
        </div>

        <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label="All" count={results.length} />
            <TabButton active={activeTab === "pending"} onClick={() => setActiveTab("pending")} label="Pending review" count={pendingCount} />
            <TabButton active={activeTab === "active"} onClick={() => setActiveTab("active")} label="Active" count={activeCount} />
            <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")} label="Completed" count={completedCount} />
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-white/40">Loading progress from Supabase…</p>
          ) : error ? (
            <div className="rounded-[7px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/40">
              No results in this category. Assign a treatment plan and share the patient portal link to start collecting session data.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((r) => (
                <ResultCard key={r.planId} result={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function assessmentTypeLabel(type: string | null): string {
  if (!type) return "";
  if (type === "general_msk") return "General MSK";
  if (type === "structured") return "Structured";
  if (type === "questionnaire") return "Questionnaire";
  return type;
}

function reportHref(result: ClinicianResultCard): string | null {
  if (!result.latestAssessmentId) return null;
  const params = new URLSearchParams({
    patientId: result.patientId,
    assessmentId: result.latestAssessmentId,
  });
  return `/clinician/assessment/report?${params.toString()}`;
}

function ResultCard({ result }: { result: ClinicianResultCard }) {
  const reportUrl = reportHref(result);
  const hasReport = Boolean(reportUrl);

  return (
    <article className="rounded-[10px] border border-[#1E2D42] bg-[#0B1220] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{result.patientName}</p>
          <p className="mt-0.5 truncate text-sm text-white/50">{result.planTitle}</p>
          <p className="mt-0.5 text-xs text-white/35">{result.programName}</p>
        </div>
        <span className={`shrink-0 rounded-[5px] border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[result.status]}`}>
          {STATUS_LABELS[result.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Sessions" value={`${result.sessionsCompleted} / ${result.totalSessions}`} />
        <Metric label="Progress" value={`${result.progressPct}%`} />
        <Metric label="Latest effort" value={result.latestEffortScore != null ? `${result.latestEffortScore}/10` : "—"} />
        <Metric label="Latest pain" value={result.latestPainScore != null ? `${result.latestPainScore}/10` : "—"} />
      </div>

      <p className="mt-3 text-[11px] text-white/35">
        Last completed:{" "}
        {result.lastCompletedAt
          ? new Date(result.lastCompletedAt).toLocaleString()
          : "No sessions completed yet"}
      </p>

      <p className="mt-2 text-[11px] text-white/35">
        {hasReport ? (
          <>
            Assessment report:{" "}
            <span className="text-white/55">{assessmentTypeLabel(result.latestAssessmentType)}</span>
          </>
        ) : (
          <span className="italic text-white/30">No assessment report yet</span>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/clinician/patients/${result.patientId}`}
          className="inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
        >
          View Patient
        </Link>
        {hasReport && reportUrl ? (
          <>
            <Link
              href={reportUrl}
              className="inline-flex rounded-[7px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-3 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
            >
              View Assessment Report
            </Link>
            <Link
              href={reportUrl}
              className="inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white/80"
              title="Opens the clinical report; use Export PDF on that page to print or save as PDF"
            >
              Open report to export PDF
            </Link>
          </>
        ) : (
          <>
            <span
              className="inline-flex cursor-not-allowed rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/25"
              aria-disabled="true"
            >
              View Assessment Report
            </span>
            <span
              className="inline-flex cursor-not-allowed rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/25"
              aria-disabled="true"
            >
              Open report to export PDF
            </span>
          </>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2">
      <p className="text-[10px] text-white/35">{label}</p>
      <p
        className="mt-0.5 text-sm font-semibold text-[#5DCAA5]"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[7px] px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-[#1D9E75] text-white"
          : "border border-[#1E2D42] bg-[#0B1220] text-white/45 hover:text-white/70"
      }`}
    >
      {label}
      <span className="ml-1.5 opacity-70">({count})</span>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3">
      <p className="text-[10px] text-white/35">{label}</p>
      <p
        className="mt-1 text-lg font-bold text-[#5DCAA5]"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
    </div>
  );
}
