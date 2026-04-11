"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AssessmentSuccessPage() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-8 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
            Assessment Submitted
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Thank You
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Your assessment has been submitted successfully. Your clinician will review the result and continue your rehabilitation plan.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Patient ID" value={patientId || "—"} />
            <InfoCard label="Assessment ID" value={assessmentId || "—"} />
          </div>

          <div className="mt-8">
            <Link
              href="/assessment"
              className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Finish
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
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}