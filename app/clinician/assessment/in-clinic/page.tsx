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
    const origin = window.location.origin;
    if (selectedTests.includes("squat")) {
      return `${origin}/body-axis-ai?patientId=${encodeURIComponent(
        patientId
      )}&assessmentId=${encodeURIComponent(
        assessmentId
      )}&test=${encodeURIComponent("squat")}`;
    }
    return `${origin}/assessment?patientId=${encodeURIComponent(
      patientId
    )}&assessmentId=${encodeURIComponent(assessmentId)}`;
  }, [patientId, assessmentId, selectedTests]);

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
    <main className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-[6px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                In-Clinic Session Setup
              </div>

              <h1 className="mt-4 text-2xl font-bold text-white">
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

            <div className="flex flex-col gap-2 sm:items-end">
              {patientId && assessmentId ? (
                <Link
                  href={`/clinician/assessment/workflow?patientId=${encodeURIComponent(patientId)}&assessmentId=${encodeURIComponent(assessmentId)}`}
                  className="rounded-[7px] bg-[#1D9E75] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#179165]"
                >
                  Full clinical workflow
                </Link>
              ) : null}
              <Link
                href={
                  patientId
                    ? `/clinician/patients/${patientId}`
                    : "/clinician/patients"
                }
                className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-5 py-2.5 text-center text-sm font-semibold text-white/60 transition hover:text-white"
              >
                ← Back to Patient Profile
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-base font-bold text-white">
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
                      className={`rounded-[8px] border p-4 text-left transition ${
                        isSelected
                          ? "border-[#1D9E75]/40 bg-[#1D9E75]/10"
                          : "border-[#1E2D42] bg-[#0B1220] hover:border-[#1D9E75]/20"
                      }`}
                    >
                      <div className="mb-3 inline-flex rounded-[5px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-2.5 py-1 text-[11px] font-semibold text-[#5DCAA5]">
                        PT Assessment
                      </div>

                      <h3 className="text-lg font-bold text-white">
                        {test.title}
                      </h3>

                      <p className="mt-3 text-sm leading-7 text-white/70">
                        {test.description}
                      </p>

                      <div className="mt-3">
                        <span className={`inline-flex rounded-[5px] px-2.5 py-1 text-xs font-semibold ${
                          isSelected ? "bg-[#1D9E75] text-white" : "bg-[#1E2D42] text-white/50"
                        }`}>
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-base font-bold text-white">Selected Tests Summary</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Confirm the selected PT assessments before generating secure in-clinic access.
              </p>

              <div className="mt-4 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
                <p className="text-sm text-white/50">
                  {selectedTests.length > 0 ? `${selectedTests.length} assessment(s) selected` : "No PT assessments selected yet."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTests.length > 0 ? (
                    selectedTests.map((id) => {
                      const test = assessmentTests.find((item) => item.id === id);
                      return (
                        <span key={id} className="rounded-[5px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-2.5 py-1 text-xs font-semibold text-[#5DCAA5]">
                          {test?.title || id}
                        </span>
                      );
                    })
                  ) : (
                    <p className="text-sm text-white/35">Select tests above to continue.</p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-base font-bold text-white">
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

              <div className="mt-6 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
                <h3 className="text-sm font-semibold text-[#5DCAA5]">Patient Link</h3>
                <p className="mt-2 text-sm text-white/65">
                  Generate and share the in-clinic session link with the patient device.
                </p>
                <div className="mt-4 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-sm text-white/60 break-all font-mono">
                  {generatedLink || "No link generated yet."}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleGeneratePatientLink}
                    className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
                  >
                    Generate In-Clinic Link
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={!generatedLink && !patientAccessLink}
                    className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy Link
                  </button>
                </div>

                {feedback.type !== "idle" && (
                  <p className={`mt-3 rounded-[7px] border px-3 py-2 text-sm ${
                    feedback.type === "success"
                      ? "border-[#1D9E75]/25 bg-[#1D9E75]/8 text-[#5DCAA5]"
                      : "border-rose-300/20 bg-rose-400/8 text-rose-300"
                  }`}>
                    {feedback.message}
                  </p>
                )}
              </div>

              <div className="mt-6 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
                <h3 className="text-sm font-semibold text-[#5DCAA5]">
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
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
      <p className="text-[11px] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="rounded-[5px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-2.5 py-1 text-[11px] font-semibold text-[#5DCAA5]">
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