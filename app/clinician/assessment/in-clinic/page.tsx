"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
  type StoredAssessment,
} from "../../../lib/assessments-storage";

type AssessmentTestId =
  | "observation"
  | "rom"
  | "functional"
  | "ai-vision";

type VisionCategory =
  | "Posture & Alignment"
  | "Functional Movement"
  | "Balance & Control"
  | "Gait"
  | "ROM Estimation";

type TestOutputs = Record<string, string[]>;

const assessmentTests: {
  id: AssessmentTestId;
  title: string;
  description: string;
}[] = [
  {
    id: "observation",
    title: "Observation",
    description:
      "Visual clinical review for posture, swelling, asymmetry, and movement quality.",
  },
  {
    id: "rom",
    title: "ROM Assessment",
    description:
      "Document active and passive range of motion findings for the selected joint.",
  },
  {
    id: "functional",
    title: "Functional Assessment",
    description:
      "Review squat, sit-to-stand, balance, gait, and task-based movement performance.",
  },
  {
    id: "ai-vision",
    title: "AI Vision Assessment",
    description:
      "Use camera-based movement analysis through Body Axis AI for guided assessment.",
  },
];

const visionTestConfig: Record<VisionCategory, string[]> = {
  "Posture & Alignment": [
    "Standing Posture Scan",
    "Single-Leg Posture Check",
  ],
  "Functional Movement": [
    "Squat Analysis",
    "Sit-to-Stand Test",
    "Step Task",
  ],
  "Balance & Control": ["Single Leg Balance", "Tandem Balance"],
  Gait: ["Basic Gait Screen", "March-in-Place Test"],
  "ROM Estimation": [
    "Knee ROM Estimation",
    "Shoulder ROM Estimation",
    "Trunk Flexion Screen",
  ],
};

const visionOutputsConfig: Record<string, TestOutputs> = {
  "Standing Posture Scan": {
    Alignment: [
      "Head Alignment",
      "Shoulder Symmetry",
      "Pelvic Level",
      "Knee Alignment Tendency",
    ],
    Summary: ["Weight Shift Pattern"],
  },
  "Single-Leg Posture Check": {
    Alignment: ["Pelvic Drop Tendency", "Trunk Lean"],
    Control: ["Knee Stability", "Balance Control"],
  },
  "Squat Analysis": {
    Mobility: ["Depth"],
    Alignment: ["Knee Alignment"],
    Control: ["Trunk Control"],
    Symmetry: ["Left-Right Symmetry"],
    Summary: ["Movement Quality Score"],
  },
  "Sit-to-Stand Test": {
    Performance: ["Completion Time", "Repetition Count"],
    Control: ["Trunk Lean"],
    Symmetry: ["Symmetry"],
    Summary: ["Functional Control Score"],
  },
  "Step Task": {
    Alignment: ["Alignment"],
    Control: ["Step Control", "Weight Transfer"],
    Summary: ["Balance Response"],
  },
  "Single Leg Balance": {
    Performance: ["Hold Time"],
    Control: ["Postural Sway", "Pelvic Stability", "Knee Control"],
    Summary: ["Balance Score"],
  },
  "Tandem Balance": {
    Performance: ["Hold Time"],
    Control: ["Trunk Stability", "Sway Pattern"],
    Summary: ["Balance Quality"],
  },
  "Basic Gait Screen": {
    Symmetry: ["Step Symmetry"],
    Alignment: ["Trunk Lean"],
    Performance: ["Step Width Estimate"],
    Summary: ["Overall Gait Quality"],
  },
  "March-in-Place Test": {
    Performance: ["Rhythm", "Coordination"],
    Control: ["Balance Control"],
    Summary: ["Movement Consistency"],
  },
  "Knee ROM Estimation": {
    Mobility: ["Flexion Estimate", "Extension Deficit Indicator"],
    Symmetry: ["Side-to-Side Comparison"],
  },
  "Shoulder ROM Estimation": {
    Mobility: ["Flexion Estimate", "Abduction Estimate"],
    Control: ["Compensatory Trunk Motion"],
  },
  "Trunk Flexion Screen": {
    Mobility: ["Flexion Range Estimate"],
    Symmetry: ["Symmetry"],
    Control: ["Control Pattern"],
  },
};

