"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams, notFound } from "next/navigation";
import type { AssessmentRecord } from "../../../lib/domain-types";
import {
  getPatientAssessments,
  type AssessmentOut,
} from "../../../lib/api";
import type { SavedAssessment } from "../../../lib/mock-clinical-data";
import type { AssessmentRow } from "../../../api/assessments/route";
import type { PatientRow } from "../../../lib/validate-patient-ownership";
import { assessmentsRepository } from "../../../lib/repositories";
import ConfirmModal from "../../../components/ConfirmModal";
import {
  DEFAULT_THERAPY_PHASE,
  DEFAULT_THERAPY_PROGRAM_ID,
  DEFAULT_THERAPY_SESSION_TYPE,
  type TherapySessionLog,
} from "../../../lib/therapy-sessions-store";
import { loadTherapySessionsForDisplay } from "../../../lib/therapy-session-persistence";
import {
  REHAB_PROGRAMS,
  type TreatmentPlan,
  type Adherence,
  type PlanSession,
} from "../../../lib/api/treatment-plans";
import type { PlanRow } from "../../../api/plans/route";
import { getClinician } from "../../../lib/auth";
import {
  listPatientAssessments,
  ASSESSMENT_TYPE_LABELS,
  PATIENT_SECTION_LABELS,
  daysUntilExpiry,
  type RemoteAssessmentRequest,
} from "../../../lib/api/remote-assessments";
import { SendAssessmentModal } from "./SendAssessmentModal";
import { PatientSubmittedAnswersReview } from "../../../components/PatientSubmittedAnswersReview";
import { SessionScheduleView } from "../../../components/SessionScheduleView";
import type { PatientProgressSummary } from "../../../api/clinician/patient-progress/route";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params.id || "");
  // numericId is kept for legacy numeric-based features (therapy, FastAPI assessments).
  // It will be NaN for UUID-based Supabase patients — those sections will show empty.
  const numericId = parseInt(id, 10);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [backendAssessmentHistory, setBackendAssessmentHistory] = useState<AssessmentOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">("idle");

  // Edit state
  const [editOpen, setEditOpen] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState<Partial<PatientRow>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [therapySessions, setTherapySessions] = useState<TherapySessionLog[]>([]);
  const [therapyLoading, setTherapyLoading] = useState(false);

  // Treatment plan state
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [adherence, setAdherence] = useState<Adherence | null>(null);
  const [planProgress, setPlanProgress] = useState<PatientProgressSummary | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Remote assessment state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [remoteAssessments, setRemoteAssessments] = useState<RemoteAssessmentRequest[]>([]);

  // RASQ new-style assessments (from rasq_assessments localStorage)
  const [rasqAssessments, setRasqAssessments] = useState<SavedAssessment[]>([]);

  // Assessment-saved banner (shown when redirected from /clinician/assessment/new)
  const [showAssessmentBanner, setShowAssessmentBanner] = useState(
    searchParams.get("assessmentSaved") === "true"
  );

  useEffect(() => {
    if (!id) { setIsLoading(false); return; }
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/patients/${id}`);
        if (res.status === 404) { notFound(); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Failed to load patient (${res.status})`);
        }
        const p = (await res.json()) as PatientRow;
        if (!isMounted) return;
        setPatient(p);
        setEditForm(p);
      } catch (err) {
        if (!isMounted) return;
        console.error("[PatientProfilePage] load error:", err);
        setPatient(null);
        setIsLoading(false);
        return;
      }

      // Local assessment archive (browser-stored)
      const localAssessments = assessmentsRepository.listByPatientId(id);
      if (isMounted) setAssessments(localAssessments);

      // Backend assessment history (FastAPI — will be empty for new Supabase-only patients)
      if (!isNaN(numericId)) {
        try {
          const history = await getPatientAssessments(numericId);
          if (isMounted) setBackendAssessmentHistory(history);
        } catch { /* ignore — FastAPI may be offline */ }
      }

      if (isMounted) setIsLoading(false);
    }
    load();
    return () => { isMounted = false; };
  }, [id, numericId]);

  useEffect(() => {
    if (!patient) return;
    const pid = String(patient.id);
    const refresh = () => {
      setTherapyLoading(true);
      void loadTherapySessionsForDisplay(pid)
        .then(setTherapySessions)
        .finally(() => setTherapyLoading(false));
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("cm-therapy-saved", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cm-therapy-saved", refresh);
    };
  }, [patient, numericId]);

  useEffect(() => {
    if (!patient) return;
    setPlanLoading(true);
    fetch(`/api/plans?patientId=${patient.id}`)
      .then(async (res) => {
        if (!res.ok) return;
        const plans = (await res.json()) as PlanRow[];
        if (plans.length > 0) {
          const p = plans[0];
          const sd = p.structured_data;
          const mapped: TreatmentPlan = {
            id:              p.id,
            patientId:       0,
            patientToken:    p.patient_token ?? undefined,
            programId:       sd?.programId ?? "custom",
            programName:     sd?.programName ?? p.title ?? "Treatment Plan",
            phase:           sd?.phase ?? "phase-1",
            phaseName:       sd?.phaseName ?? "Phase 1",
            phaseGoal:       sd?.phaseGoal ?? "",
            sessionsPerWeek: sd?.sessionsPerWeek ?? 3,
            totalSessions:   p.sessions?.length ?? 0,
            clinicianNotes:  p.clinician_note ?? "",
            assignedAt:      p.created_at,
            assignedBy:      sd?.assignedBy ?? "Clinician",
            status:          p.status as TreatmentPlan["status"],
            sessions:        (p.sessions ?? []).map((s, i) => ({
              id:              s.id,
              sessionNumber:   s.session_number ?? i + 1,
              title:           s.title,
              exercises:       s.exercises ?? [],
              estimatedMinutes: 25,
              // Map DB status (upcoming/today/completed/skipped) to UI type
              status:          (s.status === "completed"
                ? "completed"
                : s.status === "today" ? "in-progress"
                : "ready") as PlanSession["status"],
              completedAt:     s.completed_at ?? undefined,
              scheduledAt:     s.scheduled_at ?? undefined,
            } satisfies PlanSession)),
          };
          setTreatmentPlan(mapped);

          const progressRes = await fetch(
            `/api/clinician/patient-progress?patientId=${encodeURIComponent(patient.id)}&planId=${encodeURIComponent(p.id)}`,
          );
          if (progressRes.ok) {
            const progress = (await progressRes.json()) as PatientProgressSummary;
            setPlanProgress(progress);
            setAdherence({
              patientId:         0,
              sessionsCompleted: progress.sessionsCompleted,
              totalSessions:     progress.totalSessions,
              adherenceRatePct:  progress.progressPct,
              lastActiveAt:      progress.lastCompletedAt,
              weeklyCompletions: [
                { week: "W1", completed: 0, target: mapped.sessionsPerWeek },
                { week: "W2", completed: 0, target: mapped.sessionsPerWeek },
                { week: "W3", completed: 0, target: mapped.sessionsPerWeek },
                { week: "W4", completed: 0, target: mapped.sessionsPerWeek },
              ],
            });
          } else {
            setPlanProgress(null);
            setAdherence({
              patientId:        0,
              sessionsCompleted: mapped.sessions.filter((s) => s.status === "completed").length,
              totalSessions:    mapped.sessions.length,
              adherenceRatePct: mapped.sessions.length > 0
                ? Math.round((mapped.sessions.filter((s) => s.status === "completed").length / mapped.sessions.length) * 100)
                : 0,
              lastActiveAt:     null,
              weeklyCompletions: [
                { week: "W1", completed: 0, target: mapped.sessionsPerWeek },
                { week: "W2", completed: 0, target: mapped.sessionsPerWeek },
                { week: "W3", completed: 0, target: mapped.sessionsPerWeek },
                { week: "W4", completed: 0, target: mapped.sessionsPerWeek },
              ],
            });
          }
        } else {
          setPlanProgress(null);
        }
      })
      .catch(() => { /* silent — empty state shown */ })
      .finally(() => setPlanLoading(false));
  }, [patient]);

  useEffect(() => {
    if (!patient) return;
    const refreshRemote = () => setRemoteAssessments(listPatientAssessments(patient.id));
    refreshRemote();
    window.addEventListener("focus", refreshRemote);
    return () => window.removeEventListener("focus", refreshRemote);
  }, [patient?.id]);

  useEffect(() => {
    if (!patient) return;
    // Load structured RASQ assessments from Supabase
    void fetch(`/api/assessments?patientId=${patient.id}`)
      .then(async (res) => {
        if (!res.ok) return;
        const rows = (await res.json()) as AssessmentRow[];
        // Map Supabase AssessmentRow → SavedAssessment for the existing display cards
        const mapped: SavedAssessment[] = rows.map((r) => ({
          id:                r.id,
          patientId:         0,   // not used in display
          patientName:       "",  // not used in display
          type:              r.type,
          typeLabel:         r.structured_data?.bodyRegion ?? r.type,
          date:              r.created_at.split("T")[0] ?? "",
          pain:              r.structured_data?.painAtRest ?? 0,
          rom:               r.structured_data?.rom?.measurements?.[0]?.value ?? 0,
          strength:          "See assessment data",
          mobilityNotes:     r.notes ?? r.structured_data?.clinicalNotes ?? "",
          savedAt:           r.created_at,
          bodyRegion:        r.structured_data?.bodyRegion,
          rehabilitationPhase: r.structured_data?.rehabilitationPhase,
          assessmentData:    r.structured_data ?? undefined,
        }));
        setRasqAssessments(mapped);
      })
      .catch(() => { /* silently ignore — empty state shown */ });
  }, [patient]);

  const latestAssessment = useMemo(() => assessments[0] ?? null, [assessments]);
  const recentAssessments = useMemo(() => assessments.slice(0, 3), [assessments]);
  const latestRemoteAssessment = useMemo(
    () => assessments.find((a) => a.mode === "remote") ?? null,
    [assessments]
  );

  const therapyTrends = useMemo(() => {
    if (therapySessions.length === 0) {
      return {
        latestSteps: null as number | null,
        latestSymmetry: null as number | null,
        latestMovementQuality: null as number | null,
        bestSession: null as TherapySessionLog | null,
        count: 0,
      };
    }
    const latest = therapySessions[0];
    const latestSymmetry =
      latest.symmetryPct ?? latest.symmetry ?? null;
    const latestMq = latest.movementQuality ?? null;
    let best = therapySessions[0];
    for (const s of therapySessions) {
      if ((s.totalSteps ?? 0) > (best.totalSteps ?? 0)) best = s;
    }
    return {
      latestSteps: latest.totalSteps ?? null,
      latestSymmetry:
        typeof latestSymmetry === "number" && Number.isFinite(latestSymmetry)
          ? latestSymmetry
          : null,
      latestMovementQuality:
        typeof latestMq === "number" && Number.isFinite(latestMq) ? latestMq : null,
      bestSession: best,
      count: therapySessions.length,
    };
  }, [therapySessions]);

  const flowNextAction = useMemo(() => {
    const next = therapySessions[0]?.therapyRecommendation?.nextAction?.trim();
    if (next) return next;
    return "Not recorded";
  }, [therapySessions]);

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
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editForm.full_name?.trim(),
          phone: editForm.phone?.trim(),
          age: editForm.age ?? null,
          gender: editForm.gender ?? null,
          sport: editForm.sport ?? null,
          diagnosis: editForm.diagnosis?.trim(),
          status: editForm.status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to save (${res.status})`);
      }
      const updated = (await res.json()) as PatientRow;
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
      const res = await fetch(`/api/patients/${patient.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      router.push("/clinician/patients");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete patient.");
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1220]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#1E2D42] border-t-[#1D9E75]" />
          <p className="text-sm text-white/35">Loading patient record…</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B1220] text-white">
        <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-8 text-center max-w-sm">
          <p className="text-base font-bold text-white">Patient not found</p>
          <p className="mt-2 text-sm text-white/40">No record exists for this ID, or the backend is unavailable.</p>
          <Link
            href="/clinician/patients"
            className="mt-5 inline-block rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white"
          >
            ← Back to Patients
          </Link>
        </div>
      </div>
    );
  }

  const submittedRemote = remoteAssessments.filter((r) => r.status === "submitted");
  const pendingRemote   = remoteAssessments.filter((r) => r.status === "pending" || r.status === "in_progress");

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

    {/* Send Assessment Modal */}
    {sendModalOpen && (
      <SendAssessmentModal
        patientId={patient.id}
        patientName={patient.full_name}
        onClose={() => setSendModalOpen(false)}
        onCreated={() => setRemoteAssessments(listPatientAssessments(patient.id))}
      />
    )}

    <main className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/clinician/patients" className="flex items-center gap-1.5 text-sm text-white/35 transition hover:text-white/65 mb-3">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Patients
            </Link>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Patient Record</p>
            <h1 className="mt-1.5 text-2xl font-bold text-white">{patient.full_name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className="text-xs text-white/35"
                style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
              >
                #{patient.id}
              </span>
              <span className="text-xs text-white/20">·</span>
              <span className="text-xs text-white/35">{patient.diagnosis || "No diagnosis"}</span>
              <span className="text-xs text-white/20">·</span>
              <span className={`text-xs font-semibold ${patient.status?.toLowerCase() === "active" ? "text-[#5DCAA5]" : "text-amber-300"}`}>
                {patient.status}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditForm(patient); setEditOpen((o) => !o); setSaveError(""); }}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
            >
              {editOpen ? "Cancel" : "Edit Patient"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-[7px] border border-rose-400/20 bg-[#0F1825] px-4 py-2.5 text-sm font-semibold text-rose-400/60 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        {/* ── Remote assessment submitted notification ── */}
        {submittedRemote.length > 0 && submittedRemote[0] && (
          <div className="mb-6 rounded-[10px] border border-lime-300/25 bg-lime-400/[0.07] px-5 py-4">
            <div className="flex items-start gap-4">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-lime-300">
                  {submittedRemote.length === 1
                    ? "Assessment submitted by patient"
                    : `${submittedRemote.length} assessments submitted by patient`}
                </p>
                <p className="mt-0.5 text-xs text-white/50">
                  Latest: {ASSESSMENT_TYPE_LABELS[submittedRemote[0].assessmentType]} — submitted{" "}
                  {new Date(submittedRemote[0].submittedAt!).toLocaleString()}
                </p>
              </div>
              <Link
                href={`/clinician/assessment/report?patientId=${patient.id}`}
                className="shrink-0 rounded-[7px] bg-lime-400/15 px-3 py-1.5 text-xs font-semibold text-lime-300 transition hover:bg-lime-400/25"
              >
                Full Report →
              </Link>
            </div>
            <div className="mt-4 border-t border-lime-300/15 pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Patient responses (review)
              </p>
              <PatientSubmittedAnswersReview
                patientDraft={submittedRemote[0].patientDraft}
                includedSections={submittedRemote[0].includedSections}
              />
            </div>
          </div>
        )}

        {/* ── Pending remote assessment reminder ── */}
        {pendingRemote.length > 0 && submittedRemote.length === 0 && (
          <div className="mb-6 flex items-center gap-4 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.05] px-5 py-3">
            <svg className="h-4 w-4 shrink-0 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="flex-1 text-xs text-amber-200/80">
              {pendingRemote.length} remote assessment link{pendingRemote.length > 1 ? "s" : ""} awaiting patient completion.
            </p>
          </div>
        )}

        {/* Edit Form */}
        {editOpen && (
          <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
            <h2 className="text-base font-bold text-white">Edit Patient</h2>
            <p className="mt-1 text-sm text-white/40">Changes are saved to the database.</p>
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
                  className="rounded-[7px] bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white/50 transition hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            {/* Patient overview */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Patient overview</h2>
                  <p className="mt-1 text-xs text-white/35">Core identity and current case context.</p>
                </div>
                <span className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-semibold ${
                  patient.status?.toLowerCase() === "active"
                    ? "border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#5DCAA5]"
                    : "border-amber-400/25 bg-amber-400/10 text-amber-300"
                }`}>
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

            {/* Clinical actions — demo path */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
                Clinical actions
              </p>
              {/* Primary actions — demo path */}
              <div className="mb-3 flex flex-wrap gap-2">
                <Link
                  href={`/clinician/assessment/new?patientId=${patient.id}`}
                  className="rounded-[7px] bg-[#1D9E75] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#179165]"
                >
                  + New Assessment
                </Link>
                <Link
                  href={`/clinician/plans/new?patientId=${patient.id}`}
                  className="rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3.5 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/14"
                >
                  Build Plan
                </Link>
                <Link
                  href={`/clinician/progress/${patient.id}`}
                  className="rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3.5 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/14"
                >
                  View Progress
                </Link>
                <Link
                  href={`/clinician/assessment/report?patientId=${patient.id}`}
                  className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2 text-xs font-semibold text-white/55 transition hover:border-[#1D9E75]/20 hover:text-white"
                >
                  Assessment Report
                </Link>
              </div>
              {/* Secondary actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSendModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:border-[#1D9E75]/20 hover:text-white"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Send Remote Assessment
                </button>
                <button
                  type="button"
                  onClick={handleCopyLatestLink}
                  disabled={!latestRemoteAssessment}
                  className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:border-[#1D9E75]/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Copy assessment link
                </button>
                <Link
                  href={`/therapy?patientId=${patient.id}`}
                  className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:border-[#1D9E75]/20 hover:text-white"
                >
                  CV therapy session
                </Link>
              </div>
              {copyFeedback === "success" && (
                <p className="mt-2.5 text-xs text-[#5DCAA5]">Assessment link copied to clipboard.</p>
              )}
              {copyFeedback === "error" && (
                <p className="mt-2.5 text-xs text-rose-300">Could not copy link.</p>
              )}
            </section>

            {/* Assessment saved banner */}
            {showAssessmentBanner && (
              <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[#1D9E75]/30 bg-[#1D9E75]/8 px-4 py-3">
                <p className="text-sm text-[#5DCAA5]">
                  Assessment saved.{" "}
                  <span className="text-[#5DCAA5]/70">
                    Suggested programs will appear here in the next update.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setShowAssessmentBanner(false)}
                  className="mt-0.5 shrink-0 text-xs text-white/25 transition hover:text-white/60"
                >
                  ✕
                </button>
              </div>
            )}

            {/* RASQ Baseline Assessments */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Clinical Assessments
                </p>
                <Link
                  href={`/clinician/assessment/new?patientId=${patient.id}`}
                  className="text-[11px] font-semibold text-[#5DCAA5] hover:text-[#1D9E75]"
                >
                  + New
                </Link>
              </div>
              {rasqAssessments.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No assessment recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {rasqAssessments.slice(0, 3).map((a) => (
                    <div key={a.id} className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">
                          {a.bodyRegion ?? a.typeLabel}
                        </p>
                        <p
                          className="text-[10px] text-white/30"
                          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                        >
                          {a.date}
                        </p>
                      </div>
                      <p
                        className="mt-1 text-xs text-white/40"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {a.assessmentData
                          ? `Rest ${a.assessmentData.painAtRest}/10 · Move ${a.assessmentData.painOnMovement}/10 · ${a.rehabilitationPhase ?? "—"} phase`
                          : `Pain ${a.pain}/10 · ROM ${a.rom || "—"}° · Strength ${a.strength}`}
                      </p>
                      {a.mobilityNotes && (
                        <p className="mt-1.5 text-xs leading-5 text-white/35 line-clamp-2">
                          {a.mobilityNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Treatment Plan Assignment */}
            <TreatmentPlanSection
              patientId={patient.id}
              plan={treatmentPlan}
              adherence={adherence}
              planProgress={planProgress}
              loading={planLoading}
              onPlanUpdated={(p, a) => {
                setTreatmentPlan(p);
                setAdherence(a);
                setPlanProgress(null);
                if (p?.id) {
                  void fetch(
                    `/api/clinician/patient-progress?patientId=${encodeURIComponent(patient.id)}&planId=${encodeURIComponent(p.id)}`,
                  )
                    .then(async (res) => (res.ok ? (res.json() as Promise<PatientProgressSummary>) : null))
                    .then((prog) => setPlanProgress(prog));
                }
              }}
            />

            {/* Patient access link */}
            {treatmentPlan?.patientToken && (
              <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
                  Patient access
                </p>
                <div className="mt-3 flex items-center gap-3 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
                  <p
                    className="flex-1 truncate text-[13px] text-[#5DCAA5]"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    {typeof window !== "undefined" ? window.location.origin : ""}/patient/{treatmentPlan.patientToken}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/patient/${treatmentPlan.patientToken}`;
                      navigator.clipboard.writeText(url).then(() => {
                        setCopyFeedback("success");
                        setTimeout(() => setCopyFeedback("idle"), 2000);
                      }).catch(() => setCopyFeedback("error"));
                    }}
                    className="shrink-0 rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:border-[#1D9E75]/30 hover:text-white"
                  >
                    {copyFeedback === "success" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-white/25">
                  Share this link with the patient. No login required.
                </p>
              </section>
            )}

            {/* Assessment History (backend) */}
            <section
              id="assessment-timeline"
              className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6"
            >
              <h2 className="text-lg font-bold text-white">Assessment History</h2>
              <p className="mt-2 text-sm text-white/70">
                Server assessments for this patient (aligned with future SOAP documentation). Score shown when a matching
                local session records a numeric result.
              </p>
              <div className="mt-5 space-y-3">
                {backendAssessmentHistory.length > 0 ? (
                  backendAssessmentHistory.map((row) => {
                    const matchedLocal = assessments.find((a) => a.id === String(row.id));
                    const scoreDisplay =
                      typeof matchedLocal?.score === "number" && Number.isFinite(matchedLocal.score)
                        ? `${matchedLocal.score}%`
                        : "—";
                    const testsLabel =
                      row.selected_tests.length > 0
                        ? row.selected_tests.map(formatTestLabel).join(", ")
                        : "Not recorded";
                    return (
                      <div
                        key={`backend-${row.id}`}
                        className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-white">{row.type || "Assessment"}</h3>
                            <p className="mt-1 text-sm text-white/60">
                              {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <ResultPill
                              label={`Score: ${scoreDisplay}`}
                              tone="score"
                            />
                            <ResultPill
                              label={row.status || "—"}
                              tone={
                                row.status === "completed"
                                  ? "good"
                                  : row.status === "in_progress"
                                    ? "score"
                                    : "neutral"
                              }
                            />
                            {row.mode ? <ResultPill label={row.mode} tone="neutral" /> : null}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-white/70">
                          <span className="font-medium text-white/80">Tests included: </span>
                          {testsLabel}
                        </p>
                        {row.notes ? (
                          <p className="mt-2 text-sm leading-6 text-white/60">{row.notes}</p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/results?patientId=${patient.id}&assessmentId=${row.id}`}
                            className="inline-flex items-center rounded-[7px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-4 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
                          >
                            Open Report
                          </Link>
                        </div>
                        <div className="mt-3 rounded-[7px] border border-dashed border-[#1E2D42] bg-[#0B1220] px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                            SOAP / Clinical notes
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                            Placeholder — subjective, objective, assessment, and plan will appear here per encounter.
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-5">
                    <p className="text-xs text-[#6B7280]">No assessment recorded yet.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Full Assessment History (local) */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-lg font-bold text-white">Full Assessment History</h2>
              <p className="mt-2 text-sm text-white/70">
                In-browser session archive on this workstation (longitudinal tracking).
              </p>
              <div className="mt-5 space-y-4">
                {assessments.length > 0 ? (
                  assessments.map((item) => (
                    <div key={item.id} className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            {item.sessionLabel?.trim() ||
                              (item.mode === "remote" ? "Remote Assessment" : "In-Clinic Assessment")}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ResultPill
                            label={
                              typeof item.score === "number"
                                ? `Score: ${item.score}%`
                                : "Score: —"
                            }
                            tone="score"
                          />
                          <ResultPill
                            label={formatStatusLabel(item.status)}
                            tone={item.status === "completed" ? "good" : "neutral"}
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/70">
                        <span className="font-medium text-white/80">Tests included: </span>
                        {item.selectedTests.length > 0
                          ? item.selectedTests.map(formatTestLabel).join(", ")
                          : "Not recorded"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/results?patientId=${patient.id}&assessmentId=${item.id}`}
                          className="inline-flex items-center rounded-[7px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-4 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
                        >
                          Open Report
                        </Link>
                      </div>
                      <div className="mt-3 rounded-[7px] border border-dashed border-[#1E2D42] bg-[#0B1220] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          SOAP / Clinical notes
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                          Placeholder — encounter narrative will sync here when documentation is enabled.
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-5">
                    <p className="text-xs text-[#6B7280]">No assessment recorded yet.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-lg font-bold text-white">SOAP / Clinical Notes</h2>
              <p className="mt-2 text-sm text-white/70">
                Structured encounter documentation (coming soon). This section will hold subjective, objective,
                assessment, and plan per visit.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SoapPlaceholderCard title="Subjective" />
                <SoapPlaceholderCard title="Objective" />
                <SoapPlaceholderCard title="Assessment" />
                <SoapPlaceholderCard title="Plan" />
              </div>
            </section>

            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
              <h2 className="text-lg font-bold text-white">Therapy Session Results</h2>
              <p className="mt-2 text-sm text-white/70">
                Camera CV stepping / gait sessions saved for chart ID{" "}
                <span className="font-medium text-[#5DCAA5]">{patient.id}</span>. Data is loaded from the therapy API
                when available, with local-only rows if the device was offline.
              </p>

              <div className="mt-6">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Care flow
                </p>
                <TherapyProgressFlow nextActionLine={flowNextAction} />
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Therapy trends
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoCard
                    label="Latest total steps"
                    value={
                      therapyTrends.latestSteps != null ? String(therapyTrends.latestSteps) : "—"
                    }
                  />
                  <InfoCard
                    label="Latest symmetry"
                    value={
                      therapyTrends.latestSymmetry != null
                        ? `${therapyTrends.latestSymmetry}%`
                        : "—"
                    }
                  />
                  <InfoCard
                    label="Latest movement quality"
                    value={
                      therapyTrends.latestMovementQuality != null
                        ? String(therapyTrends.latestMovementQuality)
                        : "—"
                    }
                  />
                  <InfoCard
                    label="Best session (steps)"
                    value={
                      therapyTrends.bestSession
                        ? `${therapyTrends.bestSession.totalSteps ?? "—"} reps · ${therapyTrends.bestSession.recordedAt ? new Date(therapyTrends.bestSession.recordedAt).toLocaleDateString() : "—"}`
                        : "—"
                    }
                  />
                  <InfoCard
                    label="Logged therapy sessions"
                    value={String(therapyTrends.count)}
                  />
                </div>
              </div>

              {therapyLoading && (
                <div className="mt-5 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4 text-sm text-white/40">
                  Loading therapy reports…
                </div>
              )}

              <div className="mt-5 space-y-5">
                {!therapyLoading && therapySessions.length > 0 ? (
                  therapySessions.map((t) => (
                    <TherapySessionHistoryEntry key={t.id} t={t} patientNumericId={numericId || 0} />
                  ))
                ) : !therapyLoading ? (
                  <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-5 text-sm text-white/40">
                    No therapy sessions logged for this patient ID yet. Run camera therapy and save using this numeric
                    chart ID.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* ── Remote Assessments panel ── */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Remote</p>
                  <h2 className="text-base font-bold text-white">Sent Assessments</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSendModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-[7px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Send New
                </button>
              </div>

              {remoteAssessments.length === 0 ? (
                <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-5 text-center">
                  <p className="text-xs text-[#6B7280]">No remote assessments sent yet.</p>
                  <button
                    type="button"
                    onClick={() => setSendModalOpen(true)}
                    className="mt-2 text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
                  >
                    Send first assessment →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {remoteAssessments.slice(0, 5).map((ra) => {
                    const isSubmitted = ra.status === "submitted";
                    const isPending   = ra.status === "pending";
                    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/assessment/${ra.id}`;
                    return (
                      <div
                        key={ra.id}
                        className={`overflow-hidden rounded-[8px] border ${
                          isSubmitted ? "border-[#1D9E75]/20 bg-[#1D9E75]/[0.04]" :
                          isPending   ? "border-[#1E2D42] bg-[#0B1220]" :
                          "border-amber-400/15 bg-amber-400/[0.03]"
                        }`}
                      >
                        <div className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-semibold text-white/80">
                                {ASSESSMENT_TYPE_LABELS[ra.assessmentType]}
                              </p>
                              <p className="mt-0.5 text-[11px] text-white/40">
                                {new Date(ra.createdAt).toLocaleDateString()} ·{" "}
                                {ra.includedSections.length} sections
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-bold ${
                              isSubmitted ? "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#5DCAA5]" :
                              isPending   ? "border-[#1E2D42] bg-[#0B1220] text-white/40" :
                              "border-amber-400/25 bg-amber-400/10 text-amber-300"
                            }`}>
                              {isSubmitted ? "Submitted" : isPending ? "Pending" : "In Progress"}
                            </span>
                          </div>

                          {!isSubmitted && (
                            <p className="mt-1 text-[11px] text-white/30">
                              Expires in {daysUntilExpiry(ra)} days
                            </p>
                          )}
                          {isSubmitted && (
                            <div className="mt-3 border-t border-[#1E2D42] pt-3">
                              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                                Patient responses
                              </p>
                              <PatientSubmittedAnswersReview
                                patientDraft={ra.patientDraft}
                                includedSections={ra.includedSections}
                                compact
                              />
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-px border-t border-[#1E2D42]">
                          {isSubmitted ? (
                            <Link
                              href={`/clinician/assessment/report?patientId=${patient.id}`}
                              className="flex-1 px-3 py-2.5 text-center text-[11px] font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/5"
                            >
                              Full Report →
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
                              }}
                              className="flex-1 px-3 py-2.5 text-center text-[11px] font-semibold text-white/40 transition hover:bg-[#0B1220] hover:text-white/70"
                            >
                              Copy Link
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recent Results (local) */}
            {recentAssessments.length > 0 && (
              <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
                <h2 className="text-base font-bold text-white">Recent Sessions</h2>
                <p className="mt-2 text-sm text-white/70">Last 3 assessments.</p>
                <div className="mt-4 space-y-3">
                  {recentAssessments.map((item) => (
                    <div key={`${item.id}-recent`} className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
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
                          className="inline-flex items-center rounded-[7px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-3 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
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

/** Display-only: kebab slug → clinical title (e.g. strength-activation-session). */
function formatSessionTypeLabel(slug: string): string {
  const s = slug.trim();
  if (!s) return s;
  return s
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function TherapyProgressFlow({ nextActionLine }: { nextActionLine: string }) {
  const steps: { label: string; detail: string }[] = [
    { label: "Assessment", detail: "Structured capture & review" },
    { label: "Recommended therapy", detail: "Program routing from results" },
    { label: "Camera CV session", detail: "In-browser stepping session" },
    { label: "Therapy result", detail: "Metrics saved to chart" },
    {
      label: "Next action",
      detail: nextActionLine.length > 120 ? `${nextActionLine.slice(0, 117)}…` : nextActionLine,
    },
  ];
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[720px] items-stretch gap-1 md:gap-2">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <div className="min-w-0 flex-1 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/25">
                {s.label}
              </p>
              <p className="mt-1.5 text-xs leading-snug text-white/70">{s.detail}</p>
            </div>
            {i < steps.length - 1 ? (
              <span
                className="flex shrink-0 items-center px-0.5 text-lg font-light text-white/20"
                aria-hidden
              >
                →
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SoapPlaceholderCard({ title }: { title: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#1E2D42] bg-[#0B1220] p-4">
      <p className="text-xs font-semibold text-white/70">{title}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">Coming soon — not recorded.</p>
    </div>
  );
}

function TherapySessionHistoryEntry({
  t,
  patientNumericId,
}: {
  t: TherapySessionLog;
  patientNumericId: number;
}) {
  const rec = t.therapyRecommendation;
  const programId = t.programId ?? DEFAULT_THERAPY_PROGRAM_ID;
  const phase = t.phase ?? DEFAULT_THERAPY_PHASE;
  const sessionType = t.sessionType ?? DEFAULT_THERAPY_SESSION_TYPE;
  const left = t.leftKneeCount;
  const right = t.rightKneeCount;
  const dataSource = t.backendRowId != null ? "Backend" : "Local";
  const symDisplay =
    t.symmetryPct != null
      ? `${t.symmetryPct}%`
      : t.symmetry != null
        ? `${t.symmetry}%`
        : "—";

  return (
    <article
      className={`rounded-[10px] border bg-[#0B1220] p-5 ${
        t.assessmentId?.trim() ? "border-[#1D9E75]/20" : "border-[#1E2D42]"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <p className="text-lg font-semibold text-white">
            {t.exerciseName?.trim() || t.programLabel || "Camera CV therapy"}
          </p>
          <p className="mt-1 text-sm text-white/55">
            {t.recordedAt ? new Date(t.recordedAt).toLocaleString() : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResultPill label={`Source: ${dataSource}`} tone={t.backendRowId != null ? "good" : "neutral"} />
          <ResultPill label={`Score: ${t.score ?? "—"}`} tone="score" />
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Patient ID" value={String(patientNumericId)} />
        <InfoCard label="Assessment ID" value={t.assessmentId?.trim() || "—"} />
        <InfoCard
          label="Program / phase / session type"
          value={`${programId} · ${phase} · ${formatSessionTypeLabel(sessionType)}`}
        />
      </div>

      <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Session metrics
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Total steps" value={t.totalSteps != null ? String(t.totalSteps) : "—"} />
        <InfoCard
          label="Left / right steps"
          value={`${left != null ? left : "—"} / ${right != null ? right : "—"}`}
        />
        <InfoCard label="Symmetry" value={symDisplay} />
        <InfoCard
          label="Movement quality"
          value={t.movementQuality != null ? String(t.movementQuality) : "—"}
        />
        <InfoCard
          label="Duration (s)"
          value={t.duration != null && Number.isFinite(t.duration) ? String(t.duration) : "—"}
        />
        <InfoCard label="Score" value={t.score != null ? String(t.score) : "—"} />
      </div>

      {rec ? (
        <div className="mt-5 rounded-[8px] border border-[#1D9E75]/20 bg-[#1D9E75]/[0.05] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            Clinical interpretation &amp; therapy guidance
          </p>
          <p className="mt-1 text-[10px] text-white/45">
            Rule-based decision support captured at save time — not a medical diagnosis.
          </p>
          {rec.interpretation.length > 0 ? (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Interpretation
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-white/70">
                {rec.interpretation.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-white/50">Interpretation: Not recorded.</p>
          )}
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
            <p className="text-white/65">
              <span className="font-semibold text-white/80">Recommendation — progression: </span>
              {rec.progressionStatus}
            </p>
            <p className="text-white/65">
              <span className="font-semibold text-white/80">Recommendation — next action: </span>
              {rec.nextAction}
            </p>
            <p className="text-[11px] leading-relaxed text-white/60">
              <span className="font-semibold text-white/75">Safety / intensity: </span>
              {rec.intensityNote}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4 text-xs text-white/40">
          <span className="font-semibold text-white/55">Clinical interpretation: </span>
          Not recorded for this session.
        </div>
      )}

      {t.therapyContextReason ? (
        <p className="mt-4 text-xs leading-relaxed text-white/55">
          <span className="font-medium text-white/65">Therapy context: </span>
          {t.therapyContextReason}
        </p>
      ) : null}

      <p className="mt-4 border-t border-white/8 pt-3 text-[10px] leading-relaxed text-slate-500">
        Safety note: All metrics and guidance above are decision-support only and require qualified clinical judgment.
        They do not constitute a diagnosis or treatment plan.
      </p>
    </article>
  );
}

// ── TreatmentPlanSection ──────────────────────────────────────────────────────

interface TreatmentPlanSectionProps {
  patientId: string;
  plan: TreatmentPlan | null;
  adherence: Adherence | null;
  planProgress: PatientProgressSummary | null;
  loading: boolean;
  onPlanUpdated: (plan: TreatmentPlan, adherence: Adherence | null) => void;
}

function clinicianSessionDisplayStatus(
  sessions: Array<{ id: string; status: string }>,
  session: { id: string; status: string },
): "completed" | "in-progress" | "upcoming" {
  if (session.status === "completed") return "completed";
  const first = sessions.find((s) => s.status !== "completed");
  if (first?.id === session.id) return "in-progress";
  return "upcoming";
}

function TreatmentPlanSection({
  patientId,
  plan,
  adherence,
  planProgress,
  loading,
  onPlanUpdated,
}: TreatmentPlanSectionProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState(REHAB_PROGRAMS[0].id);
  const [selectedPhase, setSelectedPhase] = useState(REHAB_PROGRAMS[0].phases[0].id);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [notes, setNotes] = useState("");

  const selectedProgram = REHAB_PROGRAMS.find((p) => p.id === selectedProgramId) ?? REHAB_PROGRAMS[0];
  const selectedPhaseObj = selectedProgram.phases.find((ph) => ph.id === selectedPhase) ?? selectedProgram.phases[0];

  function handleProgramChange(programId: string) {
    setSelectedProgramId(programId);
    const prog = REHAB_PROGRAMS.find((p) => p.id === programId);
    if (prog) setSelectedPhase(prog.phases[0].id);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setAssignError("");
    try {
      const clinician = getClinician();
      const prog  = REHAB_PROGRAMS.find((p) => p.id === selectedProgramId) ?? REHAB_PROGRAMS[0];
      const phase = prog.phases.find((ph) => ph.id === selectedPhase) ?? prog.phases[0];

      const sessions: PlanSession[] = Array.from({ length: phase.defaultSessions }, (_, i) => ({
        id:              `s-${i + 1}`,
        sessionNumber:   i + 1,
        title:           i % 2 === 0
          ? `${phase.name.split("—")[1]?.trim() ?? "Rehab"} Session A`
          : `${phase.name.split("—")[1]?.trim() ?? "Rehab"} Session B`,
        exercises:       phase.exercises,
        estimatedMinutes: 25,
        status:          "ready" as const,
      }));

      const res = await fetch("/api/plans", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          title:          prog.name,
          programId:      prog.id,
          programName:    prog.name,
          phase:          phase.id,
          phaseName:      phase.name,
          phaseGoal:      phase.goal,
          sessionsPerWeek,
          totalWeeks:     Math.ceil(phase.defaultSessions / sessionsPerWeek),
          clinicianNote:  notes,
          assignedBy:     clinician?.full_name ?? "Clinician",
          sessions:       sessions.map((s) => ({
            sessionNumber: s.sessionNumber,
            title:         s.title,
            exercises:     s.exercises,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to assign plan (${res.status})`);
      }

      const planRow = (await res.json()) as PlanRow;
      if (!planRow.patient_token) {
        throw new Error("Plan was not fully created. Please try again.");
      }
      const sd = planRow.structured_data;
      const newPlan: TreatmentPlan = {
        id:              planRow.id,
        patientId:       0,
        patientToken:    planRow.patient_token ?? undefined,
        programId:       sd?.programId ?? prog.id,
        programName:     sd?.programName ?? prog.name,
        phase:           sd?.phase ?? phase.id,
        phaseName:       sd?.phaseName ?? phase.name,
        phaseGoal:       sd?.phaseGoal ?? phase.goal,
        sessionsPerWeek,
        totalSessions:   sessions.length,
        clinicianNotes:  notes,
        assignedAt:      planRow.created_at,
        assignedBy:      clinician?.full_name ?? "Clinician",
        status:          "active",
        sessions,
      };

      onPlanUpdated(newPlan, null);
      setAssignOpen(false);
      setNotes("");
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign plan.");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
        <p className="text-sm text-white/40">Loading treatment plan…</p>
      </section>
    );
  }

  return (
    <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
            Treatment Plan
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">
            {plan ? plan.programName : "No treatment plan assigned yet."}
          </h2>
          {plan && (
            <p className="mt-0.5 text-sm text-white/40">{plan.phaseName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAssignOpen((v) => !v)}
          className="shrink-0 rounded-[7px] bg-[#1D9E75] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#179165]"
        >
          {plan ? "Reassign Plan" : "Assign Plan"}
        </button>
      </div>

      {!plan && !assignOpen && (
        <p className="text-xs text-[#6B7280]">No treatment plan assigned yet.</p>
      )}

      {/* Current plan summary */}
      {plan && !assignOpen && (
        <div className="space-y-3">
          <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">Goal</p>
            <p className="text-sm text-white/70">{plan.phaseGoal}</p>
          </div>

          <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
              Patient progress (Supabase)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                {
                  label: "Sessions",
                  value: planProgress
                    ? `${planProgress.sessionsCompleted} / ${planProgress.totalSessions}`
                    : adherence
                      ? `${adherence.sessionsCompleted} / ${adherence.totalSessions}`
                      : "—",
                },
                {
                  label: "Progress",
                  value: planProgress
                    ? `${planProgress.progressPct}%`
                    : adherence
                      ? `${adherence.adherenceRatePct}%`
                      : "—",
                },
                {
                  label: "Latest effort",
                  value: planProgress?.latestEffortScore != null
                    ? `${planProgress.latestEffortScore}/10`
                    : "—",
                },
                {
                  label: "Latest pain",
                  value: planProgress?.latestPainScore != null
                    ? `${planProgress.latestPainScore}/10`
                    : "—",
                },
                {
                  label: "Per week",
                  value: `${plan.sessionsPerWeek}×`,
                },
                {
                  label: "Last completed",
                  value: planProgress?.lastCompletedAt
                    ? new Date(planProgress.lastCompletedAt).toLocaleDateString()
                    : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-[8px] border border-[#1E2D42] bg-[#0F1825] p-3">
                  <p className="text-[10px] text-white/35">{label}</p>
                  <p
                    className="mt-0.5 text-sm font-bold text-[#5DCAA5]"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {adherence && (
            <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
                Weekly Progress
              </p>
              <div className="flex items-end gap-1.5">
                {adherence.weeklyCompletions.map((w) => {
                  const fillPct = w.target > 0 ? Math.round((w.completed / w.target) * 100) : 0;
                  return (
                    <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                      <div className="relative h-12 w-full overflow-hidden rounded-[3px] bg-[#1E2D42]">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-[3px] bg-[#1D9E75]/70 transition-all"
                          style={{ height: `${fillPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-white/30">{w.week}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-white/35">
                {adherence.sessionsCompleted} / {adherence.totalSessions} sessions completed
                {adherence.lastActiveAt && (
                  <> · Last active {new Date(adherence.lastActiveAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
          )}

          {plan.clinicianNotes && (
            <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">
                Clinician Notes
              </p>
              <p className="text-sm text-white/60">{plan.clinicianNotes}</p>
            </div>
          )}

          <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
              Session schedule ({plan.sessions.filter((s) => s.status !== "completed").length} remaining)
            </p>
            <SessionScheduleView
              sessions={plan.sessions.map((s) => ({
                id: s.id,
                sessionNumber: s.sessionNumber,
                title: s.title,
                exercises: s.exercises,
                status: s.status === "completed" ? "completed" : s.status,
                scheduledAt: s.scheduledAt ?? null,
                completedAt: s.completedAt ?? null,
              }))}
              sessionsPerWeek={plan.sessionsPerWeek}
              variant="clinician"
              getDisplayStatus={clinicianSessionDisplayStatus}
            />
          </div>
        </div>
      )}

      {/* Assignment form */}
      {assignOpen && (
        <form onSubmit={handleAssign} className="space-y-4 pt-1">
          <div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/30">
                Program <span className="text-rose-400">*</span>
              </span>
              <select
                value={selectedProgramId}
                onChange={(e) => handleProgramChange(e.target.value)}
                className="w-full rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3 text-sm text-white outline-none focus:border-[#1D9E75]/40"
              >
                {REHAB_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0B1220]">
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/30">
              Phase <span className="text-rose-400">*</span>
            </p>
            <div className="space-y-2">
              {selectedProgram.phases.map((ph) => (
                <label
                  key={ph.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[7px] border p-3 transition ${
                    selectedPhase === ph.id
                      ? "border-[#1D9E75]/30 bg-[#1D9E75]/8"
                      : "border-[#1E2D42] bg-[#0B1220] hover:border-[#1D9E75]/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="phase"
                    value={ph.id}
                    checked={selectedPhase === ph.id}
                    onChange={() => setSelectedPhase(ph.id)}
                    className="mt-0.5 accent-[#1D9E75]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{ph.name}</p>
                    <p className="mt-0.5 text-xs text-white/45">{ph.goal}</p>
                    <p className="mt-1 text-xs text-[#5DCAA5]/70">
                      {ph.durationHint} · {ph.defaultSessions} sessions
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/30">Sessions per week</span>
              <div className="flex items-center gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSessionsPerWeek(n)}
                    className={`rounded-[7px] px-4 py-2 text-sm font-semibold transition ${
                      sessionsPerWeek === n
                        ? "bg-[#1D9E75] text-white"
                        : "border border-[#1E2D42] bg-[#0B1220] text-white/60 hover:text-white"
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/30">Clinician notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={`Phase goal: ${selectedPhaseObj.goal}`}
                className="w-full resize-none rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#1D9E75]/40"
              />
            </label>
          </div>

          {assignError && (
            <p className="rounded-[7px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-300">{assignError}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={assigning}
              className="rounded-[7px] bg-[#1D9E75] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165] disabled:opacity-60"
            >
              {assigning ? "Assigning…" : plan ? "Update Plan" : "Assign Plan"}
            </button>
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-6 py-2.5 text-sm font-semibold text-white/50 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const inputCls =
  "w-full rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-[#1D9E75]/40";

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
    ? "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#5DCAA5]"
    : tone === "score"
      ? "border-[#1D9E75]/20 bg-[#1D9E75]/8 text-[#5DCAA5]"
      : "border-[#1E2D42] bg-[#0B1220] text-white/70";
  return <span className={`rounded-[5px] border px-2.5 py-1 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function Badge({ text }: { text: string }) {
  return <span className="rounded-[5px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-2.5 py-1 text-[11px] font-medium text-[#5DCAA5]">{text}</span>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0B1220] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p
        className="mt-1.5 text-sm font-semibold text-white"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
    </div>
  );
}
