"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { assessmentsRepository } from "../../../lib/repositories";

function StartAssessmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const [feedback, setFeedback] = useState<{
    type: "idle" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  function handleStartInClinic() {
    if (!patientId) {
      setFeedback({
        type: "error",
        message: "No patient context found. Open this flow from a patient profile.",
      });
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

    router.push(
      `/clinician/assessment/in-clinic?patientId=${patientId}&assessmentId=${assessmentId}`
    );
  }

  function handleStartRemote() {
    if (!patientId) {
      setFeedback({
        type: "error",
        message: "No patient context found. Open this flow from a patient profile.",
      });
      return;
    }

    const assessmentId = assessmentsRepository.newAssessmentId();

    assessmentsRepository.create({
      id: assessmentId,
      patientId,
      mode: "remote",
      selectedTests: [],
      bodyRegion: "Full Body",
      side: "Not Applicable",
      visitType: "Follow-Up",
      sessionLabel: "Remote Assessment Request",
      createdAt: new Date().toISOString(),
    });

    router.push(
      `/clinician/request?patientId=${patientId}&assessmentId=${assessmentId}`
    );
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Assessment Mode Setup
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                Start Assessment
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Choose the appropriate mode to continue the clinician workflow for this patient.
              </p>

              <div className="mt-4">
                <MetaBadge label={`Patient ID: ${patientId || "—"}`} />
              </div>
            </div>

            <Link
              href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Patient Profile
            </Link>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">
              Choose Assessment Mode
            </h2>

            <p className="mt-2 text-sm leading-7 text-white/70">
              Select the right path based on where and how the patient will
              complete the assessment.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-cyan-300/18 bg-[#123a8a]/25 p-5 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35">
                <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                  Assessment Mode
                </div>

                <h3 className="text-xl font-bold text-white">
                  In-Clinic Guided Assessment
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/70">
                  Perform the assessment now inside the clinic with the patient
                  present. Best for observation, ROM, functional testing, and
                  guided AI vision assessment.
                </p>

                <ul className="mt-4 space-y-2 text-sm text-white/65">
                  <li>• Direct clinician-supervised workflow</li>
                  <li>• Saves findings into the patient file</li>
                  <li>• Best for real-time evaluation</li>
                </ul>

                <button
                  type="button"
                  onClick={handleStartInClinic}
                  className="mt-6 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Start In-Clinic Assessment
                </button>
              </div>

              <div className="rounded-[24px] border border-cyan-300/18 bg-[#123a8a]/25 p-5 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35">
                <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                  Assessment Mode
                </div>

                <h3 className="text-xl font-bold text-white">
                  Remote Assessment Request
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/70">
                  Create a secure assessment request for the patient to complete
                  remotely on phone, tablet, or computer.
                </p>

                <ul className="mt-4 space-y-2 text-sm text-white/65">
                  <li>• Generates a patient-ready assessment flow</li>
                  <li>• Ideal for remote follow-up and check-ins</li>
                  <li>• Returns results to the clinician workflow</li>
                </ul>

                <button
                  type="button"
                  onClick={handleStartRemote}
                  className="mt-6 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Create Remote Assessment
                </button>
              </div>
            </div>

            {feedback.type === "error" && (
              <div className="mt-5 rounded-[20px] border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100">
                {feedback.message}
              </div>
            )}
          </div>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Assessment Scope</h2>

            <div className="mt-5 space-y-4">
              <SummaryCard
                label="In-Clinic"
                value="Observation, ROM, Functional Assessment, AI Vision"
              />
              <SummaryCard
                label="Remote"
                value="AI Vision, Outcome Measures, Voice Intake"
              />
              <SummaryCard
                label="Patient ID"
                value={patientId || "—"}
              />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Recommended Flow
              </h3>

              <ol className="mt-4 space-y-2 text-sm text-white/70">
                <li>1. Open patient profile</li>
                <li>2. Start assessment</li>
                <li>3. Choose In-Clinic or Remote</li>
                <li>4. Save findings or send request</li>
                <li>5. Review results</li>
                <li>6. Assign program</li>
                <li>7. Track progress</li>
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
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

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
      {label}
    </span>
  );
}

export default function StartAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading assessment setup...</div>}>
      <StartAssessmentPageContent />
    </Suspense>
  );
}