"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { assessmentsRepository } from "../../../lib/repositories";

function StartAssessmentPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const patientId    = searchParams.get("patientId") || "";

  const [feedback, setFeedback] = useState<{ type: "idle" | "error"; message: string }>({
    type: "idle", message: "",
  });

  function handleStartInClinic() {
    if (!patientId) {
      setFeedback({ type: "error", message: "No patient context found. Open this flow from a patient profile." });
      return;
    }
    const assessmentId = assessmentsRepository.newAssessmentId();
    assessmentsRepository.create({
      id: assessmentId,
      patientId,
      mode: "in_clinic",
      selectedTests: [],
      bodyRegion: "Knee",
      side: "Right",
      visitType: "Follow-Up",
      sessionLabel: "New Assessment",
      createdAt: new Date().toISOString(),
    });
    router.push(`/clinician/assessment/in-clinic?patientId=${patientId}&assessmentId=${assessmentId}`);
  }

  function handleStartRemote() {
    if (!patientId) {
      setFeedback({ type: "error", message: "No patient context found. Open this flow from a patient profile." });
      return;
    }
    router.push(`/clinician/patients/${patientId}?openRemoteAssessment=1`);
  }

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-8" style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}>
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-7 flex items-center justify-between">
          <div>
            <Link
              href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
              className="text-xs font-semibold text-white/35 transition hover:text-white/70"
            >
              ← Back to Patient Profile
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-[5px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-2.5 py-1 text-[11px] font-semibold text-[#5DCAA5]">
                Assessment Setup
              </span>
              {patientId && (
                <span className="rounded-[5px] border border-[#1E2D42] bg-[#0F1825] px-2.5 py-1 text-[11px] text-white/35">
                  Patient ID: {patientId}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-white">Start Assessment</h1>
            <p className="mt-0.5 text-sm text-white/45">
              Choose the appropriate mode to continue the clinical workflow.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_320px]">

          {/* In-clinic card */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 transition hover:border-[#1D9E75]/30">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[7px] border border-[#1E2D42] bg-[#0B1220] text-[#5DCAA5]">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
              </span>
              <span className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-0.5 text-[10px] font-semibold text-white/35">
                In-Clinic
              </span>
            </div>

            <h2 className="text-base font-bold text-white">In-Clinic Guided Assessment</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Perform the assessment now with the patient present. Best for observation, ROM, functional testing, and guided AI vision.
            </p>

            <ul className="mt-4 space-y-1.5">
              {[
                "Direct clinician-supervised workflow",
                "Saves findings into the patient file",
                "Best for real-time evaluation",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/45">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1D9E75]" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleStartInClinic}
              className="mt-6 flex w-full items-center justify-center rounded-[8px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
            >
              Start In-Clinic Assessment
            </button>
          </div>

          {/* Remote card */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 transition hover:border-[#1D9E75]/30">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[7px] border border-[#1E2D42] bg-[#0B1220] text-[#5DCAA5]">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </span>
              <span className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-0.5 text-[10px] font-semibold text-white/35">
                Remote
              </span>
            </div>

            <h2 className="text-base font-bold text-white">Remote Assessment Request</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Create a secure assessment link for the patient to complete remotely on phone, tablet, or computer.
            </p>

            <ul className="mt-4 space-y-1.5">
              {[
                "Generates a patient-ready assessment link",
                "Ideal for remote follow-up and check-ins",
                "Returns results to the clinician workflow",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/45">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5DCAA5]/60" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleStartRemote}
              className="mt-6 flex w-full items-center justify-center rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:border-[#1D9E75]/30 hover:text-white"
            >
              Create Remote Assessment
            </button>
          </div>

          {/* Aside — recommended flow */}
          <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
            <h3 className="mb-4 text-sm font-bold text-white">Recommended Flow</h3>
            <ol className="space-y-3">
              {[
                "Open patient profile",
                "Start assessment",
                "In-Clinic or Remote",
                "Save or send request",
                "Review results",
                "Assign program",
                "Track progress",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1220] text-[10px] font-bold text-white/30 border border-[#1E2D42]">
                    {i + 1}
                  </span>
                  <span className="text-xs text-white/45">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-5 space-y-1.5 border-t border-[#1E2D42] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Assessment scope</p>
              {[
                { label: "In-Clinic",   value: "Observation · ROM · AI Vision" },
                { label: "Remote",      value: "Outcome measures · Self-report" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-[7px] border border-[#1E2D42] px-3 py-2">
                  <p className="text-[11px] text-white/40">{label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-white/55">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Error banner */}
        {feedback.type === "error" && (
          <div className="mt-5 rounded-[8px] border border-amber-400/20 bg-amber-400/8 px-5 py-3.5 text-sm text-amber-200">
            {feedback.message}
          </div>
        )}
      </div>
    </main>
  );
}

export default function StartAssessmentPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0B1220]">
        <p className="text-sm text-white/30">Loading assessment setup…</p>
      </div>
    }>
      <StartAssessmentPageContent />
    </Suspense>
  );
}
