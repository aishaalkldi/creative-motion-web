"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PatientRow } from "../../lib/validate-patient-ownership";
import ConfirmModal from "../../components/ConfirmModal";

/* ─── Badge helpers ──────────────────────────────────────────────────────── */

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
  const [search, setSearch]         = useState("");
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PatientRow | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetch("/api/patients")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<PatientRow[]>;
      })
      .then((data) => { if (isMounted) setPatients(data); })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Could not load patients.");
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

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
                href="/clinician/assessment/new"
                className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
              >
                + New Assessment
              </Link>
              <Link
                href="/clinician/patients/new"
                className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
              >
                Add Patient
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
                placeholder="Search by name, diagnosis, or ID…"
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
                    <td colSpan={6} className="px-5 py-10 text-center text-[12px] text-[#6B7280]">
                      {search ? "No patients match the current search." : "No patients yet. Add your first patient to get started."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => (
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
                          <div>
                            <p className="text-sm font-semibold text-white">{patient.full_name}</p>
                            <p
                              className="text-[10px] text-white/25"
                              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                            >
                              {patient.id.slice(0, 8)}…
                            </p>
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
                            className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
                          >
                            Open
                          </Link>
                          <Link
                            href={`/clinician/patients/${patient.id}`}
                            className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
                          >
                            View Profile
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
                  ))
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
