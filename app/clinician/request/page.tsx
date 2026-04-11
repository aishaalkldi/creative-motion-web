"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type RemoteAssessmentType =
  | "Movement Screen"
  | "ROM Check"
  | "Balance Test"
  | "Gait Review"
  | "Outcome Measures"
  | "Voice Intake";

function RemoteRequestContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const [selectedType, setSelectedType] =
    useState<RemoteAssessmentType>("Movement Screen");
  const [generatedLink, setGeneratedLink] = useState("");

  const patientAccessLink = useMemo(() => {
    if (!patientId || !assessmentId || typeof window === "undefined") return "";

    return `${window.location.origin}/assessment?patientId=${encodeURIComponent(
      patientId
    )}&assessmentId=${encodeURIComponent(assessmentId)}`;
  }, [patientId, assessmentId]);

  const handleGenerateLink = () => {
    setGeneratedLink(patientAccessLink);
  };

  const handleCopyLink = async () => {
    if (!patientAccessLink) return;

    try {
      await navigator.clipboard.writeText(patientAccessLink);
      setGeneratedLink(patientAccessLink);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const canGenerate = Boolean(patientId && assessmentId);

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1 text-sm font-medium text-cyan-300">
            Clinician Portal
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Remote Assessment Request
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 md:text-base">
            Create and send a secure patient assessment link for remote movement
            evaluation.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Patient ID" value={patientId || "Not provided"} />
            <InfoCard
              label="Assessment ID"
              value={assessmentId || "Not provided"}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[22px] border border-white/10 bg-[#0F172A] p-5">
              <h2 className="text-xl font-semibold text-white">
                Configure request
              </h2>

              <div className="mt-5">
                <label className="mb-2 block text-sm text-slate-300">
                  Assessment Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) =>
                    setSelectedType(e.target.value as RemoteAssessmentType)
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="Movement Screen">Movement Screen</option>
                  <option value="ROM Check">ROM Check</option>
                  <option value="Balance Test">Balance Test</option>
                  <option value="Gait Review">Gait Review</option>
                  <option value="Outcome Measures">Outcome Measures</option>
                  <option value="Voice Intake">Voice Intake</option>
                </select>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={!canGenerate}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Generate Link
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!canGenerate}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy Link
                </button>
              </div>
            </section>

            <aside className="rounded-[22px] border border-white/10 bg-[#0F172A] p-5">
              <h2 className="text-xl font-semibold text-white">Request summary</h2>

              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Patient ID" value={patientId || "Not provided"} />
                <SummaryRow
                  label="Assessment ID"
                  value={assessmentId || "Not provided"}
                />
                <SummaryRow label="Type" value={selectedType} />
                <SummaryRow
                  label="Status"
                  value={canGenerate ? "Ready to send" : "Missing data"}
                />
              </div>
            </aside>
          </div>

          <div className="mt-8 rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">Patient Access Link</h2>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#0F172A] p-4">
              <p className="break-all text-sm text-cyan-300">
                {generatedLink || patientAccessLink || "No link generated yet."}
              </p>
            </div>

            {patientAccessLink ? (
              <div className="mt-4">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Please complete your assessment using this link: ${patientAccessLink}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Send via WhatsApp
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/clinician/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
            >
              Back to Dashboard
            </Link>

            <Link
              href={`/assessment?patientId=${encodeURIComponent(
                patientId
              )}&assessmentId=${encodeURIComponent(assessmentId)}`}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Preview Patient Page
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
    <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

export default function RemoteRequestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading request page...</div>}>
      <RemoteRequestContent />
    </Suspense>
  );
}