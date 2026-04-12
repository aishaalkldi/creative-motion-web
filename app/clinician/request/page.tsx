"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
} from "../../lib/assessments-storage";

type RemoteAssessmentType =
  | "AI Vision Assessment"
  | "Balance Test"
  | "Gait Assessment"
  | "ROM Assessment"
  | "Postural Assessment";

function mapRemoteTypeToTest(type: RemoteAssessmentType): string {
  switch (type) {
    case "Balance Test":
      return "balance";
    case "Gait Assessment":
      return "gait";
    case "ROM Assessment":
      return "rom";
    case "Postural Assessment":
      return "posture";
    case "AI Vision Assessment":
    default:
      return "posture";
  }
}

function RemoteRequestContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const existingAssessment = assessmentId
    ? getAssessmentById(assessmentId)
    : null;

  const [selectedType, setSelectedType] =
    useState<RemoteAssessmentType>("AI Vision Assessment");
  const [generatedLink, setGeneratedLink] = useState("");

  const selectedTest = mapRemoteTypeToTest(selectedType);

  const patientAccessLink = useMemo(() => {
    if (!patientId || !assessmentId || typeof window === "undefined") return "";

    return `${window.location.origin}/assessment?patientId=${encodeURIComponent(
      patientId
    )}&assessmentId=${encodeURIComponent(assessmentId)}`;
  }, [patientId, assessmentId]);

  function handleGenerateLink() {
    if (!patientId || !assessmentId) {
      alert("Missing patient or assessment data");
      return;
    }

    try {
      const baseAssessment =
        existingAssessment || {
          id: assessmentId,
          patientId,
          mode: "remote",
          selectedTests: [],
          bodyRegion: "Full Body",
          side: "Not Applicable",
          visitType: "Follow-Up",
          sessionLabel: "Remote Assessment Request",
          status: "draft",
          createdAt: new Date().toISOString(),
        };

      saveAssessmentToStorage({
        ...baseAssessment,
        patientId,
        mode: "remote",
        selectedTests: [selectedTest],
        bodyRegion: baseAssessment.bodyRegion || "Full Body",
        side: baseAssessment.side || "Not Applicable",
        visitType: baseAssessment.visitType || "Follow-Up",
        sessionLabel: selectedType,
        status: "draft",
      });

      setGeneratedLink(patientAccessLink);
    } catch (error) {
      console.error(error);
      alert("Failed to generate remote assessment link");
    }
  }

  async function handleCopyLink() {
    if (!generatedLink && !patientAccessLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink || patientAccessLink);
      alert("Link copied successfully");
    } catch (error) {
      console.error(error);
      alert("Failed to copy link");
    }
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Remote Assessment
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              Create Assessment Request
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Configure a remote assessment request and generate a secure link for
              the patient to complete on phone, tablet, or computer.
            </p>

            <p className="mt-3 text-sm text-white/60">
              Patient ID: {patientId || "—"} | Assessment ID: {assessmentId || "—"}
            </p>
          </div>

          <Link
            href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Patient Profile
          </Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.85fr]">
          <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Request Configuration</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Remote Assessment Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) =>
                    setSelectedType(e.target.value as RemoteAssessmentType)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#123a8a]/25 px-4 py-3 text-white outline-none"
                >
                  <option value="AI Vision Assessment">AI Vision Assessment</option>
                  <option value="Postural Assessment">Postural Assessment</option>
                  <option value="Balance Test">Balance Test</option>
                  <option value="Gait Assessment">Gait Assessment</option>
                  <option value="ROM Assessment">ROM Assessment</option>
                </select>
              </div>

              <InfoCard label="Link Status" value={generatedLink ? "Ready" : "Draft"} />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Generated Link
              </h3>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#123a8a]/25 px-4 py-3 text-sm text-white/80 break-all">
                {generatedLink || "No link generated yet"}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Generate Link
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Copy Link
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Request Summary</h2>

            <div className="mt-5 space-y-4">
              <InfoCard label="Patient ID" value={patientId || "—"} />
              <InfoCard label="Assessment ID" value={assessmentId || "—"} />
              <InfoCard label="Request Type" value={selectedType} />
              <InfoCard label="Status" value={generatedLink ? "Ready" : "Draft"} />
              <InfoCard label="Access" value="Phone / Tablet / Computer" />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Remote Workflow
              </h3>

              <ol className="mt-4 space-y-2 text-sm text-white/70">
                <li>1. Configure remote assessment</li>
                <li>2. Generate secure link</li>
                <li>3. Send to patient manually</li>
                <li>4. Patient opens link</li>
                <li>5. Patient starts assessment</li>
                <li>6. AI screen opens with linked test</li>
              </ol>
            </div>
          </aside>
        </section>
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

export default function RemoteRequestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading...</div>}>
      <RemoteRequestContent />
    </Suspense>
  );
}