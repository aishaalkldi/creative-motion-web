"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { AssessmentRecord } from "../../../lib/domain-types";
import {
  getPatient,
  updatePatient,
  deletePatient,
  getPatientAssessments,
  type AssessmentOut,
  type BackendPatient,
} from "../../../lib/api";
import { assessmentsRepository } from "../../../lib/repositories";
import ConfirmModal from "../../../components/ConfirmModal";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params.id || "");
  const numericId = parseInt(id, 10);

  const [patient, setPatient] = useState<BackendPatient | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [backendAssessmentHistory, setBackendAssessmentHistory] = useState<AssessmentOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">("idle");

  // Edit state
  const [editOpen, setEditOpen] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState<Partial<BackendPatient>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (isNaN(numericId)) { setIsLoading(false); return; }
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const p = await getPatient(numericId);
        if (!isMounted) return;
        setPatient(p);
        setEditForm(p);
      } catch { setPatient(null); }

      const localAssessments = assessmentsRepository.listByPatientId(String(numericId));
      if (isMounted) setAssessments(localAssessments);

      try {
        const history = await getPatientAssessments(numericId);
        if (isMounted) setBackendAssessmentHistory(history);
      } catch { /* ignore */ }

      if (isMounted) setIsLoading(false);
    }
    load();
    return () => { isMounted = false; };
  }, [numericId]);

  const latestAssessment = useMemo(() => assessments[0] ?? null, [assessments]);
  const recentAssessments = useMemo(() => assessments.slice(0, 3), [assessments]);
  const latestRemoteAssessment = useMemo(
    () => assessments.find((a) => a.mode === "remote") ?? null,
    [assessments]
  );

  function handleCreateRemoteRequest() {
    if (!patient) return;
    const assessmentId = assessmentsRepository.newAssessmentId();
    assessmentsRepository.create({
      id: assessmentId,
      patientId: String(patient.id),
      mode: "remote",
      selectedTests: [],
      bodyRegion: "Full Body",
      side: "Not Applicable",
      visitType: "Follow-Up",
      sessionLabel: "Remote Assessment Request",
      createdAt: new Date().toISOString(),
    });
    router.push(`/clinician/request?patientId=${patient.id}&assessmentId=${assessmentId}`);
  }

  async function handleCopyLatestLink() {
    if (!latestRemoteAssessment || !patient) { alert("No remote assessment link available"); return; }
    const link = `${window.location.origin}/assessment?patientId=${patient.id}&assessmentId=${latestRemoteAssessment.id}`;
    try { await navigator.clipboard.writeText(link); setCopyFeedback("success"); }
    catch { setCopyFeedback("error"); }
  }

  useEffect(() => {
    if (copyFeedback === "idle") return;
    const t = window.setTimeout(() => setCopyFeedback("idle"), 2500);
    return () => window.clearTimeout(t);
  }, [copyFeedback]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updatePatient(patient.id, {
        full_name: editForm.full_name?.trim(),
        phone: editForm.phone?.trim(),
        age: editForm.age ?? null,
        gender: editForm.gender ?? null,
        sport: editForm.sport ?? null,
        diagnosis: editForm.diagnosis?.trim(),
        status: editForm.status,
      });
      setPatient(updated);
      setEditOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!patient) return;
    setDeleting(true);
    try {
      await deletePatient(patient.id);
      router.push("/clinician/patients");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete patient.");
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-8">
            <h1 className="text-2xl font-bold text-cyan-200">Loading patient profile…</h1>
            <p className="mt-3 text-sm text-white/70">Retrieving patient data and assessment history.</p>
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
            <h1 className="text-3xl font-bold text-cyan-300">Patient not found</h1>
            <p className="mt-3 text-white/70">No patient record was found for this ID.</p>
            <div className="mt-6">
              <Link href="/clinician/patients" className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                ← Back to Patients
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
    <ConfirmModal
      open={deleteModalOpen}
      title="Delete Patient"
      message={`"${patient?.full_name}" will be permanently removed along with all associated records. This cannot be undone.`}
      confirmLabel="Yes, Delete"
      loading={deleting}
      onConfirm={handleConfirmDelete}
      onCancel={() => setDeleteModalOpen(false)}
    />
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
              Patient Profile
            </div>
            <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">{patient.full_name}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge text={`ID: ${patient.id}`} />
              <Badge text={`Status: ${patient.status}`} />
              <Badge text={`Complaint: ${patient.diagnosis || "Not set"}`} />
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Review patient context, choose the assessment path, and continue the rehabilitation workflow from one central clinical page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { setEditForm(patient); setEditOpen((o) => !o); setSaveError(""); }}
              className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              {editOpen ? "Cancel Edit" : "Edit Patient"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete Patient"}
            </button>
            <Link
              href="/clinician/patients"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Edit Form */}
        {editOpen && (
          <section className="mb-6 rounded-[28px] border border-cyan-300/25 bg-cyan-400/5 p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-xl font-bold text-cyan-200">Edit Patient</h2>
            <p className="mt-1 text-sm text-white/60">Changes are saved directly to the database.</p>
            <form onSubmit={handleSaveEdit} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Full Name" required>
                <input
                  value={editForm.full_name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Phone">
                <input
                  value={editForm.phone ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Age">
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={editForm.age ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value ? Number(e.target.value) : null }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Gender">
                <select
                  value={editForm.gender ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value || null }))}
                  className={inputCls}
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Sport / Activity">
                <input
                  value={editForm.sport ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value || null }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Diagnosis / Primary Complaint">
                <input
                  value={editForm.diagnosis ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={editForm.status ?? "Active"}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputCls}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Discharged">Discharged</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </Field>
              <div className="col-span-full flex flex-wrap items-center gap-3 pt-2">
                {saveError && <p className="text-sm text-rose-300">{saveError}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            {/* Patient Header */}
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Patient Header</h2>
                  <p className="mt-2 text-sm text-white/70">Core patient identity and current case context.</p>
                </div>
                <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                  {patient.status}
                </span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Patient ID" value={String(patient.id)} />
                <InfoCard label="Age / Sex" value={`${patient.age ?? "—"} / ${patient.gender ?? "—"}`} />
                <InfoCard label="Primary Complaint" value={patient.diagnosis || "—"} />
                <InfoCard
                  label="Last Assessment"
                  value={latestAssessment?.createdAt ? new Date(latestAssessment.createdAt).toLocaleDateString() : "—"}
                />
                <InfoCard label="Current Phase" value={latestAssessment ? "Assessment Recorded" : "Initial Setup"} />
                <InfoCard label="Case Status" value={patient.status} />
              </div>
            </section>

            {/* Quick Actions */}
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Quick Actions</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">Continue the care pathway with fast access to the most common clinical tasks.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Link
                  href={`/clinician/assessment/start?patientId=${patient.id}`}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">Start Assessment</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">Continue with in-clinic or remote assessment workflow.</p>
                </Link>
                <button
                  type="button"
                  onClick={handleCreateRemoteRequest}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 text-left transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">Create Remote Request</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">Generate a secure link for patient completion on any device.</p>
                </button>
                <Link
                  href={latestAssessment
                    ? `/results?patientId=${patient.id}&assessmentId=${latestAssessment.id}`
                    : `/clinician/assessment/start?patientId=${patient.id}`}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">View Results</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {latestAssessment ? "Open the latest assessment findings." : "No results yet. Start an assessment first."}
                  </p>
                </Link>
                <Link
                  href="/library"
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">Assign Program</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">Select the appropriate rehab pathway or treatment program.</p>
                </Link>
                <Link
                  href={`/clinician/patients/${patient.id}#assessment-timeline`}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">Track Progress</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">Review progress trends, reassessments, and next milestones.</p>
                </Link>
              </div>
            </section>

            {/* Assessment History (backend) */}
            <section
              id="assessment-timeline"
              className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md"
            >
              <h2 className="text-2xl font-bold text-white">Assessment History</h2>
              <p className="mt-2 text-sm text-white/70">Completed assessments saved from Body Axis AI and linked to this patient record.</p>
              <div className="mt-5 space-y-3">
                {backendAssessmentHistory.length > 0 ? (
                  backendAssessmentHistory.map((row) => (
                    <div key={`backend-${row.id}`} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">{row.type}</h3>
                          <p className="mt-1 text-sm text-white/60">{row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</p>
                          {row.selected_tests.length > 0 && (
                            <p className="mt-1 text-xs text-white/50">Tests: {row.selected_tests.join(", ")}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ResultPill label={row.status} tone={row.status === "completed" ? "good" : row.status === "in_progress" ? "score" : "neutral"} />
                          {row.mode && <ResultPill label={row.mode} tone="neutral" />}
                        </div>
                      </div>
                      {row.notes && <p className="mt-3 text-sm leading-6 text-white/70">{row.notes}</p>}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/65">
                    No saved assessment results yet. Complete a Body Axis AI session to build history here.
                  </div>
                )}
              </div>
            </section>

            {/* Full Assessment History (local) */}
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Full Assessment History</h2>
              <p className="mt-2 text-sm text-white/70">Complete session archive preserved for longitudinal tracking.</p>
              <div className="mt-5 space-y-4">
                {assessments.length > 0 ? (
                  assessments.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            {item.mode === "remote" ? "Remote Assessment" : "In-Clinic Assessment"}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">{new Date(item.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {typeof item.score === "number" && <ResultPill label={`Score ${item.score}%`} tone="score" />}
                          <ResultPill label={formatStatusLabel(item.status)} tone={item.status === "completed" ? "good" : "neutral"} />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/70">
                        {item.selectedTests.length > 0 ? `Tests: ${item.selectedTests.map(formatTestLabel).join(", ")}` : "No tests selected"}
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
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/65">No assessment history yet.</div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white">Remote Assessment</h2>
              <div className="mt-5 space-y-4">
                <InfoCard label="Request Status" value={latestRemoteAssessment?.status || "No remote request yet"} />
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
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy Latest Link
                </button>
                {copyFeedback === "success" && <p className="text-sm text-cyan-200">Link copied.</p>}
                {copyFeedback === "error" && <p className="text-sm text-rose-200">Could not copy. Please try again.</p>}
              </div>
            </section>

            {/* Recent Results (local) */}
            {recentAssessments.length > 0 && (
              <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
                <h2 className="text-xl font-bold text-white">Recent Sessions</h2>
                <p className="mt-2 text-sm text-white/70">Last 3 assessments.</p>
                <div className="mt-4 space-y-3">
                  {recentAssessments.map((item) => (
                    <div key={`${item.id}-recent`} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-white/60">{new Date(item.createdAt).toLocaleDateString()}</p>
                          <h3 className="mt-1 text-sm font-semibold text-white">
                            {item.mode === "remote" ? "Remote" : "In-clinic"} Session
                          </h3>
                        </div>
                        <ResultPill label={formatStatusLabel(item.status)} tone={item.status === "completed" ? "good" : "neutral"} />
                      </div>
                      <div className="mt-3">
                        <Link
                          href={`/results?patientId=${patient.id}&assessmentId=${item.id}`}
                          className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          View Report →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </section>
      </div>
    </main>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl border border-white/10 bg-[#123a8a]/30 px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-cyan-300/40";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/70">
        {label}{required && <span className="ml-1 text-rose-300">*</span>}
      </span>
      {children}
    </label>
  );
}

function formatTestLabel(test: string) {
  const map: Record<string, string> = {
    posture: "Postural Assessment", gait: "Gait Assessment", balance: "Balance Assessment",
    squat: "Squat Assessment", rom: "ROM Assessment", reach: "Reach Test",
    sit_to_stand: "Sit-to-Stand", compensation: "Compensation Analysis", "ai-vision": "Body Axis AI",
  };
  return map[test] ?? test;
}

function formatStatusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "draft") return "Draft";
  return status;
}

function ResultPill({ label, tone }: { label: string; tone: "score" | "good" | "neutral" }) {
  const cls = tone === "good"
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
    : tone === "score"
      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
      : "border-white/15 bg-white/[0.04] text-white/80";
  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function Badge({ text }: { text: string }) {
  return <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">{text}</span>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
