import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import type { AssessmentDetailResponse } from "@/app/api/assessments/[id]/route";
import type {
  PatientProgressSummary,
  PatientTimelineBundle,
} from "@/app/api/clinician/patient-progress/route";
import type { DashboardStats } from "@/app/lib/api";
import {
  buildClinicalActionFromPlanData,
  clinicalActionNeedsTherapistReview,
} from "@/app/lib/clinical-action-engine";
import { parseSessionCoachNotes, formatPainResponse } from "@/app/lib/session-coach-metadata";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { GAIT_WALKING_OBSERVATION_EXERCISE_ID } from "@/app/lib/cv/gait-assessment-exercise-ids";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";
import { buildGeneralMskPayload } from "@/app/lib/assessment-payload";
import type { GeneralAssessmentDraft } from "@/app/lib/general-assessment/types";

export const DEMO_NOTICE_EN =
  "Service unavailable — showing sample demo data for local preview. Connect Supabase or start FastAPI for live data.";

export const DEMO_NOTICE_AR =
  "الخدمة غير متاحة — يتم عرض بيانات تجريبية نموذجية للمعاينة المحلية. قم بتوصيل Supabase أو تشغيل FastAPI للحصول على بيانات حية.";

export const DEMO_NOTICE = DEMO_NOTICE_EN;

export const DEMO_PROVIDER_ID = "00000000-0000-4000-a000-000000000099";
export const DEMO_PATIENT_SARAH_ID = "00000000-0000-4000-a000-000000000001";
export const DEMO_PATIENT_OMAR_ID = "00000000-0000-4000-a000-000000000002";
export const DEMO_PLAN_ID = "00000000-0000-4000-a000-000000000010";
export const DEMO_ASSESSMENT_ID = "00000000-0000-4000-a000-000000000020";

const now = () => new Date().toISOString();

function demoPatient(
  id: string,
  full_name: string,
  diagnosis: string,
  status: string,
  file_number: string,
  gender: string | null = "F",
): PatientRow {
  const ts = now();
  return {
    id,
    provider_id: DEMO_PROVIDER_ID,
    full_name,
    phone: "+966500000000",
    age: 28,
    gender,
    diagnosis,
    sport: null,
    status,
    file_number,
    created_at: ts,
    updated_at: ts,
  };
}

export function getDemoPatients(): PatientRow[] {
  return [
    demoPatient(
      DEMO_PATIENT_SARAH_ID,
      "Sarah Al-Ahmad",
      "ACL reconstruction — right knee",
      "active",
      "CM-2026-001",
    ),
    demoPatient(
      DEMO_PATIENT_OMAR_ID,
      "Omar Khalid",
      "Rotator cuff repair — left shoulder",
      "new",
      "CM-2026-002",
      "M",
    ),
  ];
}

export function getDemoPatientById(patientId: string): PatientRow | null {
  return getDemoPatients().find((p) => p.id === patientId) ?? null;
}

export function getDemoDashboardStats(): DashboardStats {
  return {
    totalPatients: 2,
    activeCases: 1,
    pendingReviews: 1,
    remoteAssessmentsPending: 1,
    sessionsCompletedThisWeek: 3,
    averagePlanAdherencePct: 67,
    assessmentsSubmittedThisMonth: 2,
    cvCapturesThisMonth: 4,
    generatedAt: now(),
  };
}

export function getDemoClinicianResults(): ClinicianResultsResponse {
  const recordedAt = now();
  const clinicalAction = buildClinicalActionFromPlanData({
    latestLog: {
      effort_score: 7,
      pain_score: 4,
      notes: null,
    },
    sessions: [
      { status: "completed", session_number: 1 },
      { status: "upcoming", session_number: 2 },
      { status: "upcoming", session_number: 3 },
    ],
    parseNotes: parseSessionCoachNotes,
    allLogs: [],
  });

  return {
    cards: [
      {
        planId: DEMO_PLAN_ID,
        patientId: DEMO_PATIENT_SARAH_ID,
        patientName: "Sarah Al-Ahmad",
        planTitle: "ACL Phase 2 — Strength & balance",
        programName: "ACL Phase 2",
        sessionsCompleted: 1,
        totalSessions: 3,
        progressPct: 33,
        latestEffortScore: 7,
        latestPainScore: 4,
        latestPainBeforeScore: 3,
        latestPainResponse: "Slight increase (+1)",
        safetyConcernReported: false,
        needsReview: clinicalActionNeedsTherapistReview(clinicalAction.status),
        clinicalAction,
        latestPatientNote: null,
        lastCompletedAt: recordedAt,
        status: "active",
        latestAssessmentId: DEMO_ASSESSMENT_ID,
        latestAssessmentType: "general_msk",
        latestSessionLogId: "demo-session-log",
        planSessionId: null,
        clinicalReviewTriggerKey: null,
        reviewAcknowledged: false,
        reviewedAt: null,
      },
    ],
    patientAssessments: [
      {
        patientId: DEMO_PATIENT_SARAH_ID,
        assessmentId: DEMO_ASSESSMENT_ID,
        assessmentType: "general_msk",
        submittedAt: recordedAt,
        painAtRest: "3/10",
        painOnMovement: "5/10",
        bodyRegion: "Right knee",
      },
    ],
  };
}

