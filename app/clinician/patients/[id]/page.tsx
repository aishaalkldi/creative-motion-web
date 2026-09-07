"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams, notFound } from "next/navigation";
import type { AssessmentRecord } from "../../../lib/domain-types";
import type { AssessmentListRow, AssessmentRow } from "../../../api/assessments/route";
import { pickPreferredAssessment } from "../../../lib/assessment-snapshot";
import {
  extractGeneralDraft,
  extractStructuredData,
} from "../../../lib/assessment-payload";
import type { PatientRow } from "../../../lib/validate-patient-ownership";
import { assessmentsRepository } from "../../../lib/repositories";
import ConfirmModal from "../../../components/ConfirmModal";
import {
  type TreatmentPlan,
  type Adherence,
  type PlanSession,
} from "../../../lib/api/treatment-plans";
import type { PlanRow } from "../../../api/plans/route";
import {
  listPatientAssessments,
  ASSESSMENT_TYPE_LABELS,
  daysUntilExpiry,
  type RemoteAssessmentRequest,
} from "../../../lib/api/remote-assessments";
import { SendAssessmentModal } from "./SendAssessmentModal";
import { SessionScheduleView } from "../../../components/SessionScheduleView";
import { ClinicalActionCard } from "../../../components/clinician/ClinicalActionCard";
import { PatientJourneyTimeline } from "../../../components/clinician/PatientJourneyTimeline";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import { GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES } from "@/app/lib/cv/gait-assessment-exercise-ids";
import { indexCvMetricsByPlanSessionId } from "@/app/lib/cv/clinician-session-camera-status";
import { useCvSessionMetrics } from "@/app/hooks/useCvSessionMetrics";
import { PatientAssessmentsSummary } from "../../../components/clinician/PatientAssessmentsSummary";
import {
  formatLastSessionCompletedLine,
  formatSessionsCompletedLine,
  OPERATIONAL_STATUS_ONLY,
} from "@/app/lib/clinician/adherence-display";
import type { PatientProgressSummary, PatientTimelineBundle } from "../../../api/clinician/patient-progress/route";
import { buildPatientTimeline } from "../../../lib/clinician/patient-timeline";
import { buildRemoteQuestionnaireSummary } from "../../../lib/remote-questionnaire-summary";
import { isStrokeClinicianData } from "@/app/components/clinician/StrokeQuestionnaireClinicianPanel";
import { OBJECTIVE_CV_EXERCISE_IDS } from "@/app/lib/progress/objective-assessment-series";
import { displayPatientFileHeader } from "../../../lib/patient-file-number";
import { resolveCurrentAndPreviousPlans } from "../../../lib/clinician/resolve-current-plan";
import { PreviousPlansSummary } from "../../../components/clinician/PreviousPlansSummary";
import { PatientObjectiveResultsSection } from "@/app/components/clinician/progress/PatientObjectiveResultsSection";
import { DemoOfflineBanner } from "@/app/components/clinician/DemoOfflineBanner";
import { extractDemoMeta } from "@/app/lib/api/demo-fallback-client";
import { isUuidPatientId } from "@/app/lib/api/patient-id-utils";
import { forwardReachAssignmentPatientRoute } from "@/app/lib/upper-limb-motor-screen/forward-reach-assignment-client";

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params.id || "");

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
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

  // Treatment plan state
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [adherence, setAdherence] = useState<Adherence | null>(null);
  const [planProgress, setPlanProgress] = useState<PatientProgressSummary | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [patientPlanRows, setPatientPlanRows] = useState<PlanRow[]>([]);
  const [previousPlanRows, setPreviousPlanRows] = useState<PlanRow[]>([]);
  const [timelineBundle, setTimelineBundle] = useState<PatientTimelineBundle | null>(null);
  const { metrics: patientCvMetrics, demoMode: cvDemoMode, demoNotice: cvDemoNotice } = useCvSessionMetrics({
    patientId: patient?.id,
    limit: 30,
    dedupePatientSessions: false,
  });

  // Remote assessment state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [remoteAssessments, setRemoteAssessments] = useState<RemoteAssessmentRequest[]>([]);

  // RASQ new-style assessments (from rasq_assessments localStorage)
  const [supabaseAssessmentRows, setSupabaseAssessmentRows] = useState<AssessmentListRow[]>([]);
  const [clinicalSummaryDetail, setClinicalSummaryDetail] = useState<AssessmentRow | null>(null);

  // Assessment-saved banner (shown when redirected from /clinician/assessment/new)
  const [showAssessmentBanner, setShowAssessmentBanner] = useState(
    searchParams.get("assessmentSaved") === "true"
  );

  // Plan-assigned banner (shown when redirected from /clinician/plans/new)
  const [showPlanAssignedBanner, setShowPlanAssignedBanner] = useState(
    searchParams.get("planAssigned") === "1"
  );
  const [demoMode, setDemoMode] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

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
        const p = (await res.json()) as PatientRow & { demoMode?: boolean; demoNotice?: string };
        if (!isMounted) return;
        const meta = extractDemoMeta(p);
        setDemoMode(meta.demoMode);
        setDemoNotice(meta.demoNotice);
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

      if (isMounted) setIsLoading(false);
    }
    load();
    return () => { isMounted = false; };
  }, [id]);

  useEffect(() => {
    if (!patient) return;
    const planAssigned = searchParams.get("planAssigned") === "1";
    setPlanLoading(true);
    fetch(`/api/plans?patientId=${patient.id}`)
      .then(async (res) => {
        if (!res.ok) return;
        const plans = (await res.json()) as PlanRow[];
        setPatientPlanRows(plans);
        const { currentPlan, previousPlans } = resolveCurrentAndPreviousPlans(plans);
        setPreviousPlanRows(previousPlans);
        if (currentPlan) {
          const p = currentPlan;
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
          setTreatmentPlan(null);
          setPlanProgress(null);
          setPreviousPlanRows([]);
        }
      })
      .catch(() => { /* silent — empty state shown */ })
      .finally(() => {
        setPlanLoading(false);
        if (planAssigned) {
          setShowPlanAssignedBanner(true);
          router.replace(`/clinician/patients/${id}`, { scroll: false });
        }
      });
  }, [patient, searchParams, router, id]);

  useEffect(() => {
    if (!patient) return;
    const refreshTimeline = () => {
      void fetch(`/api/clinician/patient-progress?patientId=${encodeURIComponent(patient.id)}&timelineOnly=1`)
        .then(async (res) => {
          if (!res.ok) return;
          setTimelineBundle((await res.json()) as PatientTimelineBundle);
        })
        .catch(() => {
          setTimelineBundle(null);
        });
    };
    refreshTimeline();
    window.addEventListener("focus", refreshTimeline);
    document.addEventListener("visibilitychange", refreshTimeline);
    return () => {
      window.removeEventListener("focus", refreshTimeline);
      document.removeEventListener("visibilitychange", refreshTimeline);
    };
  }, [patient?.id]);

  useEffect(() => {
    if (!patient) return;
    const refreshRemote = () => {
      void listPatientAssessments(patient.id).then(setRemoteAssessments);
    };
    refreshRemote();
    window.addEventListener("focus", refreshRemote);
    document.addEventListener("visibilitychange", refreshRemote);
    return () => {
      window.removeEventListener("focus", refreshRemote);
      document.removeEventListener("visibilitychange", refreshRemote);
    };
  }, [patient?.id]);

  const refreshClinicalAssessments = useCallback(async () => {
    if (!patient) return;
    try {
      const res = await fetch(`/api/assessments?patientId=${patient.id}`);
      if (!res.ok) return;
      const rows = (await res.json()) as AssessmentListRow[];
      setSupabaseAssessmentRows(rows);

      const preferred = pickPreferredAssessment(rows);
      if (!preferred) {
        setClinicalSummaryDetail(null);
        return;
      }

      const detailRes = await fetch(`/api/assessments/${encodeURIComponent(preferred.id)}`);
      if (!detailRes.ok) {
        setClinicalSummaryDetail(null);
        return;
      }
      setClinicalSummaryDetail((await detailRes.json()) as AssessmentRow);
    } catch {
      /* silently ignore — empty state shown */
    }
  }, [patient?.id]);

  useEffect(() => {
    if (!patient) return;
    void refreshClinicalAssessments();
    const onRefresh = () => void refreshClinicalAssessments();
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [patient, refreshClinicalAssessments]);

  const latestRemoteAssessment = useMemo(
    () => assessments.find((a) => a.mode === "remote") ?? null,
    [assessments]
  );

  const clinicalSummaryRow = clinicalSummaryDetail;

  const clinicalSummary = useMemo(() => {
    if (!clinicalSummaryRow) return null;
    if (clinicalSummaryRow.type === "remote_questionnaire") {
      if (isStrokeClinicianData(clinicalSummaryRow.structured_data)) {
        return {
          title: "Remote Neurorehabilitation Intake",
          submittedAt: clinicalSummaryRow.created_at,
        };
      }
      return {
        title:
          buildRemoteQuestionnaireSummary(
            clinicalSummaryRow.structured_data,
            clinicalSummaryRow.created_at,
          )?.title ?? "Remote Questionnaire",
        submittedAt: clinicalSummaryRow.created_at,
      };
    }
    const general = extractGeneralDraft(clinicalSummaryRow.structured_data, clinicalSummaryRow.type);
    if (general) {
      return {
        title: "General MSK Assessment",
        submittedAt: clinicalSummaryRow.created_at,
      };
    }
    const structured = extractStructuredData(clinicalSummaryRow.structured_data);
    if (structured) {
      return {
        title: structured.bodyRegion || "Structured Assessment",
        submittedAt: clinicalSummaryRow.created_at,
      };
    }
    return {
      title: clinicalSummaryRow.type.replaceAll("_", " "),
      submittedAt: clinicalSummaryRow.created_at,
    };
  }, [clinicalSummaryRow]);

  const cvExerciseNameById = useMemo<Record<string, string>>(
    () => ({
      ...Object.fromEntries(
        getCvReadyExercises().map((exercise) => [exercise.exerciseId, exercise.nameEn]),
      ),
      ...GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES,
      "timed-up-and-go": "Timed Up and Go",
    }),
    [],
  );

  const rehabilitationTimelineEvents = useMemo(() => {
    return buildPatientTimeline({
      assessments: supabaseAssessmentRows.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        type: row.type,
        status: row.status,
      })),
      plans: patientPlanRows.map((plan) => ({
        id: plan.id,
        created_at: plan.created_at,
        title: plan.title,
        planTitle: plan.title,
        programName: plan.structured_data?.programName ?? plan.title,
        structured_data: plan.structured_data,
      })),
      sessionLogs: (timelineBundle?.timelineSessionLogs ?? []).map((log) => ({
        id: log.id,
        completed_at: log.completed_at,
        pain_score: log.pain_score,
        effort_score: log.effort_score,
        session_number: log.session_number,
        notes: log.notes,
      })),
      reviewAcknowledgments: (timelineBundle?.timelineReviewAcks ?? []).map((ack) => ({
        id: ack.id,
        reviewed_at: ack.reviewed_at,
        review_note: ack.review_note,
      })),
      remoteAssessmentRequests: remoteAssessments.map((req) => ({
        id: req.id,
        createdAt: req.createdAt,
        status: req.status,
        submittedAt: req.submittedAt,
      })),
      cvCaptures: patientCvMetrics
        .filter((row) => row.source === "assessment_movement" || row.source === "patient_session")
        .map((row) => ({
          id: row.id,
          recordedAt: row.recordedAt,
          exerciseId: row.exerciseId,
          exerciseLabel: cvExerciseNameById[row.exerciseId] ?? row.exerciseId,
          sessionDurationS: row.sessionDurationS,
          source: row.source,
        })),
    });
  }, [supabaseAssessmentRows, patientPlanRows, timelineBundle, remoteAssessments, patientCvMetrics, cvExerciseNameById]);

  const objectiveWorkspaces = useMemo(() => {
    const hasResult = (exerciseId: string) =>
      patientCvMetrics.some(
        (row) =>
          row.exerciseId === exerciseId &&
          (row.source === "assessment_movement" || row.source === "patient_session"),
      );
    const scoped = (path: string) =>
      `${path}?patientId=${encodeURIComponent(patient?.id ?? id)}`;
    return [
      {
        id: "tug" as const,
        title: "Timed Up and Go",
        hasResult: hasResult(OBJECTIVE_CV_EXERCISE_IDS.tug),
        href: scoped("/clinician/assessments/timed-up-and-go"),
      },
      {
        id: "sls" as const,
        title: "Single-Leg Stance",
        hasResult: hasResult(OBJECTIVE_CV_EXERCISE_IDS.sls),
        href: scoped("/clinician/assessments/single-leg-stance"),
      },
      {
        id: "sts" as const,
        title: "Sit-to-Stand",
        hasResult: hasResult(OBJECTIVE_CV_EXERCISE_IDS.sts),
        href: scoped("/clinician/assessments/sit-to-stand"),
      },
    ];
  }, [patientCvMetrics, patient?.id, id]);

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
  const latestPendingRemote = [...pendingRemote].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0] ?? null;
  const clinicalSummaryAssessmentId = clinicalSummaryRow?.id ?? null;
  const primaryReportHref = clinicalSummaryAssessmentId
    ? `/clinician/assessment/report?patientId=${patient.id}&assessmentId=${clinicalSummaryAssessmentId}`
    : `/clinician/assessment/report?patientId=${patient.id}`;
  const overviewLatestAssessment = clinicalSummary
    ? `${clinicalSummary.title} · ${new Date(clinicalSummary.submittedAt).toLocaleDateString()}`
    : "—";
  const overviewCurrentPlan = treatmentPlan?.programName ?? "—";
  const overviewProgressSnapshot = planProgress
    ? `${planProgress.sessionsCompleted}/${planProgress.totalSessions} sessions · ${planProgress.progressPct}%`
    : adherence
      ? `${adherence.sessionsCompleted}/${adherence.totalSessions} sessions · ${adherence.adherenceRatePct}%`
      : "—";
  const adherenceSessionsCompleted =
    planProgress?.sessionsCompleted ?? adherence?.sessionsCompleted ?? 0;
  const adherenceTotalSessions =
    planProgress?.totalSessions ?? adherence?.totalSessions ?? 0;
  const adherenceLastSessionAt =
    planProgress?.lastCompletedAt ?? adherence?.lastActiveAt ?? null;
  const adherenceSessionsLine = formatSessionsCompletedLine(
    adherenceSessionsCompleted,
    adherenceTotalSessions,
  );
  const adherenceLastSessionLine = treatmentPlan
    ? formatLastSessionCompletedLine(adherenceLastSessionAt)
    : null;
  const showAdherenceQuickSummary =
    Boolean(treatmentPlan) && adherenceTotalSessions > 0;
  const forwardReachAssignmentHref = isUuidPatientId(patient.id)
    ? forwardReachAssignmentPatientRoute(patient.id)
    : null;

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
        onCreated={() => {
          void listPatientAssessments(patient.id).then(setRemoteAssessments);
          void refreshClinicalAssessments();
        }}
      />
    )}

    <main className="min-h-screen bg-[#0B1220] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <DemoOfflineBanner
          visible={demoMode || cvDemoMode}
          notice={demoNotice ?? cvDemoNotice}
        />
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/clinician/patients" className="flex items-center gap-1.5 text-sm text-white/35 transition hover:text-white/65 mb-3">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Patients
            </Link>
            <h1 className="mt-1.5 text-2xl font-bold text-white">{patient.full_name}</h1>
            <p className="mt-1 text-xs font-semibold text-white/45">
              {displayPatientFileHeader(patient.file_number, patient.id)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {patient.phone && (
                <>
                  <span className="text-xs text-white/35">{patient.phone}</span>
                  <span className="text-xs text-white/20">·</span>
                </>
              )}
              <span className="text-xs text-white/35">{patient.diagnosis || "No primary complaint recorded"}</span>
              <span className="text-xs text-white/20">·</span>
              <span className={`text-xs font-semibold ${patient.status?.toLowerCase() === "active" ? "text-[#5DCAA5]" : "text-amber-300"}`}>
                {patient.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <a href="#clinical-assessment-summary" className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-1 font-semibold text-white/45 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5]">
                Assessment
              </a>
              <a href="#rehabilitation-plan" className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-1 font-semibold text-white/45 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5]">
                Treatment plan
              </a>
              <a href="#progress-objective-results" className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-1 font-semibold text-white/45 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5]">
                Objective results
              </a>
              <a href="#progress-snapshot" className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-1 font-semibold text-white/45 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5]">
                Progress
              </a>
              <Link href={`/clinician/patients/${patient.id}/outcomes`} className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-1 font-semibold text-white/45 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5]">
                Outcomes
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clinician/assessment/new?patientId=${patient.id}`}
              className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
            >
              + New Assessment
            </Link>
            {forwardReachAssignmentHref ? (
              <Link
                href={forwardReachAssignmentHref}
                className="rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-4 py-2.5 text-sm font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
              >
                Forward Reach assignment
              </Link>
            ) : null}
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

        <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <h2 className="text-lg font-bold text-white">Clinical Overview</h2>
          <p className="mt-1 mb-5 text-xs text-white/35">Quick read on where this patient is in rehab.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Clinical Status" value={patient.status} />
            <InfoCard label="Latest Assessment" value={overviewLatestAssessment} />
            <InfoCard label="Current Plan" value={overviewCurrentPlan} />
            <InfoCard label="Progress Snapshot" value={overviewProgressSnapshot} />
          </div>
          {showAdherenceQuickSummary && adherenceSessionsLine && adherenceLastSessionLine && (
            <div className="mt-4 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                Session activity
              </p>
              <p className="mt-2 text-sm text-white/75">{adherenceSessionsLine}</p>
              <p className="mt-1 text-sm text-white/60">{adherenceLastSessionLine}</p>
              <p className="mt-2 text-[10px] italic text-white/30">{OPERATIONAL_STATUS_ONLY}</p>
            </div>
          )}
        </section>

        <div className="mt-6">
          <PatientObjectiveResultsSection patientId={patient.id} />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div className="min-w-0 space-y-6">
            {/* Quick actions */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
                Quick actions
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/clinician/plans/new?patientId=${patient.id}`}
                  className="rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3.5 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/14"
                >
                  Create structured treatment plan
                </Link>
                <Link
                  href="/clinician/results"
                  className="rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3.5 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/14"
                >
                  View Results
                </Link>
                <button
                  type="button"
                  onClick={() => setSendModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:border-[#1D9E75]/20 hover:text-white"
                >
                  Send Remote Assessment
                </button>
                {forwardReachAssignmentHref ? (
                  <Link
                    href={forwardReachAssignmentHref}
                    className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:border-[#1D9E75]/20 hover:text-white"
                  >
                    Forward Reach assignment
                  </Link>
                ) : null}
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
                  Therapy session
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#1D9E75]/30 bg-[#1D9E75]/8 px-4 py-3">
                <p className="text-sm text-[#5DCAA5]">Assessment saved successfully.</p>
                <div className="flex items-center gap-2">
                  {clinicalSummaryAssessmentId && (
                    <Link
                      href={primaryReportHref}
                      className="rounded-[6px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15"
                    >
                      Review assessment report →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAssessmentBanner(false)}
                    className="shrink-0 text-xs text-white/25 transition hover:text-white/60"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Plan assigned banner */}
            {showPlanAssignedBanner && (
              <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[#1D9E75]/30 bg-[#1D9E75]/8 px-4 py-3">
                <p className="text-sm text-[#5DCAA5]">Treatment plan assigned successfully.</p>
                <button
                  type="button"
                  onClick={() => setShowPlanAssignedBanner(false)}
                  className="mt-0.5 shrink-0 text-xs text-white/25 transition hover:text-white/60"
                >
                  ✕
                </button>
              </div>
            )}

            <PatientAssessmentsSummary
              patientId={patient.id}
              assessments={supabaseAssessmentRows}
              latestDetail={clinicalSummaryDetail}
              objectiveWorkspaces={objectiveWorkspaces}
            />

            {/* Rehabilitation Plan */}
            <TreatmentPlanSection
              patientId={patient.id}
              plan={treatmentPlan}
              loading={planLoading}
            />

            <PreviousPlansSummary plans={previousPlanRows} />

            {/* Progress Snapshot */}
            <ProgressSnapshotSection
              patientId={patient.id}
              plan={treatmentPlan}
              planProgress={planProgress}
              adherence={adherence}
              onReviewAcknowledged={(reviewedAt) => {
                setPlanProgress((prev) =>
                  prev
                    ? { ...prev, reviewAcknowledged: true, reviewedAt }
                    : prev,
                );
              }}
            />

            <PatientJourneyTimeline
              events={rehabilitationTimelineEvents}
              patientName={patient.full_name}
              initialVisible={5}
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

          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-6 xl:sticky xl:top-6">
            {/* ── Remote Assessments panel ── */}
            <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">Remote assessments</h2>
                  <p className="mt-0.5 text-xs text-white/35">Links sent to this patient.</p>
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
              ) : latestPendingRemote ? (
                <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
                  <p className="text-xs font-semibold text-white/80">
                    {ASSESSMENT_TYPE_LABELS[latestPendingRemote.assessmentType]}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">
                    Awaiting completion · expires in {daysUntilExpiry(latestPendingRemote)} days
                  </p>
                  {pendingRemote.length > 1 ? (
                    <p className="mt-1 text-[11px] text-white/35">
                      {pendingRemote.length} pending links. Submitted reviews are in Assessments.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-white/35">
                      Submitted reviews are in Assessments.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const link = `${window.location.origin}/assessment/${latestPendingRemote.id}`;
                      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
                    }}
                    className="mt-3 text-[11px] font-semibold text-[#5DCAA5] hover:text-white"
                  >
                    Copy latest link
                  </button>
                </div>
              ) : (
                <p className="text-xs text-white/45">
                  {submittedRemote.length} submitted. Open reviews from Assessments.
                </p>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
    </>
  );
}

// ── ProgressSnapshotSection ───────────────────────────────────────────────────

interface ProgressSnapshotSectionProps {
  patientId: string;
  plan: TreatmentPlan | null;
  planProgress: PatientProgressSummary | null;
  adherence: Adherence | null;
  onReviewAcknowledged?: (reviewedAt: string) => void;
}

function ProgressSnapshotSection({
  patientId,
  plan,
  planProgress,
  adherence,
  onReviewAcknowledged,
}: ProgressSnapshotSectionProps) {
  const sessionsDone = planProgress?.sessionsCompleted ?? adherence?.sessionsCompleted ?? 0;

  return (
    <section id="progress-snapshot" className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Progress Snapshot</h2>
        {planProgress?.needsReview && planProgress.clinicalAction && (
          <span className="rounded-[5px] border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            {planProgress.clinicalAction.title}
          </span>
        )}
      </div>
      <div className="mt-4">
        {!plan ? (
          <p className="mt-3 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4 text-sm leading-relaxed text-[#6B7280]">
            No progress recorded yet. Progress appears after the patient completes a session.
          </p>
        ) : sessionsDone === 0 ? (
          <p className="mt-3 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4 text-sm leading-relaxed text-[#6B7280]">
            No progress recorded yet. Progress appears after the patient completes a session.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                label: "Effort",
                value: planProgress?.latestEffortScore != null
                  ? `${planProgress.latestEffortScore}/10`
                  : "—",
              },
              {
                label: "Pain response",
                value: planProgress?.latestPainResponse ?? "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-3">
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
        )}

        {planProgress?.clinicalAction && sessionsDone > 0 && (
          <div className="mt-4">
            <ClinicalActionCard
              action={planProgress.clinicalAction}
              patientNote={planProgress.latestPatientNote}
              planSessionsHref={`#rehabilitation-plan`}
              review={
                planProgress.needsReview
                  ? {
                      patientId,
                      planId: planProgress.planId,
                      sessionLogId: planProgress.latestSessionLogId,
                      reviewAcknowledged: planProgress.reviewAcknowledged,
                      reviewedAt: planProgress.reviewedAt,
                      onAcknowledged: onReviewAcknowledged,
                    }
                  : undefined
              }
            />
          </div>
        )}

        {planProgress?.safetyConcernReported && (
          <div className="mt-3 rounded-[8px] border border-amber-400/25 bg-amber-400/10 px-4 py-3">
            <p className="text-xs leading-relaxed text-amber-200">
              Patient reported sharp pain, dizziness, or unusual symptoms before their latest session.
              Review before next session guidance.
            </p>
          </div>
        )}

        {planProgress?.latestPatientNote && !planProgress.clinicalAction && (
          <div className="mt-3 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
              Patient note from last session
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75 whitespace-pre-wrap">
              {planProgress.latestPatientNote}
            </p>
          </div>
        )}

        {adherence && plan && sessionsDone > 0 && (
          <div className="mt-4 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
              Session adherence
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
          </div>
        )}

        <Link
          href="/clinician/results"
          className="mt-4 inline-flex rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/8 px-3.5 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/14"
        >
          Review Results
        </Link>
      </div>
    </section>
  );
}

// ── TreatmentPlanSection ──────────────────────────────────────────────────────

interface TreatmentPlanSectionProps {
  patientId: string;
  plan: TreatmentPlan | null;
  loading: boolean;
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
  loading,
}: TreatmentPlanSectionProps) {
  const [showSchedule, setShowSchedule] = useState(false);
  const structuredPlanHref = `/clinician/plans/new?patientId=${encodeURIComponent(patientId)}`;
  const { metrics: cvMetrics } = useCvSessionMetrics({ patientId, limit: 50 });

  const cvMetricsByPlanSessionId = useMemo(
    () => indexCvMetricsByPlanSessionId(cvMetrics),
    [cvMetrics],
  );

  if (loading) {
    return (
      <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
        <p className="text-sm text-white/40">Loading rehabilitation plan…</p>
      </section>
    );
  }

  return (
    <section id="rehabilitation-plan" className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 scroll-mt-6">
      <h2 className="text-lg font-bold text-white">Rehabilitation Plan</h2>
      <div className="mt-4 mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">
            {plan ? plan.programName : "No plan assigned"}
          </h3>
          {plan && (
            <>
              <p className="mt-0.5 text-sm text-white/40">{plan.phaseName}</p>
              <p className="mt-1 text-xs text-white/35 capitalize">Status: {plan.status}</p>
            </>
          )}
        </div>
        <Link
          href={structuredPlanHref}
          className="shrink-0 rounded-[7px] bg-[#1D9E75] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#179165]"
        >
          {plan ? "Assign updated plan" : "Build treatment plan"}
        </Link>
      </div>

      {!plan && (
        <p className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4 text-sm leading-relaxed text-[#6B7280]">
          No rehabilitation plan assigned yet. Use the structured plan builder to select exercises from
          the library, set dose, and share the patient portal link.
        </p>
      )}

      {/* Current plan summary */}
      {plan && (
        <div className="space-y-3">
          <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">Goal</p>
            <p className="text-sm text-white/70">{plan.phaseGoal}</p>
          </div>

          {plan.clinicianNotes && (
            <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">
                Clinician Notes
              </p>
              <p className="text-sm text-white/60">{plan.clinicianNotes}</p>
            </div>
          )}

          <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                Session schedule ({plan.sessions.filter((s) => s.status !== "completed").length} remaining)
              </p>
              <button
                type="button"
                onClick={() => setShowSchedule((value) => !value)}
                className="text-[11px] font-semibold text-[#5DCAA5] hover:text-white"
              >
                {showSchedule ? "Hide schedule" : "View session schedule"}
              </button>
            </div>
            {showSchedule ? (
              <>
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
                  cvMetricsByPlanSessionId={cvMetricsByPlanSessionId}
                />
                <p className="mt-3 text-[10px] leading-relaxed text-white/30">
                  Camera status uses saved assistive metrics per session. Therapist review only · not
                  clinically validated · reps are assistive only.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-white/45">
                {plan.sessionsPerWeek} sessions/week · {plan.sessions.length} total sessions
              </p>
            )}
          </div>
        </div>
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
