"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

type PatientResult = {
  id: number;
  patient_id: string;
  test: string;
  score: number;
};

export default function PatientProfilePage() {
  const params = useParams();
  const patientCode = String(params.id || "");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [results, setResults] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientCode) return;

    async function loadPageData() {
      try {
        const patientRes = await fetch(
          `http://127.0.0.1:8000/patients/${patientCode}`
        );

        if (!patientRes.ok) {
          throw new Error("Patient not found");
        }

        const patientData = await patientRes.json();
        setPatient(patientData);

        const resultsRes = await fetch("http://127.0.0.1:8000/results");

        if (resultsRes.ok) {
          const allResults = await resultsRes.json();

          const patientResults = allResults
            .filter((r: PatientResult) => r.patient_id === patientCode)
            .sort((a: PatientResult, b: PatientResult) => b.id - a.id);

          setResults(patientResults);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("Failed to load patient page:", error);
        setPatient(null);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    loadPageData();
  }, [patientCode]);

  const latestResult = useMemo(() => {
    if (!results.length) return null;
    return results[0];
  }, [results]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-300">Loading patient profile...</p>
        </div>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/clinician/patients"
            className="mb-6 inline-block text-cyan-300 hover:text-cyan-200"
          >
            ← Back to All Patients
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h1 className="text-3xl font-bold text-red-300">
              Patient Not Found
            </h1>
            <p className="mt-3 text-slate-300">
              No patient record was found for this ID.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/clinician/patients"
            className="inline-block text-cyan-300 transition hover:text-cyan-200"
          >
            ← Back to All Patients
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
                Patient Profile
              </p>
              <h1 className="text-4xl font-bold text-cyan-300">
                {patient.name}
              </h1>
              <p className="mt-2 text-slate-300">
                {patient.patient_code} • {patient.diagnosis}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={`/body-axis-ai?patientId=${encodeURIComponent(
                  patient.patient_code
                )}&patientName=${encodeURIComponent(
                  patient.name
                )}&test=posture&assessmentId=AX-1001`}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-center font-semibold text-black transition hover:scale-[1.02]"
              >
                Start Assessment
              </Link>

              <Link
                href="/sessions"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                View Sessions
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md lg:col-span-2">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Patient Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard label="Patient Code" value={patient.patient_code} />
              <InfoCard label="Phone" value={patient.phone} />
              <InfoCard label="Age" value={patient.age || "-"} />
              <InfoCard label="Gender" value={patient.gender || "-"} />
              <InfoCard label="Diagnosis" value={patient.diagnosis} />
              <InfoCard label="Status" value={patient.status} />
              <InfoCard label="Condition" value={patient.condition || "-"} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Quick Actions
            </h2>

            <div className="space-y-3">
              <Link
                href={`/body-axis-ai?patientId=${encodeURIComponent(
                  patient.patient_code
                )}&patientName=${encodeURIComponent(
                  patient.name
                )}&test=balance&assessmentId=AX-2001`}
                className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 transition hover:bg-white/10"
              >
                Balance Test
              </Link>

              <Link
                href={`/body-axis-ai?patientId=${encodeURIComponent(
                  patient.patient_code
                )}&patientName=${encodeURIComponent(
                  patient.name
                )}&test=squat&assessmentId=AX-2002`}
                className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 transition hover:bg-white/10"
              >
                Squat Analysis
              </Link>

              <Link
                href={`/body-axis-ai?patientId=${encodeURIComponent(
                  patient.patient_code
                )}&patientName=${encodeURIComponent(
                  patient.name
                )}&test=gait&assessmentId=AX-2003`}
                className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 transition hover:bg-white/10"
              >
                Gait Screening
              </Link>
            </div>
          </section>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md lg:col-span-2">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              Clinical Notes
            </h2>
            <p className="leading-7 text-slate-300">
              {patient.condition || "No notes available yet."}
            </p>

            <div className="mt-6">
              <h3 className="mb-4 text-xl font-semibold text-white">
                Assessment History
              </h3>

              {results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="rounded-2xl border border-white/10 bg-[#0F172A] p-4"
                    >
                      <p className="text-sm text-slate-400">
                        Test:{" "}
                        <span className="font-medium capitalize text-white">
                          {result.test}
                        </span>
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Score:{" "}
                        <span className="font-medium text-cyan-300">
                          {result.score}%
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No assessment history yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              Latest Result
            </h2>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <p className="text-sm text-slate-300">Latest Assessment Score</p>

              <p className="mt-2 text-3xl font-bold text-cyan-300">
                {latestResult ? `${latestResult.score}%` : "Pending"}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {latestResult
                  ? `Latest test: ${latestResult.test}`
                  : "Waiting for first connected result"}
              </p>
            </div>

            <Link
              href="/live-results"
              className="mt-4 block rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-center font-semibold text-black transition hover:scale-[1.02]"
            >
              View Live Results
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}