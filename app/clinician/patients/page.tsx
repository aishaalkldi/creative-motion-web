"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Patient = {
  id: number;
  patient_code: string;
  name: string;
  phone: string;
  age?: string;
  gender?: string;
  diagnosis: string;
  condition?: string;
  status: string;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/patients")
      .then((res) => res.json())
      .then((data) => {
        setPatients(data);
      })
      .catch((error) => {
        console.error("Failed to load patients:", error);
      });
  }, []);

  const filteredPatients = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return patients;

    return patients.filter(
      (patient) =>
        patient.patient_code.toLowerCase().includes(value) ||
        patient.name.toLowerCase().includes(value) ||
        patient.phone.toLowerCase().includes(value) ||
        patient.diagnosis.toLowerCase().includes(value) ||
        patient.status.toLowerCase().includes(value)
    );
  }, [patients, search]);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Clinician Portal
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">All Patients</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            View patient records, search by ID or phone, and access each case for
            assessment and rehabilitation planning.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-[1fr_220px]">
          <input
            id="searchBox"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Patient ID, Name, Phone, or Diagnosis"
            className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
          />

          <Link
            href="/clinician/patients/new"
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-center font-semibold text-black transition hover:scale-[1.02]"
          >
            Add New Patient
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="grid grid-cols-5 gap-4 border-b border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-cyan-300">
            <div>Patient ID</div>
            <div>Name</div>
            <div>Phone</div>
            <div>Diagnosis</div>
            <div>Status</div>
          </div>

          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <Link
                key={patient.id}
                href={`/clinician/patients/${patient.patient_code}`}
                className="grid grid-cols-5 gap-4 border-b border-white/5 px-6 py-5 text-sm text-slate-300 transition hover:bg-white/5"
              >
                <div>{patient.patient_code}</div>
                <div className="font-medium text-white">{patient.name}</div>
                <div>{patient.phone}</div>
                <div>{patient.diagnosis}</div>
                <div>
                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {patient.status}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-sm text-slate-400">
              No matching patients found.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}