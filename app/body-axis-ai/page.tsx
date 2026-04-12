"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
} from "../lib/assessments-storage";

function BodyAxisAIPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "UNKNOWN";
  const patientName = searchParams.get("patientName") || "Unknown Patient";
  const test = searchParams.get("test") || "squat";
  const assessmentId = searchParams.get("assessmentId") || "";

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const finalScore = 85;

  const handleGenerateMockResult = async () => {
    try {
      setLoading(true);

      if (!assessmentId) {
        throw new Error("Missing assessmentId");
      }

      const existingAssessment = getAssessmentById(assessmentId);

      if (!existingAssessment) {
        throw new Error(`Assessment not found: ${assessmentId}`);
      }

      const existingTests = Array.isArray(existingAssessment.selectedTests)
        ? existingAssessment.selectedTests
        : [];

      const updatedTests = existingTests.includes(test)
        ? existingTests
        : [...existingTests, test];

      saveAssessmentToStorage({
        ...existingAssessment,
        patientId,
        status: "completed",
        selectedTests: updatedTests,
        score: finalScore,
      });

      setSaved(true);

      router.push(
        `/results?patientId=${encodeURIComponent(
          patientId
        )}&assessmentId=${encodeURIComponent(assessmentId)}`
      );
    } catch (error) {
      console.error(error);
      alert("Failed to save result ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Body Axis AI
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">
            {formatTestTitle(test)}
          </h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            AI-assisted assessment linked directly to the patient file number for
            structured clinical review and progress tracking.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.55fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Assessment Instructions
            </h2>

            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-5">
              <p className="text-slate-300">{getInstructionByTest(test)}</p>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-10 text-center">
              <p className="text-lg font-semibold text-cyan-300">
                Camera / Video Input Placeholder
              </p>
              <p className="mt-2 text-sm text-slate-400">
                In the next stage, this section can connect to live camera,
                uploaded video, or AI motion analysis output.
              </p>
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">
              Assessment Info
            </h2>

            <div className="space-y-4">
              <InfoBox label="Patient Name" value={patientName} />
              <InfoBox label="File Number" value={patientId} />
              <InfoBox label="Assessment ID" value={assessmentId || "Not provided"} />
              <InfoBox label="Test Type" value={formatTestTitle(test)} />
            </div>

            <button
              onClick={handleGenerateMockResult}
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving Result..." : "Generate Mock Result"}
            </button>

            <Link
              href={`/clinician/patients/${encodeURIComponent(patientId)}`}
              className="mt-3 block w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
            >
              Back to Patient Profile
            </Link>

            {saved && (
              <div className="mt-4 rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
                <p className="text-sm text-green-300">
                  Result saved successfully to file number {patientId}.
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Score: <span className="font-semibold text-white">{finalScore}%</span>
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoBox({
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

function formatTestTitle(test: string) {
  switch (test) {
    case "gait":
      return "Gait Screening";
    case "balance":
      return "Balance Test";
    case "squat":
      return "Squat Analysis";
    case "posture":
      return "Posture Analysis";
    default:
      return "Assessment";
  }
}

function getInstructionByTest(test: string) {
  switch (test) {
    case "gait":
      return "Ask the patient to walk naturally while the system evaluates gait pattern and lower-limb control.";
    case "balance":
      return "Ask the patient to maintain balance in the required position while stability and postural control are reviewed.";
    case "squat":
      return "Ask the patient to perform a controlled squat while alignment, compensation, and movement quality are reviewed.";
    case "posture":
      return "Ask the patient to stand naturally while posture alignment and body symmetry are assessed.";
    default:
      return "Ask the patient to follow the assessment instructions while the system captures movement performance.";
  }
}

export default function BodyAxisAIPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading...</div>}>
      <BodyAxisAIPageContent />
    </Suspense>
  );
}