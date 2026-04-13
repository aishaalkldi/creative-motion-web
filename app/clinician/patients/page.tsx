"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PatientRecord } from "../../lib/domain-types";
import { patientsRepository } from "../../lib/repositories";

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const data = patientsRepository.getAll();
    setPatients(data);
  }, []);

  const filtered = patients.filter((patient) =>
    `${patient.fullName} ${patient.id} ${patient.phone} ${patient.diagnosis}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const hasPatients = patients.length > 0;
  const hasSearch = search.trim().length > 0;
  const activeCasesCount = patients.filter(
    (patient) => patient.status.toLowerCase() === "active"
  ).length;

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Clinician Workspace
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                All Patients
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Manage patient records, review case status, and open each profile
                to continue assessments and rehabilitation planning.
              </p>
            </div>

            <Link
              href="/clinician/patients/new"
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              + Add New Patient
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Total Records" value={String(patients.length)} />
            <MiniStat label="Active Cases" value={String(activeCasesCount)} />
            <MiniStat label="Displayed Results" value={String(filtered.length)} />
          </div>
        </div>

        <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="mb-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block flex-1 min-w-[260px]">
                <span className="mb-2 block text-sm text-white/70">
                  Search Patients
                </span>
                <input
                  placeholder="Search by Patient ID, Name, Phone, or Diagnosis"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/30 px-4 py-3 text-white outline-none placeholder:text-white/40"
                />
              </label>

              <button
                type="button"
                onClick={() => setSearch("")}
                disabled={!hasSearch}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5"
              >
                Clear Filter
              </button>
            </div>
            <div className="mt-3 text-xs text-white/55">
              Use search to filter by patient identity or clinical context.
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/65">
              {filtered.length} {filtered.length === 1 ? "patient" : "patients"} displayed
            </p>
            {hasSearch && (
              <p className="text-xs text-cyan-100">
                Filter active: <span className="font-semibold text-white">{search}</span>
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="min-w-full">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-sm text-cyan-100">
                  <th className="px-5 py-4">Patient ID</th>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">Diagnosis</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-sm text-white/60"
                    >
                      {hasPatients && hasSearch
                        ? "No patients match the current search."
                        : "No patient records yet. Add a patient to start the workflow."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => (
                    <tr
                      key={patient.id}
                      className="border-t border-white/10 text-sm text-white/80 transition hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4 font-medium text-cyan-100">{patient.id}</td>
                      <td className="px-5 py-4 font-medium text-white">{patient.fullName}</td>
                      <td className="px-5 py-4">{patient.phone}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-xs text-white/75">
                          {patient.diagnosis || "Not specified"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={patient.status} />
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/clinician/patients/${patient.id}`}
                          className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          Open Profile →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-lg font-semibold text-cyan-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const badgeClass =
    normalized === "active"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : normalized === "inactive"
        ? "border-white/15 bg-white/[0.04] text-white/80"
        : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
      {status}
    </span>
  );
}