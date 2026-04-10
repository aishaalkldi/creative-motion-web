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

type ResultItem = {
  id: number;
  patient_id: string;
  test: string;
  score: number;
};

export default function ClinicianDashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [patientsRes, resultsRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/patients"),
          fetch("http://127.0.0.1:8000/results"),
        ]);

        const patientsData = patientsRes.ok ? await patientsRes.json() : [];
        const resultsData = resultsRes.ok ? await resultsRes.json() : [];

        setPatients(patientsData);
        setResults(resultsData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        setPatients([]);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const cleanPatients = useMemo(() => {
    return patients.filter(
      (patient) =>
        patient.patient_code !== "string" &&
        patient.name !== "string" &&
        patient.phone !== "string"
    );
  }, [patients]);

  const recentPatients = useMemo(() => {
    return cleanPatients.slice(0, 5);
  }, [cleanPatients]);

  const recentResults = useMemo(() => {
    return results.slice(0, 5);
  }, [results]);

  const totalPatients = cleanPatients.length;
  const totalAssessments = results.length;

  const averageScore = useMemo(() => {
    if (!results.length) return 0;
    const total = results.reduce((sum, item) => sum + item.score, 0);
    return Math.round(total / results.length);
  }, [results]);

  const activeCases = useMemo(() => {
    return cleanPatients.filter((patient) => patient.status === "Active").length;
  }, [cleanPatients]);

  function getPatientName(patientId: string) {
    const patient = cleanPatients.find(
      (item) => item.patient_code === patientId
    );
    return patient ? patient.name : patientId;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-300">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Clinician Portal
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">
            Creative Motion Dashboard
          </h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            Monitor patient flow, review recent assessments, and continue
            rehabilitation planning through one connected clinician workspace.
          </p>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Patients"
            value={String(totalPatients)}
            subtitle="Connected patient records"
          />
          <StatCard
            title="Total Assessments"
            value={String(totalAssessments)}
            subtitle="Saved assessment results"
          />
          <StatCard
            title="Average Score"
            value={`${averageScore}%`}
            subtitle="Across all saved results"
          />
          <StatCard
            title="Active Cases"
            value={String(activeCases)}
            subtitle="Current active patients"
          />
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">
                Quick Actions
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <QuickAction
                href="/clinician/patients/new"
                title="Add Patient"
                description="Create a new patient file"
              />
              <QuickAction
                href="/clinician/patients"
                title="All Patients"
                description="Open all patient records"
              />
              <QuickAction
                href="/live-results"
                title="Live Results"
                description="Review recent assessment data"
              />
              <QuickAction
                href="/library"
                title="Library"
                description="Open rehab content library"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Workflow Map
            </h2>

            <div className="space-y-3">
              <WorkflowItem
                title="1. Add Patient"
                desc="Create a patient file from the clinician portal."
              />
              <WorkflowItem
                title="2. Launch Assessment"
                desc="Open Body Axis AI for posture, gait, squat, or balance."
              />
              <WorkflowItem
                title="3. Save Result"
                desc="Assessment data is stored in the backend database."
              />
              <WorkflowItem
                title="4. Review Progress"
                desc="Open the patient profile and view latest result history."
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">
                Recent Patients
              </h2>

              <Link
                href="/clinician/patients"
                className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                View all
              </Link>
            </div>

            {recentPatients.length > 0 ? (
              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/clinician/patients/${patient.patient_code}`}
                    className="block rounded-2xl border border-white/10 bg-[#0F172A] p-4 transition hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">
                          {patient.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {patient.patient_code} • {patient.diagnosis}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {patient.phone}
                        </p>
                      </div>

                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                        {patient.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No patients found yet.</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">
                Recent Assessments
              </h2>

              <Link
                href="/live-results"
                className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                View results
              </Link>
            </div>

            {recentResults.length > 0 ? (
              <div className="space-y-3">
                {recentResults.map((result) => (
                  <div
                    key={result.id}
                    className="rounded-2xl border border-white/10 bg-[#0F172A] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">
                          {getPatientName(result.patient_id)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {result.patient_id}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 capitalize">
                          Test: {result.test}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-cyan-300">
                          {result.score}%
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Assessment score
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No assessment results yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
      <p className="text-sm text-slate-400">{title}</p>
      <h3 className="mt-3 text-4xl font-bold text-cyan-300">{value}</h3>
      <p className="mt-3 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-[#0F172A] p-5 transition hover:border-cyan-400/40 hover:bg-white/10"
    >
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </Link>
  );
}

function WorkflowItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
    </div>
  );
}