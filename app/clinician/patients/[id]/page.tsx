"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getStoredPatients,
  type StoredPatient,
} from "../../../lib/patients-storage";
import {
  createDraftAssessment,
  createAssessmentId,
  getAssessmentsByPatientId,
  type StoredAssessment,
} from "../../../lib/assessments-storage";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");

  const [patient, setPatient] = useState<StoredPatient | null>(null);
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">(
    "idle"
  );

  useEffect(() => {
    const patients = getStoredPatients();
    const foundPatient = patients.find((p) => p.id === id) || null;
    setPatient(foundPatient);

    const patientAssessments = getAssessmentsByPatientId(id);
    setAssessments(patientAssessments);
    setIsLoading(false);
  }, [id]);

  const latestAssessment = useMemo(() => {
    if (assessments.length === 0) return null;
    return assessments[0];
  }, [assessments]);
  const recentAssessments = useMemo(() => assessments.slice(0, 3), [assessments]);

  const latestRemoteAssessment = useMemo(() => {
    return assessments.find((item) => item.mode === "remote") || null;
  }, [assessments]);

  function handleCreateRemoteRequest() {
    if (!patient) {
      alert("Patient not found");
      return;
    }

    const assessmentId = createAssessmentId();

    createDraftAssessment({
      id: assessmentId,
      patientId: patient.id,
      mode: "remote",
      selectedTests: [],
      bodyRegion: "Full Body",
      side: "Not Applicable",
      visitType: "Follow-Up",
      sessionLabel: "Remote Assessment Request",
      createdAt: new Date().toISOString(),
    });

    router.push(
      `/clinician/request?patientId=${patient.id}&assessmentId=${assessmentId}`
    );
  }

  async function handleCopyLatestLink() {
    if (!latestRemoteAssessment || !patient) {
      alert("No remote assessment link available");
      return;
    }

    const link = `${window.location.origin}/assessment?patientId=${patient.id}&assessmentId=${latestRemoteAssessment.id}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopyFeedback("success");
    } catch {
      setCopyFeedback("error");
    }
  }

  useEffect(() => {
    if (copyFeedback === "idle") return;
    const timer = window.setTimeout(() => setCopyFeedback("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-8">
            <h1 className="text-2xl font-bold text-cyan-200">
              Loading patient profile...
            </h1>
            <p className="mt-3 text-sm text-white/70">
              Retrieving patient data and assessment history.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8">
            <h1 className="text-3xl font-bold text-cyan-300">
              Patient not found
            </h1>
            <p className="mt-3 text-white/70">
              No patient record was found for this ID.
            </p>

            <div className="mt-6">
              <Link
                href="/clinician/patients"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                ← Back to Patients
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Patient Profile
            </div>

            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
              {patient.fullName}
            </h1>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge text={`ID: ${patient.id}`} />
              <Badge text={`Status: ${patient.status}`} />
              <Badge text={`Primary complaint: ${patient.diagnosis || "Not set"}`} />
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Review patient context, choose the assessment path, and continue the rehabilitation workflow from one central clinical page.
            </p>
          </div>

          <Link
            href="/clinician/patients"
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Patients
          </Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Patient Header</h2>
                  <p className="mt-2 text-sm text-white/70">
                    Core patient identity and current case context.
                  </p>
                </div>

                <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                  {patient.status}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Patient ID" value={patient.id} />
                <InfoCard
                  label="Age / Sex"
                  value={`${patient.age || "—"} / ${patient.gender || "—"}`}
                />
                <InfoCard
                  label="Primary Complaint"
                  value={patient.diagnosis || "—"}
                />
                <InfoCard
                  label="Last Assessment"
                  value={
                    latestAssessment?.createdAt
                      ? new Date(latestAssessment.createdAt).toLocaleDateString()
                      : "—"
                  }
                />
                <InfoCard
                  label="Current Phase"
                  value={latestAssessment ? "Assessment Recorded" : "Initial Setup"}
                />
                <InfoCard label="Case Status" value={patient.status} />
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Quick Actions</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Continue the care pathway with fast access to the most common clinical tasks.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Link
                  href={`/clinician/assessment/start?patientId=${patient.id}`}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">
                    Start Assessment
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Continue with in-clinic or remote assessment workflow.
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={handleCreateRemoteRequest}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 text-left transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">
                    Create Remote Assessment Request
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Generate a secure link for patient completion on any device.
                  </p>
                </button>

                <Link
                  href={
                    latestAssessment
                      ? `/results?patientId=${patient.id}&assessmentId=${latestAssessment.id}`
                      : `/clinician/assessment/start?patientId=${patient.id}`
                  }
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">
                    View Results
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {latestAssessment
                      ? "Open the latest assessment findings and review outcomes."
                      : "No results yet. Start an assessment session first."}
                  </p>
                </Link>

                <Link
                  href="/library"
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">
                    Assign Program
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Select the appropriate rehab pathway or treatment program.
                  </p>
                </Link>

                <Link
                  href={`/clinician/patients/${patient.id}#assessment-timeline`}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">
                    Track Progress
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Review progress trends, reassessments, and next milestones.
                  </p>
                </Link>
              </div>
            </section>

            <section
              id="assessment-timeline"
              className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Latest Result</h2>
                  <p className="mt-2 text-sm text-white/70">
                    Most recent assessment snapshot for immediate clinical decision-making.
                  </p>
                </div>
                {latestAssessment && (
                  <Link
                    href={`/results?patientId=${patient.id}&assessmentId=${latestAssessment.id}`}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    View Full Result
                  </Link>
                )}
              </div>

              {latestAssessment ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard
                      label="Assessment Date"
                      value={new Date(latestAssessment.createdAt).toLocaleDateString()}
                    />
                    <InfoCard
                      label="Mode"
                      value={
                        latestAssessment.mode === "remote"
                          ? "Remote"
                          : "In-clinic"
                      }
                    />
                    <InfoCard
                      label="Status"
                      value={formatStatusLabel(latestAssessment.status)}
                    />
                    <InfoCard
                      label="Score"
                      value={
                        typeof latestAssessment.score === "number"
                          ? `${latestAssessment.score}%`
                          : "Pending"
                      }
                    />
                    <InfoCard label="Body Region" value={latestAssessment.bodyRegion} />
                    <InfoCard label="Side" value={latestAssessment.side} />
                    <InfoCard label="Visit Type" value={latestAssessment.visitType} />
                    <InfoCard
                      label="Completed"
                      value={
                        latestAssessment.completedAt
                          ? new Date(latestAssessment.completedAt).toLocaleDateString()
                          : "Not completed yet"
                      }
                    />
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm text-white/60">Selected Tests</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {latestAssessment.selectedTests.length > 0 ? (
                        latestAssessment.selectedTests.map((test) => (
                          <span
                            key={test}
                            className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
                          >
                            {formatTestLabel(test)}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-white/65">
                          No tests selected for this session.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm text-white/60">Report Summary</p>
                    <p className="mt-2 text-sm leading-7 text-white/75">
                      {latestAssessment.reportSummary ||
                        `${patient.fullName} completed a ${latestAssessment.mode === "remote" ? "remote" : "clinic"} assessment session focused on ${latestAssessment.bodyRegion.toLowerCase()} (${latestAssessment.side.toLowerCase()}).`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/65">
                  No result recorded yet. Start an assessment to create the first linked result.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Recent Results</h2>
              <p className="mt-2 text-sm text-white/70">
                Last 3 assessments for quick clinician comparison.
              </p>

              <div className="mt-5 space-y-3">
                {recentAssessments.length > 0 ? (
                  recentAssessments.map((item) => (
                    <div
                      key={`${item.id}-recent`}
                      className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-white/60">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-white">
                            {item.mode === "remote" ? "Remote" : "In-clinic"} Session
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <ResultPill
                            label={
                              typeof item.score === "number"
                                ? `Score ${item.score}%`
                                : "Score pending"
                            }
                            tone={typeof item.score === "number" ? "score" : "neutral"}
                          />
                          <ResultPill
                            label={formatStatusLabel(item.status)}
                            tone={item.status === "completed" ? "good" : "neutral"}
                          />
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-white/70">
                        {item.selectedTests.length > 0
                          ? `Tests: ${item.selectedTests.map(formatTestLabel).join(", ")}`
                          : "No tests selected"}
                      </p>

                      <div className="mt-3">
                        <Link
                          href={`/results?patientId=${patient.id}&assessmentId=${item.id}`}
                          className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          View Motion Report →
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/65">
                    No recent results available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Full Assessment History</h2>
              <p className="mt-2 text-sm text-white/70">
                Complete session archive preserved for longitudinal tracking and future trends.
              </p>

              <div className="mt-5 space-y-4">
                {assessments.length > 0 ? (
                  assessments.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            {item.mode === "remote"
                              ? "Remote Assessment"
                              : "In-Clinic Assessment"}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {typeof item.score === "number" && (
                            <ResultPill label={`Score ${item.score}%`} tone="score" />
                          )}
                          <ResultPill
                            label={formatStatusLabel(item.status)}
                            tone={item.status === "completed" ? "good" : "neutral"}
                          />
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-white/70">
                        {item.selectedTests.length > 0
                          ? `Tests: ${item.selectedTests.map(formatTestLabel).join(", ")}`
                          : "No tests selected"}
                      </p>

                      <div className="mt-3">
                        <Link
                          href={`/results?patientId=${patient.id}&assessmentId=${item.id}`}
                          className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          Open Report →
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/65">
                    No assessment history yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Remote Assessment</h2>

              <div className="mt-5 space-y-4">
                <InfoCard
                  label="Request Status"
                  value={latestRemoteAssessment?.status || "No remote request yet"}
                />
                <InfoCard
                  label="Last Completed Request"
                  value={
                    latestRemoteAssessment?.status === "completed"
                      ? `${latestRemoteAssessment.id} • ${new Date(
                          latestRemoteAssessment.createdAt
                        ).toLocaleDateString()}`
                      : "No completed request yet"
                  }
                />
                <InfoCard label="Delivery Method" value="Secure Link" />
                <InfoCard label="Access" value="Phone / Tablet / Computer" />
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleCreateRemoteRequest}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Create Assessment Request
                </button>

                <button
                  type="button"
                  onClick={handleCopyLatestLink}
                  disabled={!latestRemoteAssessment}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5"
                >
                  Copy Latest Link
                </button>

                {copyFeedback === "success" && (
                  <p className="text-sm text-cyan-200">
                    Latest assessment link copied.
                  </p>
                )}
                {copyFeedback === "error" && (
                  <p className="text-sm text-rose-200">
                    Could not copy the link. Please try again.
                  </p>
                )}
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
      return "Body Axis AI Session";
    default:
      return test;
  }
}

function formatStatusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "draft") return "Draft";
  return status;
}

function ResultPill({
  label,
  tone,
}: {
  label: string;
  tone: "score" | "good" | "neutral";
}) {
  const className =
    tone === "good"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : tone === "score"
        ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
        : "border-white/15 bg-white/[0.04] text-white/80";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
      {text}
    </span>
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