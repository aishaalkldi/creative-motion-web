"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PatientAssessmentContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const canStart = Boolean(patientId && assessmentId);

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-8 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
            Patient Assessment
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Assessment Session
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Your clinician has sent you a movement assessment request. Please
            complete this session using your phone, tablet, or computer.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Patient ID" value={patientId || "Not provided"} />
            <InfoCard
              label="Assessment ID"
              value={assessmentId || "Not provided"}
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {canStart ? (
              <Link
                href={`/body-axis-ai?patientId=${encodeURIComponent(
                  patientId
                )}&assessmentId=${encodeURIComponent(assessmentId)}`}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-center font-semibold text-black transition hover:scale-[1.02]"
              >
                Start Assessment
              </Link>
            ) : (
              <button
                disabled
                className="cursor-not-allowed rounded-xl bg-white/10 px-5 py-3 text-center font-semibold text-white/50"
              >
                Missing Assessment Data
              </button>
            )}

            <Link
              href="/login"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PatientAssessmentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-8 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Patient Assessment
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                Loading Assessment...
              </h1>

              <p className="mt-4 text-sm leading-7 text-white/70 md:text-base">
                Please wait while we load your assessment session.
              </p>
            </div>
          </div>
        </main>
      }
    >
      <PatientAssessmentContent />
    </Suspense>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}