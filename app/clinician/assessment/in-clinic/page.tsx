"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
} from "../../../lib/assessments-storage";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";
  const patientName = searchParams.get("patientName") || "Unknown Patient";

  const existingAssessment = useMemo(() => {
    if (!assessmentId) return null;
    return getAssessmentById(assessmentId);
  }, [assessmentId]);

  const [selectedTests, setSelectedTests] = useState<string[]>(
    existingAssessment?.selectedTests || []
  );
  const [saving, setSaving] = useState(false);

  const bodyRegion = existingAssessment?.bodyRegion || "Knee";
  const side = existingAssessment?.side || "Right";
  const visitType = existingAssessment?.visitType || "Follow-Up";
  const sessionLabel = existingAssessment?.sessionLabel || "In-Clinic Assessment";

  function toggleTest(testId: string) {
    setSelectedTests((prev) =>
      prev.includes(testId)
        ? prev.filter((id) => id !== testId)
        : [...prev, testId]
    );
  }

  function handleLaunchAssessment() {
    if (!patientId || !assessmentId) {
      alert("Missing patient or assessment data");
      return;
    }

    if (selectedTests.length === 0) {
      alert("Please select at least one PT assessment");
      return;
    }

    try {
      setSaving(true);

      const assessmentToSave =
        existingAssessment ||
        ({
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
        } as const);

      saveAssessmentToStorage({
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

      router.push(
        `/body-axis-ai?patientId=${encodeURIComponent(
          patientId
        )}&assessmentId=${encodeURIComponent(
          assessmentId
        )}&patientName=${encodeURIComponent(
          patientName
        )}&test=${encodeURIComponent(selectedTests[0])}`
      );
    } catch (error) {
      console.error(error);
      alert("Failed to save in-clinic assessment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Clinician Portal
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              In-Clinic Assessment
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Select one or more physical therapy assessments for this session,
              then launch the active AI-assisted test flow.
            </p>
          </div>

          <Link
            href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Patient Profile
          </Link>
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
              <h2 className="text-2xl font-bold text-white">Assessment Scope</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoCard label="Patient Name" value={patientName || "—"} />
                <InfoCard label="Patient ID" value={patientId || "—"} />
                <InfoCard label="Assessment ID" value={assessmentId || "—"} />
                <InfoCard label="Body Region" value={bodyRegion} />
                <InfoCard label="Side" value={side} />
                <InfoCard label="Visit Type" value={visitType} />
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
                <SummaryCard label="Mode" value="In-Clinic Guided Assessment" />
                <SummaryCard
                  label="Selected Tests"
                  value={selectedTests.length ? String(selectedTests.length) : "0"}
                />
              </div>

              <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-base font-semibold text-cyan-300">
                  Selected PT Assessments
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
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
                    <p className="text-sm text-white/60">
                      No assessment selected yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-base font-semibold text-cyan-300">
                  Recommended Flow
                </h3>

                <ol className="mt-4 space-y-2 text-sm text-white/70">
                  <li>1. Select PT assessment</li>
                  <li>2. Confirm assessment details</li>
                  <li>3. Launch active test screen</li>
                  <li>4. Capture movement analysis</li>
                  <li>5. Review result summary</li>
                  <li>6. Save findings to patient record</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={handleLaunchAssessment}
                disabled={saving}
                className="mt-6 w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Launch AI Assessment"}
              </button>
            </section>
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

export default function InClinicAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading...</div>}>
      <InClinicAssessmentContent />
    </Suspense>
  );
}