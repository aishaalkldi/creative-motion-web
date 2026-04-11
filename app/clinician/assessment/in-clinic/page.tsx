"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
  type StoredAssessment,
} from "../../../lib/assessments-storage";

const AVAILABLE_TESTS = [
  {
    key: "Observation",
    title: "Observation",
    description:
      "Visual clinical review for posture, swelling, asymmetry, and movement quality.",
  },
  {
    key: "ROM Assessment",
    title: "ROM Assessment",
    description:
      "Document active and passive range of motion findings for the selected joint.",
  },
  {
    key: "Functional Assessment",
    title: "Functional Assessment",
    description:
      "Review squat, sit-to-stand, balance, gait, and task-based movement performance.",
  },
  {
    key: "AI Vision Assessment",
    title: "AI Vision Assessment",
    description:
      "Use camera-based movement analysis through Body Axis AI for guided assessment.",
  },
] as const;

function InClinicAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const [assessment, setAssessment] = useState<StoredAssessment | null>(null);
  const [selectedTests, setSelectedTests] = useState<string[]>([
    "ROM Assessment",
    "AI Vision Assessment",
  ]);
  const [bodyRegion, setBodyRegion] = useState("Knee");
  const [side, setSide] = useState("Right");
  const [visitType, setVisitType] = useState("Follow-Up");
  const [sessionLabel, setSessionLabel] = useState("New Assessment");
  const [testCategory, setTestCategory] = useState("Functional Movement");
  const [specificTest, setSpecificTest] = useState("Squat Analysis");

  useEffect(() => {
    if (!assessmentId) return;

    const existing = getAssessmentById(assessmentId);
    if (!existing) return;

    setAssessment(existing);
    setSelectedTests(
      existing.selectedTests?.length
        ? existing.selectedTests
        : ["ROM Assessment", "AI Vision Assessment"]
    );
    setBodyRegion(existing.bodyRegion || "Knee");
    setSide(existing.side || "Right");
    setVisitType(existing.visitType || "Follow-Up");
    setSessionLabel(existing.sessionLabel || "New Assessment");
  }, [assessmentId]);

  const selectedCount = selectedTests.length;

  const metricsPreview = useMemo(() => {
    if (specificTest === "Squat Analysis") {
      return [
        "Mobility • Depth",
        "Alignment • Knee Alignment",
        "Control • Trunk Control",
        "Symmetry • Left-Right Symmetry",
        "Summary • Movement Quality Score",
      ];
    }

    if (specificTest === "Single Leg Balance") {
      return [
        "Balance • Stability Time",
        "Control • Trunk Control",
        "Symmetry • Side Comparison",
        "Summary • Balance Quality Score",
      ];
    }

    return [
      "Mobility • Range",
      "Control • Movement Control",
      "Symmetry • Side Comparison",
      "Summary • Performance Score",
    ];
  }, [specificTest]);

  function toggleTest(testName: string) {
    setSelectedTests((prev) =>
      prev.includes(testName)
        ? prev.filter((item) => item !== testName)
        : [...prev, testName]
    );
  }

  function buildUpdatedAssessment(status: StoredAssessment["status"]) {
    if (!patientId || !assessmentId) return null;

    const base: StoredAssessment = assessment || {
      id: assessmentId,
      patientId,
      mode: "in_clinic",
      selectedTests: [],
      bodyRegion: "Knee",
      side: "Right",
      visitType: "Follow-Up",
      sessionLabel: "New Assessment",
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    return {
      ...base,
      selectedTests,
      bodyRegion,
      side,
      visitType,
      sessionLabel,
      status,
    } satisfies StoredAssessment;
  }

  function handleSaveDraft() {
    const updated = buildUpdatedAssessment("draft");
    if (!updated) {
      alert("Missing patient or assessment ID");
      return;
    }

    saveAssessmentToStorage(updated);
    alert("Assessment saved as draft");
  }

  function handleContinue() {
    const updated = buildUpdatedAssessment("completed");
    if (!updated) {
      alert("Missing patient or assessment ID");
      return;
    }

    saveAssessmentToStorage(updated);

    router.push(
      `/results?patientId=${patientId}&assessmentId=${assessmentId}`
    );
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              In-Clinic Assessment
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              In-Clinic Guided Assessment
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Configure one or more tests for this clinic session.
            </p>

            <p className="mt-3 text-sm text-white/60">
              Patient ID: {patientId || "—"} | Assessment ID: {assessmentId || "—"}
            </p>
          </div>

          <Link
            href={
              patientId
                ? `/clinician/assessment/start?patientId=${patientId}`
                : "/clinician/patients"
            }
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Assessment Mode
          </Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">
              1. Select Assessment Tests
            </h2>
            <p className="mt-2 text-sm text-white/70">
              You can include more than one test in the same in-clinic session.
            </p>

            <div className="mt-5 space-y-4">
              {AVAILABLE_TESTS.map((test) => {
                const checked = selectedTests.includes(test.key);

                return (
                  <button
                    key={test.key}
                    type="button"
                    onClick={() => toggleTest(test.key)}
                    className={`w-full rounded-[22px] border p-5 text-left transition ${
                      checked
                        ? "border-cyan-300/45 bg-cyan-400/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          checked
                            ? "border-cyan-300 bg-cyan-400 text-slate-950"
                            : "border-white/20 text-transparent"
                        }`}
                      >
                        ✓
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {test.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-white/70">
                          {test.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white">
                2. Assessment Setup
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Body Region">
                  <select
                    value={bodyRegion}
                    onChange={(e) => setBodyRegion(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  >
                    <option>Knee</option>
                    <option>Shoulder</option>
                    <option>Ankle</option>
                    <option>Hip</option>
                    <option>Spine</option>
                    <option>Full Body</option>
                  </select>
                </Field>

                <Field label="Side">
                  <select
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  >
                    <option>Right</option>
                    <option>Left</option>
                    <option>Bilateral</option>
                    <option>Not Applicable</option>
                  </select>
                </Field>

                <Field label="Visit Type">
                  <select
                    value={visitType}
                    onChange={(e) => setVisitType(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  >
                    <option>Follow-Up</option>
                    <option>Initial Evaluation</option>
                    <option>Reassessment</option>
                  </select>
                </Field>

                <Field label="Session Label">
                  <input
                    value={sessionLabel}
                    onChange={(e) => setSessionLabel(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white">
                3. AI Vision Task Configuration
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Test Category">
                  <select
                    value={testCategory}
                    onChange={(e) => setTestCategory(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  >
                    <option>Functional Movement</option>
                    <option>Balance</option>
                    <option>Posture</option>
                    <option>Mobility</option>
                  </select>
                </Field>

                <Field label="Specific Test">
                  <select
                    value={specificTest}
                    onChange={(e) => setSpecificTest(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  >
                    <option>Squat Analysis</option>
                    <option>Single Leg Balance</option>
                    <option>Gait Screening</option>
                    <option>Reach Test</option>
                  </select>
                </Field>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  onClick={handleContinue}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Continue to Results
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Session Summary</h2>

            <div className="mt-5 space-y-4">
              <InfoCard label="Patient ID" value={patientId || "—"} />
              <InfoCard label="Assessment ID" value={assessmentId || "—"} />
              <InfoCard label="Selected Tests" value={`${selectedCount} selected`} />
              <InfoCard
                label="Tests Included"
                value={selectedTests.length ? selectedTests.join(" • ") : "—"}
              />
              <InfoCard label="Body Region" value={bodyRegion} />
              <InfoCard label="Side" value={side} />
              <InfoCard label="Visit Type" value={visitType} />
              <InfoCard label="Test Category" value={testCategory} />
              <InfoCard label="Specific Test" value={specificTest} />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Metrics Preview
              </h3>

              <ul className="mt-4 space-y-2 text-sm leading-6 text-white/70">
                {metricsPreview.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function InClinicAssessmentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6">
              <h1 className="text-2xl font-bold text-cyan-300">
                Loading in-clinic assessment...
              </h1>
            </div>
          </div>
        </main>
      }
    >
      <InClinicAssessmentContent />
    </Suspense>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/75">{label}</span>
      {children}
    </label>
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