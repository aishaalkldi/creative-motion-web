"use client";

import { useState } from "react";
import Link from "next/link";

export default function PatientAssessmentPage() {
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    try {
      setLoading(true);

      await fetch("http://127.0.0.1:8000/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: "PT-1004",
          test: "gait",
          score: 85,
        }),
      });

      setCompleted(true);
    } catch (error) {
      console.error("Failed to save result:", error);
      alert("Failed to send result to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        {!started ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
            <h1 className="text-3xl font-bold text-cyan-300">
              Start Your Assessment
            </h1>

            <p className="mt-4 text-slate-300">
              This assessment will help your clinician evaluate your movement
              quality and provide a personalized rehabilitation plan.
            </p>

            <button
              onClick={() => setStarted(true)}
              className="mt-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold text-black"
            >
              Start Assessment
            </button>
          </div>
        ) : !completed ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <h2 className="text-2xl font-semibold text-white">
              Performing Assessment...
            </h2>

            <div className="mt-6 rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-8 text-center">
              <p className="text-cyan-300">Camera Active</p>
              <p className="mt-2 text-sm text-slate-400">
                Please follow the on-screen instructions
              </p>
            </div>

            <button
              onClick={handleFinish}
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving Result..." : "Finish Assessment"}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
            <h2 className="text-2xl font-bold text-cyan-300">
              Assessment Completed 🎉
            </h2>

            <p className="mt-4 text-slate-300">
              Your results have been sent to your clinician. They will review
              your performance and contact you with your rehabilitation plan.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-white hover:bg-white/10"
            >
              Close
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}