export function getDemoCvSessionMetrics(patientId?: string | null): CvSessionMetricPublic[] {
  const targetPatient = patientId?.trim() || DEMO_PATIENT_SARAH_ID;
  const recordedAt = now();
  return [
    {
      id: "demo-cv-gait-1",
      exerciseId: GAIT_WALKING_OBSERVATION_EXERCISE_ID,
      repCount: null,
      sessionDurationS: 38,
      trackingQuality: "good",
      movementDetected: true,
      source: "assessment_movement",
      prototypeVersion: "0.1",
      recordedAt,
      patientId: targetPatient,
      planId: null,
      planSessionId: null,
      motionQuality: null,
    },
    {
      id: "demo-cv-sts-1",
      exerciseId: "sit_to_stand",
      repCount: 8,
      sessionDurationS: 52,
      trackingQuality: "fair",
      movementDetected: true,
      source: "patient_session",
      prototypeVersion: "0.1",
      recordedAt,
      patientId: targetPatient,
      planId: DEMO_PLAN_ID,
      planSessionId: null,
      motionQuality: null,
    },
  ];
}

export function getDemoCvSaveResponse() {
  return {
    saved: true as const,
    id: `demo-cv-${Date.now()}`,
    recordedAt: now(),
  };
}

function getDemoGeneralAssessmentDraft(): GeneralAssessmentDraft {
  const notTested = { result: "not_tested" as const, notes: "" };
  return {
    version: 1,
    subjective: {
      chiefComplaint: "Right knee pain and instability, 8 weeks post-ACL reconstruction.",
      painLocation: "Anterior and medial right knee",
      nprs: "4/10 at rest, 6/10 with stairs",
      aggravating: "Stairs, deep squat, prolonged standing",
      easing: "Rest, ice, elevation",
      functionalLimitations: "Difficulty with stairs and single-leg stance",
      goals: "Return to recreational running by week 16",
      redFlags: "None reported",
    },
    outcomes: {
      nprs: { rawNotes: "4/10 rest, 6/10 activity", clinicianDocumented: "Improving from initial 7/10" },
      psfs: { rawNotes: "", clinicianDocumented: "" },
      lefs: { rawNotes: "58/80", clinicianDocumented: "Moderate functional limitation" },
      quickdash: { rawNotes: "", clinicianDocumented: "" },
      oswestry: { rawNotes: "", clinicianDocumented: "" },
      ndi: { rawNotes: "", clinicianDocumented: "" },
    },
    functional: {
      five_x_sts: { status: "completed", result: "14.2s", notes: "Mild compensation on right side" },
      tug: { status: "completed", result: "9.8s", notes: "Within normal limits" },
      gait_speed: { status: "not_started", result: "", notes: "" },
      single_leg_balance: { status: "completed", result: "Right 18s / Left 30s", notes: "Right-side deficit noted" },
      squat: { status: "not_started", result: "", notes: "" },
      step_down: { status: "not_started", result: "", notes: "" },
    },
    objective: {
      posture: { status: "completed", cameraCv: false, result: "Neutral alignment", notes: "No significant asymmetry" },
      rom: { status: "completed", cameraCv: true, result: "Flexion 108° / Extension -2°", notes: "Target 130° flexion" },
      squat: { status: "not_started", cameraCv: false, result: "", notes: "" },
      gait: { status: "completed", cameraCv: true, result: "Slight antalgic pattern", notes: "Improving week over week" },
      balance: { status: "completed", cameraCv: true, result: "Right-side deficit ~35%", notes: "Single-leg progression indicated" },
      sit_to_stand: { status: "completed", cameraCv: true, result: "8 reps / 30s", notes: "Compensatory hip hike observed" },
    },
    ai: {
      clinicalImpression: "Findings consistent with expected Phase 2 ACL recovery presentation.",
      supportingFindings: "Reduced knee flexion ROM, mild load asymmetry on functional testing.",
      missingTests: "Isokinetic strength testing not yet performed.",
      confidenceLevel: "Moderate — based on functional and observational data only.",
      safetyNotes: "No red flags reported. Continue standard progression.",
    },
    therapist: {
      decision: "approve",
      finalDiagnosis: "Post-surgical ACL reconstruction, Phase 2 rehabilitation",
      treatmentPriorities: "Progress single-leg strength and dynamic control exercises",
    },
    soap: {
      subjective: "Patient reports improving pain and confidence with daily activities.",
      objective: "ROM improving, mild residual load asymmetry on functional testing.",
      assessment: "Progressing appropriately for 8 weeks post-op ACL reconstruction.",
      plan: "Advance to single-leg strength progression; reassess in 2 weeks.",
    },
    specialTests: {
      lachman: { ...notTested, result: "negative", notes: "Firm endpoint" },
      pivot_shift: notTested,
    },
    updatedAt: now(),
  };
}

