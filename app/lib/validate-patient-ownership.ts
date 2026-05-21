import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Shape of a row from public.patients (post-migration 003).
 * provider_id is the direct ownership column added in migration 003.
 */
export type PatientRow = {
  id: string;
  provider_id: string;
  full_name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  diagnosis: string | null;
  sport: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type OwnershipOk = { ok: true; patient: PatientRow };
export type OwnershipFail = {
  ok: false;
  httpStatus: 401 | 404 | 500;
  message: string;
};
export type OwnershipResult = OwnershipOk | OwnershipFail;

// ── Validator ──────────────────────────────────────────────────────────────────

/**
 * Validates that a patient record exists and belongs to the requesting provider.
 *
 * Ownership is determined exclusively by patients.provider_id — the direct
 * foreign key added in migration 003. No treatment_plans inference.
 *
 * Error model:
 *   - patient not found or belongs to another provider → 404
 *     (404 is intentional: leaking existence to unauthorised callers is unsafe)
 *   - patients.provider_id column missing (migration 003 not applied) → 500
 *     with a clear message so the operator knows what to do
 *   - unexpected DB error → 500
 *
 * @param supabase   Service-role or session client with read access to patients.
 * @param patientId  UUID of the patient to look up.
 * @param providerId UUID of the authenticated provider (auth.uid()).
 */
export async function validatePatientOwnership(
  supabase: SupabaseClient,
  patientId: string,
  providerId: string,
): Promise<OwnershipResult> {
  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("provider_id", providerId)
    .single();

  if (error) {
    // 42703 = column does not exist (migration 003 not yet applied)
    if (error.code === "42703") {
      return {
        ok: false,
        httpStatus: 500,
        message:
          "patients.provider_id column missing. Apply migration 003_patients_provider_id.sql.",
      };
    }

    // PGRST116 = no rows returned — patient not found or wrong provider
    if (error.code === "PGRST116") {
      return { ok: false, httpStatus: 404, message: "Patient not found." };
    }

    console.error("[validatePatientOwnership] unexpected error:", error.message);
    return { ok: false, httpStatus: 500, message: "Failed to load patient." };
  }

  if (!patient) {
    return { ok: false, httpStatus: 404, message: "Patient not found." };
  }

  return { ok: true, patient: patient as PatientRow };
}
