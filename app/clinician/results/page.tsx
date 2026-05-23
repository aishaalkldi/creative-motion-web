"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ClinicianResultCard, ClinicianResultStatus } from "@/app/api/clinician/results/route";
import type { AssessmentRow } from "@/app/api/assessments/route";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

type TabType = "all" | "pending" | "active" | "completed";

type ClinicalAssessmentResult = {
  patientId: string;
  patientName: string;
  assessmentId: string;
  assessmentType: string;
  submittedAt: string;
};

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
  const [clinicalAssessments, setClinicalAssessments] = useState<ClinicalAssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicalLoading, setClinicalLoading] = useState(true);
  const [error, setError] = useState("");
  const [clinicalError, setClinicalError] = useState("");

  useEffect(() => {
    async function loadRehab() {
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
        setError(err instanceof Error ? err.message : "Could not load rehabilitation progress.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void loadRehab();
  }, []);

  useEffect(() => {
    async function loadClinical() {
      try {
        setClinicalLoading(true);
        setClinicalError("");
        const patientsRes = await fetch("/api/patients");
        if (!patientsRes.ok) {
          const body = (await patientsRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed to load patients (${patientsRes.status})`);
        }
        const patients = (await patientsRes.json()) as PatientRow[];
        const assessmentCards = await Promise.all(
          patients.map(async (patient): Promise<ClinicalAssessmentResult | null> => {
            const res = await fetch(`/api/assessments?patientId=${encodeURIComponent(patient.id)}`);
            if (!res.ok) return null;
            const rows = (await res.json()) as AssessmentRow[];
            if (rows.length === 0) return null;
            const preferred =
              rows.find((row) => row.type === "remote_questionnaire") ??
              rows.find((row) => row.type === "general_msk") ??
              rows[0];
            if (!preferred) return null;
            return {
              patientId: patient.id,
              patientName: patient.full_name,
              assessmentId: preferred.id,
              assessmentType: preferred.type,
              submittedAt: preferred.created_at,
            };
          }),
        );
        const filtered = assessmentCards
          .filter((card): card is ClinicalAssessmentResult => card !== null)
          .sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
          );
        setClinicalAssessments(filtered);
      } catch (err) {
        setClinicalError(err instanceof Error ? err.message : "Could not load clinical assessments.");
        console.error(err);
      } finally {
        setClinicalLoading(false);
      }
    }
    void loadClinical();
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
            <h1 className="mt-2 text-2xl font-bold text-white">Results</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/45">
              Results are organized into clinical assessment results and rehabilitation progress.
              Assessment results summarize submitted tests. Rehabilitation progress tracks assigned
              plans, completed sessions, adherence, and effort.
            </p>
          </div>
          <Link
            href="/clinician"
            className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Section A — Clinical Assessment Results */}
        <section className="mb-8 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-white">Clinical Assessment Results</h2>
            <p className="mt-1 text-sm text-white/45">
              Submitted patient assessments and clinical summaries.
            </p>
          </div>

          {clinicalLoading ? (
            <p className="py-8 text-center text-sm text-white/40">Loading clinical assessments…</p>
          ) : clinicalError ? (
            <div className="rounded-[7px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-300">
              {clinicalError}
            </div>
          ) : clinicalAssessments.length === 0 ? (
            <p className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-8 text-center text-sm text-white/40">
              No submitted assessments yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {clinicalAssessments.map((assessment) => (
                <ClinicalAssessmentCard key={assessment.assessmentId} assessment={assessment} />
              ))}
            </div>
          )}
        </section>

        {/* Section B — Rehabilitation Progress Results */}
        <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-white">Rehabilitation Progress Results</h2>
            <p className="mt-1 text-sm text-white/45">
              Assigned plans, completed sessions, adherence, and effort.
            </p>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <MiniStat label="Treatment plans" value={String(results.length)} />
            <MiniStat label="Pending review" value={String(pendingCount)} />
            <MiniStat label="Active" value={String(activeCount)} />
            <MiniStat label="Patients" value={String(uniquePatients)} />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label="All" count={results.length} />
            <TabButton active={activeTab === "pending"} onClick={() => setActiveTab("pending")} label="Pending review" count={pendingCount} />
            <TabButton active={activeTab === "active"} onClick={() => setActiveTab("active")} label="Active" count={activeCount} />
            <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")} label="Completed" count={completedCount} />
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-white/40">Loading rehabilitation progress…</p>
          ) : error ? (
            <div className="rounded-[7px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/40">
              No rehabilitation progress yet. Assign a treatment plan and share the patient portal link to start collecting session data.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((r) => (
                <RehabProgressCard key={r.planId} result={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function assessmentTypeLabel(type: string): string {
  if (type === "general_msk") return "General MSK Assessment";
  if (type === "structured") return "Structured Assessment";
  if (type === "remote_questionnaire") return "Remote Questionnaire Assessment";
  if (type === "questionnaire") return "Questionnaire";
  return type;
}

function reportHref(patientId: string, assessmentId: string): string {
  const params = new URLSearchParams({ patientId, assessmentId });
  return `/clinician/assessment/report?${params.toString()}`;
}

function ClinicalAssessmentCard({ assessment }: { assessment: ClinicalAssessmentResult }) {
  const reportUrl = reportHref(assessment.patientId, assessment.assessmentId);

  return (
    <article className="rounded-[10px] border border-[#1E2D42] bg-[#0B1220] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{assessment.patientName}</p>
          <p className="mt-0.5 text-sm text-white/55">
            {assessmentTypeLabel(assessment.assessmentType)}
          </p>
          <p className="mt-1 text-xs text-white/35">
            Submitted {new Date(assessment.submittedAt).toLocaleString()}
          </p>
        </div>
        <span className="shrink-0 rounded-[5px] border border-lime-300/20 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">
          Submitted
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/clinician/patients/${assessment.patientId}`}
          className="inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
        >
          View Patient
        </Link>
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
      </div>
    </article>
  );
}

function RehabProgressCard({ result }: { result: ClinicianResultCard }) {
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
        <Metric label="Effort" value={result.latestEffortScore != null ? `${result.latestEffortScore}/10` : "—"} />
        <Metric label="Pain" value={result.latestPainScore != null ? `${result.latestPainScore}/10` : "—"} />
      </div>

      <p className="mt-3 text-[11px] text-white/35">
        Last completed:{" "}
        {result.lastCompletedAt
          ? new Date(result.lastCompletedAt).toLocaleString()
          : "No sessions completed yet"}
      </p>

      <div className="mt-4">
        <Link
          href={`/clinician/patients/${result.patientId}`}
          className="inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
        >
          View Patient
        </Link>
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
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
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
