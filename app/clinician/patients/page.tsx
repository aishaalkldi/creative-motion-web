"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import {
  formatLastSessionLine,
  formatSessionsLine,
  OPERATIONAL_STATUS_ONLY,
  shouldShowNoRecentSessionBadge,
} from "@/app/lib/clinician/adherence-display";
import {
  buildPatientOperationalSummaries,
  type PatientOperationalBadge,
} from "@/app/lib/clinician/pilot-attention-queue";
import type { PatientRow } from "../../lib/validate-patient-ownership";
import ConfirmModal from "../../components/ConfirmModal";

/* ─── Badge helpers ──────────────────────────────────────────────────────── */

function OperationalBadge({ badge }: { badge: PatientOperationalBadge }) {
  const cls =
    badge.tone === "review"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : badge.tone === "rehab"
        ? "border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#5DCAA5]"
        : badge.tone === "assessment"
          ? "border-sky-400/25 bg-sky-400/10 text-sky-200"
          : badge.tone === "plan"
            ? "border-[#1E2D42] bg-[#0B1220] text-white/50"
            : "border-[#1E2D42] bg-[#0B1220] text-white/35";
  return (
    <span className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {badge.label}
    </span>
  );
}

function NoRecentSessionBadge() {
  return (
    <span className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-0.5 text-[10px] font-semibold text-white/45">
      No recent session
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "";
  const cls =
    s.toLowerCase() === "active"
      ? "border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#5DCAA5]"
      : s.toLowerCase() === "review"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
      : "border-[#1E2D42] bg-[#0B1220] text-white/35";
  return (
    <span className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {s || "Active"}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function PatientsPage() {
  const [patients, setPatients]     = useState<PatientRow[]>([]);
  const [results, setResults]       = useState<ClinicianResultsResponse | null>(null);
  const [search, setSearch]         = useState("");
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PatientRow | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    Promise.all([
      fetch("/api/patients").then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<PatientRow[]>;
      }),
      fetch("/api/clinician/results")
        .then(async (res) =>
          res.ok ? (res.json() as Promise<ClinicianResultsResponse>) : null,
        )
        .catch(() => null),
    ])
      .then(([patientsData, resultsData]) => {
        if (!isMounted) return;
        setPatients(patientsData);
        setResults(resultsData);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Could not load patients.");
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const operationalByPatient = useMemo(
    () => buildPatientOperationalSummaries(patients, results),
    [patients, results],
  );

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeletingId(confirmTarget.id);
    try {
      const res = await fetch(`/api/patients/${confirmTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      setPatients((prev) => prev.filter((p) => p.id !== confirmTarget.id));
      setConfirmTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete patient.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = patients.filter((p) =>
    `${p.full_name} ${p.id} ${p.phone ?? ""} ${p.diagnosis ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = patients.filter((p) => (p.status ?? "").toLowerCase() === "active").length;

  return (
    <>
      <ConfirmModal
        open={!!confirmTarget}
        title="Delete Patient"
        message={`"${confirmTarget?.full_name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Yes, Delete"
        loading={deletingId !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />

      <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
        <div className="mx-auto max-w-6xl space-y-5">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                Provider workspace
              </p>
              <h1 className="mt-1.5 text-2xl font-bold text-white">Patients</h1>
              <p className="mt-1 text-sm text-white/40">
                {patients.length} records · {activeCount} active
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/clinician/patients/new"
                className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
              >
                Add Patient
              </Link>
              <Link
                href="/clinician/assessment/new"
                className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
              >
                New Assessment
              </Link>
            </div>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div className="rounded-[7px] border border-rose-400/20 bg-rose-400/6 px-4 py-3 text-xs text-rose-300">
              Could not load patients. {error}
            </div>
          )}

          {/* ── Search ── */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, diagnosis, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[7px] border border-[#1E2D42] bg-[#0F1825] py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2.5 text-xs font-semibold text-white/40 transition hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* ── Table ── */}
          <div className="overflow-x-auto rounded-[10px] border border-[#1E2D42]">
            <table className="min-w-full">
              <thead className="bg-[#0B1220]">
                <tr>
                  {["Patient", "Diagnosis", "Phone", "Status", "Added", ""].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/25"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1E2D42] bg-[#0F1825]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-sm text-white/30">
                      Loading patients…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <p className="text-[12px] text-[#6B7280]">
                        {search ? "No patients match the current search." : "No patients yet. Add your first patient to begin the pilot workflow."}
                      </p>
                      {!search && (
                        <Link
                          href="/clinician/patients/new"
                          className="mt-4 inline-flex rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
                        >
                          Add your first patient
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => {
                    const operational = operationalByPatient.get(patient.id);
                    const sessionsLine =
                      operational && operational.totalSessions > 0
                        ? formatSessionsLine(
                            operational.sessionsCompleted,
                            operational.totalSessions,
                          )
                        : null;
                    const lastSessionLine = operational?.hasPlan
                      ? formatLastSessionLine(operational.lastSessionAt)
                      : null;
                    const showNoRecent =
                      operational &&
                      shouldShowNoRecentSessionBadge({
                        totalSessions: operational.totalSessions,
                        lastSessionAt: operational.lastSessionAt,
                      });
                    return (
                    <tr
                      key={patient.id}
                      className="group transition hover:bg-[#0B1220]"
                    >
                      {/* Name + avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#1D9E75]/10 text-[11px] font-bold text-[#5DCAA5]">
                            {patient.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{patient.full_name}</p>
                            {patient.phone && (
                              <p className="text-[11px] text-white/35">{patient.phone}</p>
                            )}
                            {operational && operational.badges.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {operational.badges.map((badge) => (
                                  <OperationalBadge key={badge.label} badge={badge} />
                                ))}
                                {showNoRecent && <NoRecentSessionBadge />}
                              </div>
                            )}
                            {showNoRecent && operational && operational.badges.length === 0 && (
                              <div className="mt-1.5">
                                <NoRecentSessionBadge />
                              </div>
                            )}
                            {sessionsLine && (
                              <p className="mt-1 text-[10px] text-white/40">{sessionsLine}</p>
                            )}
                            {lastSessionLine && (
                              <p className="mt-0.5 text-[10px] text-white/30">{lastSessionLine}</p>
                            )}
                            {operational?.hasPlan && operational.totalSessions > 0 && (
                              <p className="mt-0.5 text-[9px] italic text-white/20">
                                {OPERATIONAL_STATUS_ONLY}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Diagnosis */}
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-white/55">
                          {patient.diagnosis || "Not specified"}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-white/40">{patient.phone || "—"}</span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <StatusBadge status={patient.status} />
                      </td>

                      {/* Added date */}
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-white/35">
                          {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : "—"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/clinician/patients/${patient.id}`}
                            className="rounded-[6px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
                          >
                            Open profile
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === patient.id}
                            onClick={() => setConfirmTarget(patient)}
                            className="rounded-[6px] border border-rose-400/20 bg-[#0B1220] px-3 py-1.5 text-xs font-semibold text-rose-400/60 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-40"
                          >
                            {deletingId === patient.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!isLoading && (
            <p className="text-xs text-white/20">
              {filtered.length} of {patients.length} patient{patients.length !== 1 ? "s" : ""}
              {search ? ` matching "${search}"` : " shown"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
