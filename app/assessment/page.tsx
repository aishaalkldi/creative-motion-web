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
            Complete Your Assessment
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Your clinician has sent you a movement assessment request. Please
            complete this session using your phone, tablet, or computer.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Patient ID" value={patientId || "Not available"} />
            <InfoCard
              label="Assessment ID"
              value={assessmentId || "Not available"}
            />
          </div>

          <div className="mt-8 rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">
              Before you begin
            </h2>

            <ul className="mt-4 space-y-2 text-sm leading-7 text-white/70">
              <li>• Make sure you have enough space to move safely.</li>
              <li>• Place your device where your body can be seen clearly.</li>
              <li>• Allow camera access when requested.</li>
              <li>• Follow the on-screen instructions carefully.</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {canStart ? (
              <Link
                href={`/body-axis-ai?patientId=${patientId}&assessmentId=${assessmentId}`}
                className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Start Assessment
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-2xl bg-white/10 px-6 py-3 font-semibold text-white/50"
              >
                Missing Assessment Data
              </button>
            )}
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
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}