/** Full demo report so the assessment report page always renders sample data locally. */
export function getDemoAssessmentDetail(assessmentId: string): AssessmentDetailResponse | null {
  if (assessmentId !== DEMO_ASSESSMENT_ID) return null;
  const ts = now();
  return {
    id: assessmentId,
    patient_id: DEMO_PATIENT_SARAH_ID,
    provider_id: DEMO_PROVIDER_ID,
    type: "general_msk",
    structured_data: buildGeneralMskPayload(getDemoGeneralAssessmentDraft()),
    notes: null,
    status: "submitted",
    created_at: ts,
    updated_at: ts,
    patient: {
      id: DEMO_PATIENT_SARAH_ID,
      full_name: "Sarah Al-Ahmad",
      diagnosis: "ACL reconstruction — right knee",
      age: 28,
      gender: "F",
      sport: null,
      status: "active",
    },
  };
}

/** Six completed sessions over ~3 weeks — pain trending down, effort trending up. */
function getDemoSessionLogs(): {
  id: string;
  plan_id: string;
  plan_session_id: string | null;
  session_number: number | null;
  effort_score: number | null;
  pain_score: number | null;
  notes: string | null;
  completed_at: string;
}[] {
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  const points: { day: number; effort: number; pain: number }[] = [
    { day: 18, effort: 5, pain: 6 },
    { day: 15, effort: 6, pain: 5 },
    { day: 11, effort: 6, pain: 5 },
    { day: 8, effort: 7, pain: 4 },
    { day: 4, effort: 7, pain: 3 },
    { day: 1, effort: 8, pain: 3 },
  ];
  return points.map((p, i) => ({
    id: `demo-session-log-${i + 1}`,
    plan_id: DEMO_PLAN_ID,
    plan_session_id: `demo-plan-session-${i + 1}`,
    session_number: i + 1,
    effort_score: p.effort,
    pain_score: p.pain,
    notes: null,
    completed_at: daysAgo(p.day),
  }));
}

/** Demo timeline bundle for the patient profile's session-activity / progress chart. */
export function getDemoPatientTimelineBundle(patientId: string): PatientTimelineBundle | null {
  if (patientId !== DEMO_PATIENT_SARAH_ID) return null;
  return {
    timelineSessionLogs: getDemoSessionLogs(),
    timelineReviewAcks: [],
  };
}

/** Demo progress summary for the patient profile's Progress Snapshot section. */
export function getDemoPatientProgressSummary(patientId: string): PatientProgressSummary | null {
  if (patientId !== DEMO_PATIENT_SARAH_ID) return null;
  const logs = getDemoSessionLogs();
  const latestLog = logs[logs.length - 1];
  const previousLog = logs[logs.length - 2] ?? null;
  const sessions = [
    ...logs.map((_, i) => ({ status: "completed", session_number: i + 1 })),
    { status: "upcoming", session_number: logs.length + 1 },
    { status: "upcoming", session_number: logs.length + 2 },
  ];
  const clinicalAction = buildClinicalActionFromPlanData({
    latestLog,
    sessions,
    parseNotes: parseSessionCoachNotes,
    allLogs: [...logs].reverse(),
  });

  return {
    planId: DEMO_PLAN_ID,
    sessionsCompleted: logs.length,
    totalSessions: sessions.length,
    progressPct: Math.round((logs.length / sessions.length) * 100),
    latestEffortScore: latestLog.effort_score,
    latestPainScore: latestLog.pain_score,
    latestPainBeforeScore: previousLog?.pain_score ?? null,
    latestPainResponse: formatPainResponse(previousLog?.pain_score ?? null, latestLog.pain_score),
    safetyConcernReported: false,
    needsReview: clinicalActionNeedsTherapistReview(clinicalAction.status),
    clinicalAction,
    latestPatientNote: null,
    lastCompletedAt: latestLog.completed_at,
    latestSessionLogId: latestLog.id,
    planSessionId: latestLog.plan_session_id,
    clinicalReviewTriggerKey: null,
    reviewAcknowledged: false,
    reviewedAt: null,
  };
}