export default function InClinicAssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

  const [assessment, setAssessment] = useState<StoredAssessment | null>(null);

  const [selectedTests, setSelectedTests] = useState<AssessmentTestId[]>([
    "rom",
    "ai-vision",
  ]);
  const [bodyRegion, setBodyRegion] = useState("Knee");
  const [side, setSide] = useState("Right");
  const [visitType, setVisitType] = useState("Follow-Up");
  const [sessionLabel, setSessionLabel] = useState(
    "New Assessment"
  );

  const [visionCategory, setVisionCategory] =
    useState<VisionCategory>("Functional Movement");
  const [specificTest, setSpecificTest] = useState("Squat Analysis");

  useEffect(() => {
    if (!assessmentId) return;

    const found = getAssessmentById(assessmentId);
    if (!found) return;

    setAssessment(found);
    setBodyRegion(found.bodyRegion || "Knee");
    setSide(found.side || "Right");
    setVisitType(found.visitType || "Follow-Up");
    setSessionLabel(found.sessionLabel || "New Assessment");

    if (found.selectedTests && found.selectedTests.length > 0) {
      const mapped = found.selectedTests.filter((test): test is AssessmentTestId =>
        ["observation", "rom", "functional", "ai-vision"].includes(test)
      );
      if (mapped.length > 0) setSelectedTests(mapped);
    }
  }, [assessmentId]);

  const hasAiVision = selectedTests.includes("ai-vision");
  const availableSpecificTests = visionTestConfig[visionCategory];

  useEffect(() => {
    if (!availableSpecificTests.includes(specificTest)) {
      setSpecificTest(availableSpecificTests[0]);
    }
  }, [visionCategory, availableSpecificTests, specificTest]);

  const currentOutputs = useMemo(() => {
    if (!hasAiVision) return null;
    return visionOutputsConfig[specificTest] || null;
  }, [hasAiVision, specificTest]);

  function toggleTest(testId: AssessmentTestId) {
    setSelectedTests((prev) =>
      prev.includes(testId)
        ? prev.filter((id) => id !== testId)
        : [...prev, testId]
    );
  }

  function buildAssessment(status: StoredAssessment["status"]): StoredAssessment {
    return {
      id: assessmentId,
      patientId,
      mode: "in_clinic",
      selectedTests,
      bodyRegion,
      side,
      visitType,
      sessionLabel,
      status,
      createdAt: assessment?.createdAt || new Date().toISOString(),
    };
  }

  function handleSaveDraft() {
    if (!assessmentId || !patientId) {
      alert("Missing patient or assessment ID");
      return;
    }

    saveAssessmentToStorage(buildAssessment("draft"));
    alert("Assessment draft saved");
  }

  function handleSaveAndReturn() {
    if (!assessmentId || !patientId) {
      alert("Missing patient or assessment ID");
      return;
    }

    saveAssessmentToStorage(buildAssessment("completed"));
    router.push(`/clinician/patients/${patientId}`);
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
            href={`/clinician/assessment/start?patientId=${patientId}`}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Assessment Mode
          </Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">
                1. Select Assessment Tests
              </h2>
              <p className="mt-2 text-sm text-white/70">
                You can include more than one test in the same in-clinic session.
              </p>
            </div>

            <div className="space-y-4">
              {assessmentTests.map((item) => {
                const checked = selectedTests.includes(item.id);

                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-start gap-4 rounded-[22px] border p-4 transition ${
                      checked
                        ? "border-cyan-300/40 bg-cyan-400/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTest(item.id)}
                      className="mt-1 h-5 w-5 accent-cyan-400"
                    />

                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-white/70">
                        {item.description}
                      </p>
                    </div>
                  </label>
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
                    <option>Hip</option>
                    <option>Ankle</option>
                    <option>Shoulder</option>
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
                    <option>Initial</option>
                    <option>Follow-Up</option>
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

            {hasAiVision && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold text-white">
                  3. AI Vision Task Configuration
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Test Category">
                    <select
                      value={visionCategory}
                      onChange={(e) =>
                        setVisionCategory(e.target.value as VisionCategory)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                    >
                      {Object.keys(visionTestConfig).map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Specific Test">
                    <select
                      value={specificTest}
                      onChange={(e) => setSpecificTest(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                    >
                      {availableSpecificTests.map((test) => (
                        <option key={test}>{test}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={handleSaveAndReturn}
                className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Save & Return to Patient Profile
              </button>
            </div>
          </div>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Session Summary</h2>

            <div className="mt-5 space-y-4">
              <SummaryCard label="Patient ID" value={patientId || "—"} />
              <SummaryCard label="Assessment ID" value={assessmentId || "—"} />
              <SummaryCard
                label="Selected Tests"
                value={`${selectedTests.length} selected`}
              />
              <SummaryCard
                label="Tests Included"
                value={
                  selectedTests.length > 0
                    ? selectedTests
                        .map((test) => {
                          const found = assessmentTests.find((t) => t.id === test);
                          return found ? found.title : test;
                        })
                        .join(" • ")
                    : "No tests selected"
                }
              />
              <SummaryCard label="Body Region" value={bodyRegion} />
              <SummaryCard label="Side" value={side} />
              <SummaryCard label="Visit Type" value={visitType} />
              {hasAiVision && (
                <>
                  <SummaryCard label="Test Category" value={visionCategory} />
                  <SummaryCard label="Specific Test" value={specificTest} />
                </>
              )}
            </div>

            {hasAiVision && currentOutputs && (
              <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-base font-semibold text-cyan-300">
                  Metrics Preview
                </h3>

                <div className="mt-4 space-y-3">
                  {Object.entries(currentOutputs).map(([group, values]) => (
                    <div key={group}>
                      <p className="text-sm font-semibold text-white">{group}</p>
                      <ul className="mt-2 space-y-1 text-sm text-white/70">
                        {values.map((value) => (
                          <li key={value}>• {value}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
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