"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAssessmentById } from "../lib/assessments-storage";

function ResultsPageContent() {
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") || "—";
  const assessmentId = searchParams.get("assessmentId") || "—";
  const hasValidContext = patientId !== "—" && assessmentId !== "—";

  const assessment =
    assessmentId !== "—" ? getAssessmentById(assessmentId) : null;

  const mode = assessment
    ? assessment.mode === "remote"
      ? "Remote Online Assessment"
      : "In-Clinic Guided Assessment"
    : "Not available";

  const selectedTests = assessment?.selectedTests || [];
  const bodyRegion = assessment?.bodyRegion || "—";
  const side = assessment?.side || "—";
  const visitType = assessment?.visitType || "—";
  const sessionLabel = assessment?.sessionLabel || "—";
  const status = assessment?.status || "—";
  const createdAt = assessment?.createdAt
    ? new Date(assessment.createdAt).toLocaleDateString()
    : "—";

  const score =
    typeof assessment?.score === "number"
      ? `${assessment.score}%`
      : assessment?.score || "—";
  const scoreValue = typeof assessment?.score === "number" ? assessment.score : null;
  const scoreTone =
    scoreValue === null
      ? "pending"
      : scoreValue >= 80
        ? "good"
        : scoreValue >= 60
          ? "moderate"
          : "attention";
  const reportSummary = assessment?.reportSummary?.trim()
    ? assessment.reportSummary
    : assessment
      ? `${mode} recorded for ${bodyRegion.toLowerCase()} (${side.toLowerCase()}) during a ${visitType.toLowerCase()} visit. Use the selected tests and score to confirm progression and next care step.`
      : "Report summary will appear after a valid assessment record is loaded.";

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Assessment Results
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              Results Review
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Review findings, confirm the linked assessment session, and continue
              to the next clinical decision.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={patientId !== "—" ? `/clinician/patients/${patientId}` : "/clinician/patients"}
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Patient Profile
            </Link>

            <Link
              href="/library"
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Assign Program
            </Link>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Clinical Result Overview</h2>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    Linked assessment context, score signal, and session readiness for follow-up decisions.
                  </p>
                </div>
                <StatusPill status={status} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Score" value={String(score)} tone={scoreTone} />
                <MetricCard label="Mode" value={mode} />
                <MetricCard label="Selected Tests" value={String(selectedTests.length)} />
                <MetricCard label="Patient ID" value={patientId} />
                <MetricCard label="Assessment ID" value={assessmentId} />
                <MetricCard label="Created At" value={createdAt} />
              </div>

              {!hasValidContext && (
                <div className="mt-5 rounded-[18px] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Missing patient or assessment query parameters. Open this page from a patient workflow for full context.
                </div>
              )}

              {hasValidContext && !assessment && (
                <div className="mt-5 rounded-[18px] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Assessment record was not found in saved data. Confirm the assessment was completed and stored.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">
                Assessment Summary
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Patient ID" value={patientId} />
                <InfoCard label="Assessment ID" value={assessmentId} />
                <InfoCard label="Mode" value={mode} />
                <InfoCard label="Status" value={status} />
                <InfoCard label="Score" value={String(score)} />
                <InfoCard label="Body Region" value={bodyRegion} />
                <InfoCard label="Side" value={side} />
                <InfoCard label="Visit Type" value={visitType} />
                <InfoCard label="Session Label" value={sessionLabel} />
                <InfoCard label="Created At" value={createdAt} />
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Tests Included</h2>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-white/65">
                  {selectedTests.length > 0
                    ? `${selectedTests.length} tests selected for this session`
                    : "No tests selected for this session"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {selectedTests.length > 0 ? (
                  selectedTests.map((test) => (
                    <span
                      key={test}
                      className="rounded-full border border-cyan-300/25 bg-cyan-400/12 px-4 py-2 text-sm font-medium text-cyan-100"
                    >
                      {formatTestLabel(test)}
                    </span>
                  ))
                ) : (
                  <div className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/60">
                    Tests will appear here once the assessment is configured and completed.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">
                Report Summary
              </h2>

              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm leading-8 text-white/75">
                  {reportSummary}
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Session Notes</h2>

              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm leading-8 text-white/70">
                  Session type: <span className="font-semibold text-white">{mode}</span>. Body region:{" "}
                  <span className="font-semibold text-white">{bodyRegion}</span>. Side:{" "}
                  <span className="font-semibold text-white">{side}</span>. Visit type:{" "}
                  <span className="font-semibold text-white">{visitType}</span>. Session label:{" "}
                  <span className="font-semibold text-white">{sessionLabel}</span>. This result is tied to assessment{" "}
                  <span className="font-semibold text-white">{assessmentId}</span> for patient{" "}
                  <span className="font-semibold text-white">{patientId}</span>.
                </p>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Result Snapshot</h2>

              <div className="mt-5 space-y-4">
                <InfoCard label="Patient ID" value={patientId} />
                <InfoCard label="Assessment ID" value={assessmentId} />
                <InfoCard
                  label="Recorded Tests"
                  value={String(selectedTests.length)}
                />
                <InfoCard label="Score" value={String(score)} />
                <InfoCard label="Status" value={status} />
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">
                Clinician Actions
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Continue this case from interpretation to care planning and follow-up.
              </p>

              <div className="mt-5 space-y-3">
                <ActionBox text="Review assessment findings and confirm clinical interpretation" />
                <ActionBox text="Assign or update rehabilitation program" />
                <ActionBox text="Track progress on follow-up sessions" />
                <ActionBox text="Repeat assessment when clinically needed" />
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/library"
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Assign Program
                </Link>

                <Link
                  href={patientId !== "—" ? `/clinician/patients/${patientId}` : "/clinician/patients"}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  Track Progress
                </Link>

                <Link
                  href={
                    patientId !== "—"
                      ? `/clinician/assessment/start?patientId=${patientId}`
                      : "/clinician/assessment/start"
                  }
                  className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-center font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  Start New Assessment
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatTestLabel(test: string) {
  switch (test) {
    case "posture":
      return "Postural Assessment";
    case "gait":
      return "Gait Assessment";
    case "balance":
      return "Balance Assessment";
    case "squat":
      return "Squat Assessment";
    case "rom":
      return "ROM Assessment";
    case "reach":
      return "Reach Test";
    case "sit_to_stand":
      return "Sit-to-Stand Assessment";
    case "compensation":
      return "Compensation Analysis";
    case "ai-vision":
      return "AI Vision Assessment";
    default:
      return test;
  }
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

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "moderate" | "attention" | "pending";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : tone === "moderate"
        ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
        : tone === "attention"
          ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
          : tone === "pending"
            ? "border-white/15 bg-white/[0.04] text-white/90"
            : "border-cyan-300/15 bg-cyan-400/10 text-cyan-100";

  return (
    <div className={`rounded-[20px] border p-4 ${toneClass}`}>
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const statusClass =
    normalized === "completed"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : normalized === "draft"
        ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
        : "border-cyan-300/18 bg-cyan-400/10 text-cyan-100";

  return (
    <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusClass}`}>
      {status}
    </span>
  );
}

function ActionBox({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/75">
      {text}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading results...</div>}>
      <ResultsPageContent />
    </Suspense>
  );
}