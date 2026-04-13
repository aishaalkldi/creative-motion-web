"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { assessmentsRepository } from "../../lib/repositories";

const remoteAssessmentTests = [
  {
    id: "posture",
    title: "Postural Assessment",
    description:
      "Assess posture alignment, body symmetry, and static standing position.",
  },
  {
    id: "gait",
    title: "Gait Assessment",
    description:
      "Assess walking pattern, symmetry, and trunk control during gait.",
  },
  {
    id: "balance",
    title: "Balance Assessment",
    description:
      "Assess postural stability, single-leg control, and balance performance.",
  },
  {
    id: "squat",
    title: "Squat Assessment",
    description:
      "Assess lower-limb alignment, control, and movement quality during squat.",
  },
  {
    id: "rom",
    title: "ROM Assessment",
    description:
      "Assess estimated joint range of motion during guided movement tasks.",
  },
  {
    id: "reach",
    title: "Reach Test",
    description:
      "Assess functional reach, control, and movement strategy.",
  },
  {
    id: "sit_to_stand",
    title: "Sit-to-Stand Assessment",
    description:
      "Assess transitional movement, lower-limb control, and functional strength.",
  },
  {
    id: "compensation",
    title: "Compensation Analysis",
    description:
      "Identify compensatory movement patterns, asymmetry, and movement substitutions.",
  },
];

function RemoteRequestContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";
  const patientName = searchParams.get("patientName") || "";

  const existingAssessment = assessmentId
    ? assessmentsRepository.getById(assessmentId)
    : null;

  const [selectedTests, setSelectedTests] = useState<string[]>(
    existingAssessment?.selectedTests || []
  );
  const [generatedLink, setGeneratedLink] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const patientAccessLink = useMemo(() => {
    if (!patientId || !assessmentId || typeof window === "undefined") return "";
    return `${window.location.origin}/assessment?patientId=${encodeURIComponent(
      patientId
    )}&assessmentId=${encodeURIComponent(assessmentId)}`;
  }, [patientId, assessmentId]);

  function toggleTest(testId: string) {
    setSelectedTests((prev) =>
      prev.includes(testId)
        ? prev.filter((id) => id !== testId)
        : [...prev, testId]
    );
  }

  function handleGenerateLink() {
    if (!patientId || !assessmentId) {
      setFeedback({
        type: "error",
        message: "Missing patient or assessment context.",
      });
      return;
    }

    if (selectedTests.length === 0) {
      setFeedback({
        type: "error",
        message: "Select at least one PT assessment before generating a link.",
      });
      return;
    }

    try {
      const baseAssessment =
        existingAssessment || {
          id: assessmentId,
          patientId,
          mode: "remote" as const,
          selectedTests: [],
          bodyRegion: "Full Body",
          side: "Not Applicable",
          visitType: "Follow-Up",
          sessionLabel: "Remote Assessment Request",
          status: "draft" as const,
          createdAt: new Date().toISOString(),
        };

      assessmentsRepository.update({
        ...baseAssessment,
        patientId,
        mode: "remote",
        selectedTests,
        bodyRegion: baseAssessment.bodyRegion || "Full Body",
        side: baseAssessment.side || "Not Applicable",
        visitType: baseAssessment.visitType || "Follow-Up",
        sessionLabel: "Remote Patient Session",
        status: "draft",
      });

      setGeneratedLink(patientAccessLink);
      setFeedback({
        type: "success",
        message: "Secure link generated and saved to assessment draft.",
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: "Failed to generate secure link. Please try again.",
      });
    }
  }

  async function handleCopyLink() {
    const finalLink = generatedLink || patientAccessLink;
    if (!finalLink) {
      setFeedback({
        type: "error",
        message: "Generate a secure link before copying.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(finalLink);
      setFeedback({
        type: "success",
        message: "Secure link copied to clipboard.",
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: "Failed to copy link. Please copy manually.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Remote Assessment Setup
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                Generate Secure Patient Link
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Select PT assessments, generate secure access, and prepare the patient’s
                remote session in a structured clinician workflow.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <MetaBadge label={`Patient ID: ${patientId || "—"}`} />
                <MetaBadge label={`Assessment ID: ${assessmentId || "—"}`} />
                {patientName ? <MetaBadge label={`Patient: ${patientName}`} /> : null}
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
          <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">
              Select PT Assessments
            </h2>

            <p className="mt-2 text-sm leading-7 text-white/70">
              Choose one or more physical therapy assessments for this remote session.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {remoteAssessmentTests.map((test) => {
                const isSelected = selectedTests.includes(test.id);

                return (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => toggleTest(test.id)}
                    className={`rounded-[24px] border p-5 text-left transition ${
                      isSelected
                        ? "border-cyan-300 bg-cyan-400/10"
                        : "border-cyan-300/18 bg-[#123a8a]/25 hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                    }`}
                  >
                    <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                      PT Assessment
                    </div>

                    <h3 className="text-lg font-bold text-white">{test.title}</h3>

                    <p className="mt-3 text-sm leading-7 text-white/70">
                      {test.description}
                    </p>

                    <div className="mt-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          isSelected
                            ? "bg-cyan-400 text-slate-950"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        {isSelected ? "Selected" : "Tap to select"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">Selected Tests Summary</h3>
              <p className="mt-2 text-sm text-white/65">
                {selectedTests.length > 0
                  ? `${selectedTests.length} assessment(s) selected`
                  : "No PT assessments selected yet."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTests.length > 0 ? (
                  selectedTests.map((id) => {
                    const test = remoteAssessmentTests.find((item) => item.id === id);
                    return (
                      <span
                        key={id}
                        className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
                      >
                        {test?.title || id}
                      </span>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/55">Select tests above to continue.</p>
                )}
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Request Summary</h2>

            <div className="mt-5 space-y-4">
              <InfoCard label="Patient ID" value={patientId || "—"} />
              <InfoCard label="Assessment ID" value={assessmentId || "—"} />
              <InfoCard
                label="Selected Tests"
                value={selectedTests.length ? String(selectedTests.length) : "0"}
              />
              <InfoCard label="Status" value={generatedLink ? "Ready" : "Draft"} />
              <InfoCard label="Access" value="Phone / Tablet / Computer" />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">Secure Link</h3>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#123a8a]/25 px-4 py-3 text-sm text-white/80 break-all">
                {generatedLink || "No link generated yet."}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Generate Secure Link
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!generatedLink && !patientAccessLink}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5"
                >
                  Copy Link
                </button>
              </div>

              {feedback.type !== "idle" && (
                <p
                  className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                    feedback.type === "success" ? "text-cyan-200" : "text-rose-200"
                  } ${
                    feedback.type === "success"
                      ? "border-cyan-300/20 bg-cyan-400/10"
                      : "border-rose-300/20 bg-rose-400/10"
                  }`}
                >
                  {feedback.message}
                </p>
              )}
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Remote Workflow
              </h3>

              <ol className="mt-4 space-y-2 text-sm text-white/70">
                <li>1. Select PT assessments</li>
                <li>2. Generate secure link</li>
                <li>3. Send to patient</li>
                <li>4. Patient opens landing page</li>
                <li>5. Patient starts session</li>
                <li>6. Patient submits assessment</li>
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

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
      {label}
    </span>
  );
}

export default function RemoteRequestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading...</div>}>
      <RemoteRequestContent />
    </Suspense>
  );
}