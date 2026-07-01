/**
 * Unified treatment-plan client — Supabase-backed `/api/plans` for real patients.
 * Legacy numeric demo patients continue to use localStorage via treatment-plans.ts.
 */

import type { PlanRow, PlanSessionRow } from "@/app/api/plans/route";
import { getAuthHeaders } from "@/app/lib/auth";
import { resolveCurrentAndPreviousPlans } from "@/app/lib/clinician/resolve-current-plan";
import { isUuidPatientId } from "./patient-id-utils";
import type {
  PlanSession,
  PlanStatus,
  SessionStatus,
  TreatmentPlan,
} from "./treatment-plans";

function mapSessionStatus(dbStatus: string): SessionStatus {
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "in_progress" || dbStatus === "in-progress") return "in-progress";
  return "ready";
}

function mapPlanStatus(dbStatus: string): PlanStatus {
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "on-hold" || dbStatus === "paused") return "on-hold";
  return "active";
}

function mapPlanSession(row: PlanSessionRow): PlanSession {
  return {
    id: row.id,
    sessionNumber: row.session_number,
    title: row.title,
    exercises: row.exercises ?? [],
    estimatedMinutes: 20,
    status: mapSessionStatus(row.status),
    completedAt: row.completed_at ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
  };
}

/** Map a Supabase plan row to the legacy TreatmentPlan shape used by UI components. */
export function mapPlanRowToTreatmentPlan(row: PlanRow): TreatmentPlan {
  const sd = row.structured_data;
  const sessions = (row.sessions ?? []).map(mapPlanSession);

  return {
    id: row.id,
    patientId: 0,
    programId: sd?.programId ?? "custom",
    programName: sd?.programName ?? row.title ?? "Treatment Plan",
    phase: sd?.phase ?? "phase-1",
    phaseName: sd?.phaseName ?? "Phase 1",
    phaseGoal: sd?.phaseGoal ?? "",
    sessionsPerWeek: sd?.sessionsPerWeek ?? 3,
    totalSessions: sessions.length,
    clinicianNotes: row.clinician_note ?? "",
    assignedAt: row.created_at,
    assignedBy: sd?.assignedBy ?? "Clinician",
    status: mapPlanStatus(row.status),
    sessions,
    patientToken: row.patient_token ?? undefined,
  };
}

/** Fetch all treatment plans for a patient from `/api/plans`. */
export async function fetchPatientTreatmentPlans(patientId: string): Promise<PlanRow[]> {
  const trimmed = patientId.trim();
  if (!trimmed || !isUuidPatientId(trimmed)) return [];

  const res = await fetch(`/api/plans?patientId=${encodeURIComponent(trimmed)}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) return [];
  const plans = (await res.json()) as unknown;
  return Array.isArray(plans) ? (plans as PlanRow[]) : [];
}

/** Fetch the operational current plan for a UUID patient, mapped to TreatmentPlan. */
export async function fetchActiveTreatmentPlan(patientId: string): Promise<TreatmentPlan | null> {
  const plans = await fetchPatientTreatmentPlans(patientId);
  if (plans.length === 0) return null;
  const { currentPlan } = resolveCurrentAndPreviousPlans(plans);
  return currentPlan ? mapPlanRowToTreatmentPlan(currentPlan) : null;
}
