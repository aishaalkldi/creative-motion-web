"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAssessmentById } from "../lib/assessments-storage";

function formatTestLabel(testId: string) {
  switch (testId) {
    case "posture":
      return "Postural Assessment";
    case "gait":
      return "Gait Assessment";
    case "balance":
      return "Balance Assessment";
    case "squat":
      return "Squat Assessment";
    case "rom":
      return "ROM Assessment";
    default:
      return "Assessment";
  }
}

function PatientAssessmentContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const assessment = assessmentId ? getAssessmentById(assessmentId) : null;
  const firstTest = assessment?.selectedTests?.[0] || "posture";

  const canStart = Boolean(patientId && assessmentId);

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md md:p-8">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1 text-sm font-medium text-cyan-300">
            Creative Motion Assessment
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Assessment Session
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Please review your session details below, then begin the assessment when
            you are ready.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Patient ID" value={patientId || "Not provided"} />
            <InfoCard
              label="Assessment ID"
              value={assessmentId || "Not provided"}
            />
          </div>

          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm text-white/60">Assigned Assessment</p>
            <p className="mt-2 text-base font-semibold text-white">
              {formatTestLabel(firstTest)}
            </p>
          </div>

          {!canStart && (
            <div className="mt-6 rounded-[20px] border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              Session context is incomplete. Please open this page from a valid patient assessment link.
            </div>
          )}

          <div className="mt-8 rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">Before you begin</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-white/70">
              <li>• Make sure you have enough space to move safely.</li>
              <li>• Place your device where your body can be seen clearly.</li>
              <li>• Allow camera access when requested.</li>
              <li>• Follow the on-screen instructions carefully.</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {canStart ? (
              <Link
                href={`/body-axis-ai?patientId=${encodeURIComponent(
                  patientId
                )}&assessmentId=${encodeURIComponent(
                  assessmentId
                )}&test=${encodeURIComponent(firstTest)}`}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Start Assessment
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white/50"
              >
                Missing Assessment Data
              </button>
            )}

            <Link
              href="/login"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}

export default function PatientAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading assessment session...</div>}>
      <PatientAssessmentContent />
    </Suspense>
  );
}