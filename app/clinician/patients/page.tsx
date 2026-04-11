"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getStoredPatients,
  type StoredPatient,
} from "../../lib/patients-storage";

export default function PatientsPage() {
  const [patients, setPatients] = useState<StoredPatient[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const data = getStoredPatients();
    setPatients(data);
  }, []);

  const filtered = patients.filter((patient) =>
    `${patient.fullName} ${patient.id} ${patient.phone} ${patient.diagnosis}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Clinician Portal
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              All Patients
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              View patient records, search by ID or phone, and access each case
              for assessment and rehabilitation planning.
            </p>
          </div>

          <Link
            href="/clinician/patients/new"
            className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Add New Patient
          </Link>
        </div>

        <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="mb-6">
            <label className="block">
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
                      className="px-5 py-6 text-sm text-white/55"
                    >
                      No matching patients found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => (
                    <tr
                      key={patient.id}
                      className="border-t border-white/10 text-sm text-white/80"
                    >
                      <td className="px-5 py-4">{patient.id}</td>
                      <td className="px-5 py-4">{patient.fullName}</td>
                      <td className="px-5 py-4">{patient.phone}</td>
                      <td className="px-5 py-4">{patient.diagnosis}</td>
                      <td className="px-5 py-4">{patient.status}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/clinician/patients/${patient.id}`}
                          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          Open Profile
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