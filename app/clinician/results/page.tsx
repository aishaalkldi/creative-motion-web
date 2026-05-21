"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getResults, type ResultOut } from "@/app/lib/api";

type TabType = "all" | "pending" | "by-patient";

export default function UnifiedResultsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [results, setResults] = useState<ResultOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchResults() {
      try {
        setLoading(true);
        setError("");
        const data = await getResults();
        setResults(data);
      } catch (err) {
        setError("Could not load results from backend");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, []);

  const pendingResults = results.filter((r) => !r.soap_assessment || !r.soap_plan);
  const resultsByPatient = results.reduce((acc, r) => {
    const key = r.patient_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<number, ResultOut[]>);

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
                Assessment Results
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Review assessment outcomes, SOAP notes, and patient findings. Use filters to focus on pending reviews or specific patients.
              </p>
            </div>

            <Link
              href="/clinician"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Dashboard
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Total Results" value={String(results.length)} />
            <MiniStat label="Pending Review" value={String(pendingResults.length)} />
            <MiniStat label="Unique Patients" value={String(Object.keys(resultsByPatient).length)} />
          </div>
        </div>

        <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <TabButton
              active={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              label="All Results"
              count={results.length}
            />
            <TabButton
              active={activeTab === "pending"}
              onClick={() => setActiveTab("pending")}
              label="Pending Review"
              count={pendingResults.length}
            />
            <TabButton
              active={activeTab === "by-patient"}
              onClick={() => setActiveTab("by-patient")}
              label="By Patient"
              count={Object.keys(resultsByPatient).length}
            />
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-white/60">
              Loading results from backend...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-300/35 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
              <p className="font-semibold text-rose-200">Error loading results</p>
              <p className="mt-1 text-white/80">{error}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-sm text-white/60">
              No assessment results found yet. Complete an assessment to see results here.
            </div>
          ) : (
            <>
              {activeTab === "all" && <AllResultsView results={results} />}
              {activeTab === "pending" && <AllResultsView results={pendingResults} />}
              {activeTab === "by-patient" && <ByPatientView resultsByPatient={resultsByPatient} />}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function AllResultsView({ results }: { results: ResultOut[] }) {
  if (results.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/60">
        No results in this category.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-5 gap-4 border-b border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-cyan-300">
        <div>ID</div>
        <div>Patient ID</div>
        <div>Test Name</div>
        <div>Score</div>
        <div>Date</div>
      </div>

      {results.map((result) => (
        <div
          key={result.id}
          className="grid grid-cols-5 gap-4 border-b border-white/5 px-6 py-4 text-sm text-slate-300 transition hover:bg-white/[0.02]"
        >
          <div className="font-medium text-cyan-100">{result.id}</div>
          <div>
            <Link
              href={`/clinician/patients/${result.patient_id}`}
              className="font-medium text-white hover:text-cyan-300 hover:underline"
            >
              {result.patient_id}
            </Link>
          </div>
          <div className="capitalize">{result.test_name}</div>
          <div className="font-semibold text-white">
            {result.score != null ? `${result.score}%` : "—"}
          </div>
          <div className="text-xs text-white/60">
            {new Date(result.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function ByPatientView({ resultsByPatient }: { resultsByPatient: Record<number, ResultOut[]> }) {
  return (
    <div className="space-y-4">
      {Object.entries(resultsByPatient).map(([patientId, patientResults]) => (
        <div
          key={patientId}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Patient ID: {patientId}
            </h3>
            <Link
              href={`/clinician/patients/${patientId}`}
              className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              View Patient →
            </Link>
          </div>

          <div className="space-y-2">
            {patientResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium text-white">{result.test_name}</span>
                  <span className="ml-3 text-xs text-white/50">
                    {new Date(result.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="font-semibold text-cyan-200">
                  {result.score != null ? `${result.score}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
          : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {label}
      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">
        {count}
      </span>
    </button>
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
