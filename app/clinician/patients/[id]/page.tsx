"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getStoredPatients,
  type StoredPatient,
} from "../../../lib/patients-storage";
import {
  createAssessmentId,
  getAssessmentsByPatientId,
  saveAssessmentToStorage,
  type StoredAssessment,
} from "../../../lib/assessments-storage";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");

  const [patient, setPatient] = useState<StoredPatient | null>(null);
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);

  useEffect(() => {
    const patients = getStoredPatients();
    const foundPatient = patients.find((p) => p.id === id) || null;
    setPatient(foundPatient);

    const patientAssessments = getAssessmentsByPatientId(id);
    setAssessments(patientAssessments);
  }, [id]);

  const latestAssessment = useMemo(() => {
    if (assessments.length === 0) return null;
    return assessments[0];
  }, [assessments]);

  const latestRemoteAssessment = useMemo(() => {
    return assessments.find((item) => item.mode === "remote") || null;
  }, [assessments]);

  function handleCreateRemoteRequest() {
    if (!patient) {
      alert("Patient not found");
      return;
    }

    const assessmentId = createAssessmentId();

    saveAssessmentToStorage({
      id: assessmentId,
      patientId: patient.id,
      mode: "remote",
      selectedTests: [],
      bodyRegion: "Full Body",
      side: "Not Applicable",
      visitType: "Follow-Up",
      sessionLabel: "Remote Assessment Request",
      status: "draft",
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
      alert("Latest link copied successfully");
    } catch {
      alert("Failed to copy link");
    }
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
              <h2 className="text-2xl font-bold text-white">Assessment Actions</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Choose the next clinical action for this patient.
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
                      : "#"
                  }
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">
                    View Results
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Open the latest assessment findings and review outcomes.
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
                  href={
                    latestAssessment
                      ? `/results?patientId=${patient.id}&assessmentId=${latestAssessment.id}`
                      : "#"
                  }
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

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Latest Assessment Result</h2>

              {latestAssessment ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <InfoCard label="Assessment ID" value={latestAssessment.id} />
                  <InfoCard label="Mode" value={latestAssessment.mode} />
                  <InfoCard label="Status" value={latestAssessment.status} />
                  <InfoCard
                    label="Score"
                    value={
                      typeof latestAssessment.score === "number"
                        ? `${latestAssessment.score}%`
                        : "—"
                    }
                  />
                  <InfoCard label="Body Region" value={latestAssessment.bodyRegion} />
                  <InfoCard label="Side" value={latestAssessment.side} />
                  <InfoCard label="Visit Type" value={latestAssessment.visitType} />
                  <InfoCard
                    label="Tests"
                    value={
                      latestAssessment.selectedTests.length > 0
                        ? latestAssessment.selectedTests.join(", ")
                        : "—"
                    }
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/65">
                  No saved assessment yet for this patient.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Assessment Timeline</h2>

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
                            <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                              Score: {item.score}%
                            </span>
                          )}
                          <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                            {item.status}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-white/70">
                        {item.selectedTests.length > 0
                          ? `Tests: ${item.selectedTests.join(", ")}`
                          : "No tests selected"}
                      </p>
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
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Copy Latest Link
                </button>
              </div>
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