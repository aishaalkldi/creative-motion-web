"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  function handleFinish() {
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md md:p-8">
          <div className="inline-flex rounded-full border border-green-400/20 bg-green-400/10 px-4 py-1 text-sm font-medium text-green-300">
            Assessment Submitted
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Thank You
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Your assessment has been submitted successfully. Your clinician can now
            review the linked result from your patient profile.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Patient ID" value={patientId || "Not provided"} />
            <InfoCard
              label="Assessment ID"
              value={assessmentId || "Not provided"}
            />
          </div>

          <div className="mt-8 rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">Next Step</h2>
            <p className="mt-3 text-sm leading-7 text-white/70">
              You may now close this page. The submitted assessment is linked to
              your session record automatically.
            </p>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleFinish}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Finish
            </button>
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

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading success page...</div>}>
      <SuccessPageContent />
    </Suspense>
  );
}