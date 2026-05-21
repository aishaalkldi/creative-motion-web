"use client";

import Link from "next/link";
import {
  MOCK_PATIENTS,
  MOCK_ACTIVITY,
  type ActivityItem,
} from "@/app/lib/mock-clinical-data";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function today() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const activeCount     = MOCK_PATIENTS.filter((p) => p.status === "Active").length;
const pendingCount    = MOCK_PATIENTS.filter((p) => p.pendingAssessment).length;
const avgAdherence    = Math.round(MOCK_PATIENTS.reduce((s, p) => s + p.adherence, 0) / MOCK_PATIENTS.length);
const reviewCount     = MOCK_PATIENTS.filter((p) => p.status === "Review").length;

/* ─── Metric card ────────────────────────────────────────────────────────── */

function Metric({ label, value, sub, warn = false }: {
  label: string; value: string; sub: string; warn?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</p>
      <p
        className={`mt-3 text-3xl font-bold ${warn ? "text-amber-300" : "text-[#5DCAA5]"}`}
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-white/30">{sub}</p>
    </div>
  );
}

/* ─── Status badge ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Active" ? "border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#5DCAA5]" :
    status === "Review" ? "border-amber-400/25 bg-amber-400/10 text-amber-300" :
    "border-[#1E2D42] bg-[#0B1220] text-white/35";
  return (
    <span className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

/* ─── Activity icon ──────────────────────────────────────────────────────── */

function ActivityDot({ type }: { type: ActivityItem["type"] }) {
  const cls =
    type === "alert"   ? "bg-amber-400" :
    type === "session" ? "bg-[#1D9E75]" :
    type === "plan"    ? "bg-[#5DCAA5]" :
    "bg-white/25";
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function ClinicalDashboard() {
  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest text-white/25"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {today()}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold text-white">
              Clinical Dashboard
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {activeCount} active patients · {pendingCount} assessment{pendingCount !== 1 ? "s" : ""} pending
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/clinician/assessment/new"
              className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
            >
              + New Assessment
            </Link>
            <Link
              href="/clinician/patients"
              className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
            >
              View Patients
            </Link>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <Metric label="Active Patients"       value={String(activeCount)}  sub="Currently in programme"        />
          <Metric label="Pending Assessments"   value={String(pendingCount)} sub="Awaiting clinical review"  warn />
          <Metric label="Avg Adherence"         value={`${avgAdherence}%`}   sub="Across all active patients"    />
          <Metric label="Review Needed"         value={String(reviewCount)}  sub="Below adherence threshold" warn />
        </div>

        {/* ── Main columns ── */}
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">

          {/* Today's patient list */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1E2D42] px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-white">Active Patients</h2>
                <p className="mt-0.5 text-xs text-white/35">Last session · Phase · Adherence</p>
              </div>
              <Link href="/clinician/patients" className="text-xs font-semibold text-[#5DCAA5] hover:text-[#1D9E75]">
                View all →
              </Link>
            </div>

            <div className="divide-y divide-[#1E2D42]">
              {MOCK_PATIENTS.map((p) => (
                <Link
                  key={p.id}
                  href={`/clinician/patients/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-[#0B1220] group"
                >
                  {/* Avatar */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#1D9E75]/10 text-[11px] font-bold text-[#5DCAA5]">
                    {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>

                  {/* Name + diagnosis */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white group-hover:text-[#5DCAA5] truncate">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-white/35">{p.diagnosis}</p>
                  </div>

                  {/* Phase */}
                  <span className="hidden shrink-0 text-xs text-white/40 sm:block">{p.phase}</span>

                  {/* Adherence bar */}
                  <div className="hidden w-20 shrink-0 sm:block">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span
                        className={`text-[11px] font-semibold ${p.adherence < 60 ? "text-amber-300" : "text-white/60"}`}
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {p.adherence}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[#1E2D42]">
                      <div
                        className={`h-full rounded-full ${p.adherence < 60 ? "bg-amber-400" : "bg-[#1D9E75]"}`}
                        style={{ width: `${p.adherence}%` }}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge status={p.status} />

                  {/* Arrow */}
                  <svg className="h-3.5 w-3.5 shrink-0 text-white/15 transition group-hover:text-[#5DCAA5]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">

            {/* Activity feed */}
            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825]">
              <div className="border-b border-[#1E2D42] px-5 py-4">
                <h2 className="text-sm font-bold text-white">Clinical Activity</h2>
                <p className="mt-0.5 text-xs text-white/35">Recent events and alerts</p>
              </div>
              <div className="divide-y divide-[#1E2D42]">
                {MOCK_ACTIVITY.map((item) => (
                  <div key={item.id} className="flex gap-3 px-5 py-3">
                    <ActivityDot type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-5 text-white/55">{item.text}</p>
                      <p
                        className="mt-0.5 text-[10px] text-white/25"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {item.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick access */}
            <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
              <h2 className="text-sm font-bold text-white">Quick access</h2>
              <div className="mt-3 space-y-1.5">
                {[
                  { label: "New assessment",    href: "/clinician/assessment/new", primary: true },
                  { label: "Build treatment plan", href: "/clinician/plans/new",   primary: false },
                  { label: "View all patients",    href: "/clinician/patients",    primary: false },
                  { label: "Results",              href: "/clinician/results",     primary: false },
                ].map(({ label, href, primary }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-between rounded-[7px] px-3 py-2.5 text-sm font-semibold transition ${
                      primary
                        ? "border border-[#1D9E75]/20 bg-[#1D9E75]/8 text-[#5DCAA5] hover:bg-[#1D9E75]/14"
                        : "border border-[#1E2D42] bg-[#0B1220] text-white/55 hover:border-[#1D9E75]/15 hover:text-white"
                    }`}
                  >
                    {label}
                    <svg className="h-3.5 w-3.5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
