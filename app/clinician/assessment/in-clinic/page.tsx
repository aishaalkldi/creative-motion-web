"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentById,
  saveAssessmentToStorage,
} from "../../../lib/assessments-storage";

const AVAILABLE_TESTS = [
  { key: "squat", label: "Squat Analysis" },
  { key: "balance", label: "Single Leg Balance" },
  { key: "gait", label: "Gait Screening" },
  { key: "posture", label: "Reach Test" },
];

function InClinicAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";
  const patientName = searchParams.get("patientName") || "";

  const existingAssessment = useMemo(() => {
    if (!assessmentId) return null;
    return getAssessmentById(assessmentId);
  }, [assessmentId]);

  const [selectedTests, setSelectedTests] = useState<string[]>(
    existingAssessment?.selectedTests || []
  );

  const [bodyRegion, setBodyRegion] = useState(
    existingAssessment?.bodyRegion || "Knee"
  );
  const [side, setSide] = useState(existingAssessment?.side || "Right");
  const [visitType, setVisitType] = useState(
    existingAssessment?.visitType || "Follow-Up"
  );
  const [sessionLabel, setSessionLabel] = useState(
    existingAssessment?.sessionLabel || "New Assessment"
  );

  function toggleTest(testKey: string) {
    setSelectedTests((prev) =>
      prev.includes(testKey)
        ? prev.filter((item) => item !== testKey)
        : [...prev, testKey]
    );
  }

  function buildUpdatedAssessment(
    status: "draft" | "completed" | "pending_review"
  ) {
    if (!patientId || !assessmentId) return null;

    const base =
      existingAssessment ||
      getAssessmentById(assessmentId) || {
        id: assessmentId,
        patientId,
        mode: "in_clinic" as const,
        selectedTests: [],
        bodyRegion: "Knee",
        side: "Right",
        visitType: "Follow-Up",
        sessionLabel: "New Assessment",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
      };

    return {
      ...base,
      patientId,
      mode: "in_clinic" as const,
      selectedTests,
      bodyRegion,
      side,
      visitType,
      sessionLabel,
      status,
    };
  }

  function handleContinue() {
    const updated = buildUpdatedAssessment("draft");

    if (!updated) {
      alert("Missing patient or assessment ID");
      return;
    }

    if (!selectedTests.length) {
      alert("Please select at least one assessment test");
      return;
    }

    saveAssessmentToStorage(updated);

    const nextTest = selectedTests[0] || "squat";

    router.push(
      `/body-axis-ai?patientId=${encodeURIComponent(
        patientId
      )}&assessmentId=${encodeURIComponent(
        assessmentId
      )}&patientName=${encodeURIComponent(
        patientName || ""
      )}&test=${encodeURIComponent(nextTest)}`
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
              Configure the assessment session, select the clinical test, then
              continue to the active test screen.
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
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">
              Select Assessment Test
            </h2>

            <p className="mt-2 text-sm leading-7 text-white/70">
              Choose one or more tests for this visit. The first selected test
              will open in Body Axis AI.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {AVAILABLE_TESTS.map((test) => {
                const active = selectedTests.includes(test.key);

                return (
                  <button
                    key={test.key}
                    type="button"
                    onClick={() => toggleTest(test.key)}
                    className={`rounded-[24px] border p-5 text-left transition ${
                      active
                        ? "border-cyan-300/45 bg-cyan-400/10"
                        : "border-cyan-300/18 bg-[#123a8a]/25 hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                    }`}
                  >
                    <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                      Test
                    </div>

                    <h3 className="text-xl font-bold text-white">
                      {test.label}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-white/70">
                      {active
                        ? "Selected for this assessment session."
                        : "Tap to include this test in the current session."}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Field>
                <label className="mb-2 block text-sm text-white/70">
                  Body Region
                </label>
                <input
                  value={bodyRegion}
                  onChange={(e) => setBodyRegion(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field>
                <label className="mb-2 block text-sm text-white/70">Side</label>
                <input
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field>
                <label className="mb-2 block text-sm text-white/70">
                  Visit Type
                </label>
                <input
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field>
                <label className="mb-2 block text-sm text-white/70">
                  Session Label
                </label>
                <input
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                />
              </Field>
            </div>
          </div>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Assessment Summary</h2>

            <div className="mt-5 space-y-4">
              <SummaryCard label="Patient ID" value={patientId || "—"} />
              <SummaryCard label="Assessment ID" value={assessmentId || "—"} />
              <SummaryCard
                label="Selected Tests"
                value={
                  selectedTests.length
                    ? selectedTests
                        .map((item) => AVAILABLE_TESTS.find((t) => t.key === item)?.label || item)
                        .join(", ")
                    : "No tests selected"
                }
              />
              <SummaryCard label="Body Region" value={bodyRegion || "—"} />
              <SummaryCard label="Side" value={side || "—"} />
              <SummaryCard label="Visit Type" value={visitType || "—"} />
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-base font-semibold text-cyan-300">
                Recommended Flow
              </h3>

              <ol className="mt-4 space-y-2 text-sm text-white/70">
                <li>1. Confirm patient and session</li>
                <li>2. Select assessment test</li>
                <li>3. Continue to active test</li>
                <li>4. Generate result</li>
                <li>5. Review results</li>
              </ol>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleContinue}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Continue to Test
              </button>

              <Link
                href={`/results?patientId=${encodeURIComponent(
                  patientId
                )}&assessmentId=${encodeURIComponent(assessmentId)}`}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                View Current Results
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
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
    <Suspense fallback={<div className="p-6 text-white">Loading in-clinic assessment...</div>}>
      <InClinicAssessmentContent />
    </Suspense>
  );
}