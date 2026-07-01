import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import type { DashboardStats } from "@/app/lib/api";
import {
  buildClinicalActionFromPlanData,
  clinicalActionNeedsTherapistReview,
} from "@/app/lib/clinical-action-engine";
import { parseSessionCoachNotes } from "@/app/lib/session-coach-metadata";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { GAIT_WALKING_OBSERVATION_EXERCISE_ID } from "@/app/lib/cv/gait-assessment-exercise-ids";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

export const DEMO_NOTICE =
  "Backend unavailable — showing sample demo data for local preview. Connect Supabase or start FastAPI for live data.";

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
