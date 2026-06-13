import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCurrentAndPreviousPlans } from "./clinician/resolve-current-plan";

export type PatientAccessTokenRow = {
  id: string;
  token: string;
  patient_name: string;
  patient_id: string;
  plan_id: string;
  provider_id: string;
  is_active: boolean;
  expires_at: string | null;
};

export type PatientPortalPlanListItem = {
  id: string;
  patient_id: string;
  provider_id: string;
  status: string;
  created_at: string;
};

export type PatientPortalCurrentPlan = {
  id: string;
  patient_id: string;
  provider_id: string;
  title: string;
  structured_data: {
    programName?: string;
    phaseName?: string;
    phaseGoal?: string;
    sessionsPerWeek?: number;
    assignedBy?: string;
  } | null;
  status: string;
  total_weeks: number | null;
  clinician_note: string | null;
  created_at: string;
};

export type ResolvedPatientPortalAccess = {
  token: string;
  patientId: string;
  providerId: string;
  patientName: string;
  originalTokenPlanId: string;
  currentPlanId: string;
  currentPlan: PatientPortalCurrentPlan;
};

export type ResolvePatientPortalAccessResult =
  | { ok: true; access: ResolvedPatientPortalAccess }
  | { ok: false; reason: "invalid_token" | "server_error" | "plan_not_found" };

export type LookupPatientPortalTokenResult =
  | { ok: true; row: PatientAccessTokenRow }
  | { ok: false; reason: "invalid_token" | "server_error" };

/** Active, non-expired token row. */
export function isPatientPortalTokenRowValid(
  row: Pick<PatientAccessTokenRow, "is_active" | "expires_at">,
): boolean {
  if (!row.is_active) return false;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
  return true;
}

/**
 * Pick the operational current plan id for a patient portal token.
 * a) newest plan with status === "active"
 * b) otherwise newest plan overall
 * c) fallback to originalTokenPlanId when no plans exist
 */
export function resolvePatientPortalCurrentPlanId(
  plans: readonly PatientPortalPlanListItem[],
  originalTokenPlanId: string,
): string {
  if (plans.length === 0) return originalTokenPlanId;
  const { currentPlan } = resolveCurrentAndPreviousPlans(plans);
  return currentPlan?.id ?? originalTokenPlanId;
}

/** Ensures a resolved plan belongs to the same patient/provider as the token. */
export function planMatchesPortalScope(
  plan: Pick<PatientPortalPlanListItem, "patient_id" | "provider_id">,
  patientId: string,
  providerId: string,
): boolean {
  return plan.patient_id === patientId && plan.provider_id === providerId;
}

/** Session completion / CV writes must target the resolved current plan only. */
export function sessionBelongsToCurrentPlan(
  sessionPlanId: string,
  currentPlanId: string,
): boolean {
  return sessionPlanId === currentPlanId;
}

export async function lookupPatientPortalToken(
  admin: SupabaseClient,
  tokenValue: string,
): Promise<LookupPatientPortalTokenResult> {
  const { data: row, error } = await admin
    .from("patient_access_tokens")
    .select("id, token, patient_name, patient_id, plan_id, provider_id, is_active, expires_at")
    .eq("token", tokenValue)
    .maybeSingle<PatientAccessTokenRow>();

  if (error) {
    console.error("[patient-portal-access] token lookup error");
    return { ok: false, reason: "server_error" };
  }
  if (!row || !isPatientPortalTokenRowValid(row)) {
    return { ok: false, reason: "invalid_token" };
  }

  return { ok: true, row };
}

/**
 * Validate token and resolve the patient's current plan for portal operations.
 * Any valid token for the patient opens the same current plan.
 */
export async function resolvePatientPortalAccess(
  admin: SupabaseClient,
  tokenValue: string,
): Promise<ResolvePatientPortalAccessResult> {
  const lookup = await lookupPatientPortalToken(admin, tokenValue);
  if (!lookup.ok) {
    return { ok: false, reason: lookup.reason };
  }

  const { row } = lookup;

  const { data: planList, error: listErr } = await admin
    .from("treatment_plans")
    .select("id, patient_id, provider_id, status, created_at")
    .eq("patient_id", row.patient_id)
    .eq("provider_id", row.provider_id)
    .order("created_at", { ascending: false })
    .returns<PatientPortalPlanListItem[]>();

  if (listErr) {
    console.error("[patient-portal-access] treatment_plans list failed");
    return { ok: false, reason: "server_error" };
  }

  const scopedPlans = (planList ?? []).filter((plan) =>
    planMatchesPortalScope(plan, row.patient_id, row.provider_id),
  );

  const currentPlanId = resolvePatientPortalCurrentPlanId(scopedPlans, row.plan_id);

  const { data: currentPlan, error: planErr } = await admin
    .from("treatment_plans")
    .select(
      "id, patient_id, provider_id, title, structured_data, status, total_weeks, clinician_note, created_at",
    )
    .eq("id", currentPlanId)
    .maybeSingle<PatientPortalCurrentPlan>();

  if (planErr) {
    console.error("[patient-portal-access] current plan fetch failed");
    return { ok: false, reason: "server_error" };
  }
  if (!currentPlan || !planMatchesPortalScope(currentPlan, row.patient_id, row.provider_id)) {
    return { ok: false, reason: "plan_not_found" };
  }

  return {
    ok: true,
    access: {
      token: row.token,
      patientId: row.patient_id,
      providerId: row.provider_id,
      patientName: row.patient_name,
      originalTokenPlanId: row.plan_id,
      currentPlanId: currentPlan.id,
      currentPlan,
    },
  };
}
