/**
 * RASQ Upper-Limb Motor Screen — assignment persistence (019/020).
 *
 * Maps between the domain UpperLimbMotorScreenAssignment object and
 * the upper_limb_motor_screen_assignments row shape. Legacy-only
 * columns (screen_definition_id, assigned_at, affected_side,
 * delivery_mode, token_hash, token_expires_at) exist only for
 * Staging's pre-019 rows (020's compatibility upgrade) and are never
 * written by this module — every row created here leaves them NULL.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpperLimbMotorScreenAssignmentsRow } from "@/app/lib/supabase/database.types";
import type { UpperLimbMotorScreenAssignment } from "./types";
import { UPPER_LIMB_MOTOR_SCREEN_SCHEMA_VERSION } from "./schema-version";

export type UpperLimbMotorScreenAssignmentInsert = {
  id: string;
  provider_id: string;
  patient_id: string;
  status: UpperLimbMotorScreenAssignment["status"];
  assignment_payload: UpperLimbMotorScreenAssignment;
  schema_version: string;
};

export function buildUpperLimbMotorScreenAssignmentInsert(input: {
  providerId: string;
  patientId: string;
  assignment: UpperLimbMotorScreenAssignment;
}): UpperLimbMotorScreenAssignmentInsert {
  return {
    id: input.assignment.id,
    provider_id: input.providerId,
    patient_id: input.patientId,
    status: input.assignment.status,
    assignment_payload: input.assignment,
    schema_version: UPPER_LIMB_MOTOR_SCREEN_SCHEMA_VERSION,
  };
}

export type UpperLimbMotorScreenAssignmentPublic = {
  assignment: UpperLimbMotorScreenAssignment;
  patientId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
};

export function toUpperLimbMotorScreenAssignmentPublic(
  row: UpperLimbMotorScreenAssignmentsRow,
): UpperLimbMotorScreenAssignmentPublic {
  return {
    assignment: row.assignment_payload as unknown as UpperLimbMotorScreenAssignment,
    patientId: row.patient_id,
    providerId: row.provider_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertUpperLimbMotorScreenAssignment(
  adminClient: SupabaseClient,
  row: UpperLimbMotorScreenAssignmentInsert,
): Promise<
  | { ok: true; row: UpperLimbMotorScreenAssignmentsRow }
  | { ok: false; httpStatus: 500; message: string }
> {
  const { data, error } = await adminClient
    .from("upper_limb_motor_screen_assignments")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("[insertUpperLimbMotorScreenAssignment] insert failed:", error.message);
    return { ok: false, httpStatus: 500, message: "Unable to complete request." };
  }

  return { ok: true, row: data as UpperLimbMotorScreenAssignmentsRow };
}

export type FindLatestAssignmentResult =
  | { ok: true; row: UpperLimbMotorScreenAssignmentsRow | null }
  | { ok: false; httpStatus: 500; message: string };

/**
 * Finds the most recently created assignment for a given patient +
 * screenDefinitionId, scoped to the authenticated provider — the read
 * side of the resume/duplicate-prevention contract (GET
 * /api/upper-limb-motor-screen/assignments). screen_definition_id is a
 * legacy-only, nullable typed column this module never writes (see
 * header), so matching is done against the canonical JSONB payload via
 * assignment_payload->>screenDefinitionId, never the typed column.
 * Ownership must already be verified by the caller (validatePatientOwnership)
 * before this is called; providerId is filtered here too as defense in
 * depth so a cross-provider row can never be returned even if that check
 * were ever skipped upstream.
 */
export async function findLatestUpperLimbMotorScreenAssignment(
  adminClient: SupabaseClient,
  input: { patientId: string; providerId: string; screenDefinitionId: string },
): Promise<FindLatestAssignmentResult> {
  const { data, error } = await adminClient
    .from("upper_limb_motor_screen_assignments")
    .select("*")
    .eq("patient_id", input.patientId)
    .eq("provider_id", input.providerId)
    .eq("assignment_payload->>screenDefinitionId", input.screenDefinitionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[findLatestUpperLimbMotorScreenAssignment] query failed:", error.message);
    return { ok: false, httpStatus: 500, message: "Unable to complete request." };
  }

  return { ok: true, row: (data as UpperLimbMotorScreenAssignmentsRow | null) ?? null };
}
