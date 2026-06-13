import type { SupabaseClient } from "@supabase/supabase-js";

export type PatientLifetimeSummary = {
  totalCompletedSessions: number;
  totalProgramsAssigned: number;
  totalCvSessions: number;
  lastActivityAt: string | null;
};

export const EMPTY_PATIENT_LIFETIME_SUMMARY: PatientLifetimeSummary = {
  totalCompletedSessions: 0,
  totalProgramsAssigned: 0,
  totalCvSessions: 0,
  lastActivityAt: null,
};

export type PatientLifetimeScope = {
  patientId: string;
  providerId: string;
};

/** Whether the lifetime summary card should render in the patient portal. */
export function shouldShowPatientLifetimeSummary(
  summary: PatientLifetimeSummary,
): boolean {
  return (
    summary.totalCompletedSessions > 0 ||
    summary.totalProgramsAssigned > 0 ||
    summary.totalCvSessions > 0 ||
    summary.lastActivityAt != null
  );
}

async function countScopedRows(
  admin: SupabaseClient,
  table: string,
  scope: PatientLifetimeScope,
  extraEq?: Record<string, string>,
): Promise<number | null> {
  let query = admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("patient_id", scope.patientId)
    .eq("provider_id", scope.providerId);

  if (extraEq) {
    for (const [column, value] of Object.entries(extraEq)) {
      query = query.eq(column, value);
    }
  }

  const { count, error } = await query;
  if (error) {
    console.error(`[fetchPatientLifetimeSummary] ${table} count failed`);
    return null;
  }
  return count ?? 0;
}

async function fetchLatestSessionActivity(
  admin: SupabaseClient,
  scope: PatientLifetimeScope,
): Promise<string | null | undefined> {
  const { data, error } = await admin
    .from("session_logs")
    .select("completed_at")
    .eq("patient_id", scope.patientId)
    .eq("provider_id", scope.providerId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ completed_at: string }>();

  if (error) {
    console.error("[fetchPatientLifetimeSummary] session_logs latest failed");
    return undefined;
  }

  return data?.completed_at ?? null;
}

/**
 * Aggregate lifetime rehab counts for a patient (counts only — no row payloads).
 * On query failure, returns safe zeros/null so the current plan response still loads.
 */
export async function fetchPatientLifetimeSummary(
  admin: SupabaseClient,
  scope: PatientLifetimeScope,
): Promise<PatientLifetimeSummary> {
  const [sessionsCount, plansCount, cvCount, latestActivity] = await Promise.all([
    countScopedRows(admin, "session_logs", scope),
    countScopedRows(admin, "treatment_plans", scope),
    countScopedRows(admin, "cv_session_metrics", scope, { source: "patient_session" }),
    fetchLatestSessionActivity(admin, scope),
  ]);

  return {
    totalCompletedSessions: sessionsCount ?? 0,
    totalProgramsAssigned: plansCount ?? 0,
    totalCvSessions: cvCount ?? 0,
    lastActivityAt: latestActivity === undefined ? null : latestActivity,
  };
}
