"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { assessmentsRepository } from "../../../lib/repositories";

const assessmentTests = [
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
    id: "single_leg_squat",
    title: "Single-Leg Squat (ACL)",
    description:
      "Assess single-leg control, knee alignment, pelvic stability, and trunk compensation.",
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

function InClinicAssessmentContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";
  const patientName = searchParams.get("patientName") || "Unknown Patient";

  const existingAssessment = useMemo(() => {
    if (!assessmentId) return null;
    return assessmentsRepository.getById(assessmentId);
  }, [assessmentId]);

  const [selectedTests, setSelectedTests] = useState<string[]>(
    existingAssessment?.selectedTests || []
  );
  const [generatedLink, setGeneratedLink] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const bodyRegion = existingAssessment?.bodyRegion || "Knee";
  const side = existingAssessment?.side || "Right";
  const visitType = existingAssessment?.visitType || "Follow-Up";
  const sessionLabel =
    existingAssessment?.sessionLabel || "In-Clinic Patient Session";

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

  function handleGeneratePatientLink() {
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
      const assessmentToSave =
        existingAssessment || {
          id: assessmentId,
          patientId,
          mode: "in_clinic",
          selectedTests: [],
          bodyRegion,
          side,
          visitType,
          sessionLabel,
          status: "draft",
          createdAt: new Date().toISOString(),
        };

      assessmentsRepository.update({
        ...assessmentToSave,
        patientId,
        mode: "in_clinic",
        selectedTests,
        bodyRegion,
        side,
        visitType,
        sessionLabel,
        status: "draft",
      });

      setGeneratedLink(patientAccessLink);
      setFeedback({
        type: "success",
        message: "In-clinic patient link generated and saved to draft session.",
      });
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: "Failed to generate patient link. Please try again.",
      });
    }
  }

  async function handleCopyLink() {
    if (!generatedLink && !patientAccessLink) {
      setFeedback({
        type: "error",
        message: "Generate a patient link before copying.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedLink || patientAccessLink);
      setFeedback({
        type: "success",
        message: "Patient link copied to clipboard.",
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
                In-Clinic Session Setup
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                In-Clinic Assessment
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Select PT assessments, generate secure access, and prepare an
                in-clinic patient session in a structured clinician workflow.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <MetaBadge label={`Patient ID: ${patientId || "—"}`} />
                <MetaBadge label={`Assessment ID: ${assessmentId || "—"}`} />
                <MetaBadge label={`Patient: ${patientName || "Unknown Patient"}`} />
              </div>
            </div>

            <Link
              href={
                patientId
                  ? `/clinician/patients/${patientId}`
                  : "/clinician/patients"
              }
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Patient Profile
            </Link>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">
                Select PT Assessment
              </h2>

              <p className="mt-2 text-sm leading-7 text-white/70">
                Choose one or more physical therapy assessment tests for this
                session.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assessmentTests.map((test) => {
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

                      <h3 className="text-lg font-bold text-white">
                        {test.title}
                      </h3>

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
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Selected Tests Summary</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Confirm the selected PT assessments before generating secure in-clinic access.
              </p>

              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/65">
                  {selectedTests.length > 0
                    ? `${selectedTests.length} assessment(s) selected`
                    : "No PT assessments selected yet."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTests.length > 0 ? (
                    selectedTests.map((id) => {
                      const test = assessmentTests.find((item) => item.id === id);
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
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">
                Session Summary
              </h2>

              <div className="mt-5 space-y-4">
                <SummaryCard label="Session Label" value={sessionLabel} />
                <SummaryCard label="Mode" value="In-Clinic Patient Session" />
                <SummaryCard
                  label="Selected Tests"
                  value={selectedTests.length ? String(selectedTests.length) : "0"}
                />
              </div>

              <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-base font-semibold text-cyan-300">Patient Link</h3>
                <p className="mt-2 text-sm text-white/65">
                  Generate and share the in-clinic session link with the patient device.
                </p>
                <div className="mt-4 rounded-xl border border-white/10 bg-[#123a8a]/25 px-4 py-3 text-sm text-white/80 break-all">
                  {generatedLink || "No link generated yet."}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleGeneratePatientLink}
                    className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Generate In-Clinic Link
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
                  Recommended Flow
                </h3>

                <ol className="mt-4 space-y-2 text-sm text-white/70">
                  <li>1. Select PT assessment</li>
                  <li>2. Generate patient link</li>
                  <li>3. Send to patient device</li>
                  <li>4. Patient starts session</li>
                  <li>5. Patient submits assessment</li>
                  <li>6. Result returns to patient profile</li>
                </ol>
              </div>
            </section>
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

export default function InClinicAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading session setup...</div>}>
      <InClinicAssessmentContent />
    </Suspense>
  );
}