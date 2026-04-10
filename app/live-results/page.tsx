"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ResultItem = {
  patient_id: string;
  test: string;
  score: number;
};

export default function LiveResultsPage() {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchResults() {
      try {
        const response = await fetch("http://127.0.0.1:8000/results");
        if (!response.ok) {
          throw new Error("Failed to fetch results");
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError("Could not load live results");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, []);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Live Backend Data
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">Live Results</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            This page reads real assessment results directly from the FastAPI
            backend instead of static mock data.
          </p>
        </div>

        <div className="mb-6">
          <Link
            href="/clinician"
            className="inline-block rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          {loading ? (
            <p className="text-slate-300">Loading results...</p>
          ) : error ? (
            <p className="text-red-300">{error}</p>
          ) : results.length === 0 ? (
            <p className="text-slate-400">No results found yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-3 gap-4 border-b border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-cyan-300">
                <div>Patient ID</div>
                <div>Test</div>
                <div>Score</div>
              </div>

              {results.map((result, index) => (
                <div
                  key={`${result.patient_id}-${index}`}
                  className="grid grid-cols-3 gap-4 border-b border-white/5 px-6 py-4 text-sm text-slate-300"
                >
                  <div>{result.patient_id}</div>
                  <div className="capitalize">{result.test}</div>
                  <div className="font-semibold text-white">{result.score}%</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}