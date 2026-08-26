/**
 * RASQ Upper-Limb Motor Screen — client-side fetch wrappers.
 *
 * Every function that accepts a patientId is guarded by isUuidPatientId
 * (the existing, established demo/numeric-patient boundary — see
 * app/lib/api/patient-id-utils.ts, already used the same way by
 * plans-client.ts/treatment-plans.ts/remote-assessments.ts) BEFORE any
 * fetch is issued: a numeric/demo patient id causes an immediate,
 * synchronous "skipped" result with zero network calls, never a
 * persistence attempt. fetchImpl is injectable for testing (defaults to
 * the global fetch).
 */

import { isUuidPatientId } from "./patient-id-utils";
import type { ForwardReachAssignmentRequestBody } from "@/app/lib/upper-limb-motor-screen/forward-reach-assignment-request";
import type { UpperLimbMotorScreenAssignmentPublic } from "@/app/lib/upper-limb-motor-screen/assignment-persistence";
import type { UpperLimbMotorScreenSessionResultPublic } from "@/app/lib/upper-limb-motor-screen/session-result-persistence";
import type { UpperLimbSessionResultCreateRequest } from "@/app/lib/upper-limb-motor-screen/session-result-request-validation";

export type UpperLimbClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }
  | { ok: false; skipped: true; reason: "non_uuid_patient" };

type FetchImpl = typeof fetch;

async function parseJsonResponse<T>(res: Response): Promise<UpperLimbClientResult<T>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: res.status, error: "Invalid response." };
  }
  if (!res.ok) {
    const error =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Request failed.";
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: body as T };
}

// ── Assignments ──────────────────────────────────────────────────────────

export async function fetchLatestUpperLimbMotorScreenAssignment(
  patientId: string,
  screenDefinitionId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<UpperLimbClientResult<{ assignment: UpperLimbMotorScreenAssignmentPublic | null }>> {
  if (!isUuidPatientId(patientId)) {
    return { ok: false, skipped: true, reason: "non_uuid_patient" };
  }
  const params = new URLSearchParams({ patientId, screenDefinitionId });
  const res = await fetchImpl(`/api/upper-limb-motor-screen/assignments?${params.toString()}`);
  return parseJsonResponse(res);
}

export async function createUpperLimbMotorScreenAssignment(
  body: ForwardReachAssignmentRequestBody,
  fetchImpl: FetchImpl = fetch,
): Promise<UpperLimbClientResult<UpperLimbMotorScreenAssignmentPublic>> {
  if (!isUuidPatientId(body.patientId)) {
    return { ok: false, skipped: true, reason: "non_uuid_patient" };
  }
  const res = await fetchImpl("/api/upper-limb-motor-screen/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse(res);
}

// ── Session results ──────────────────────────────────────────────────────

export async function fetchLatestUpperLimbMotorScreenSessionResult(
  assignmentId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<UpperLimbClientResult<{ sessionResult: UpperLimbMotorScreenSessionResultPublic | null }>> {
  const params = new URLSearchParams({ assignmentId });
  const res = await fetchImpl(`/api/upper-limb-motor-screen/session-results?${params.toString()}`);
  return parseJsonResponse(res);
}

export async function createUpperLimbMotorScreenSessionResult(
  body: UpperLimbSessionResultCreateRequest,
  fetchImpl: FetchImpl = fetch,
): Promise<UpperLimbClientResult<UpperLimbMotorScreenSessionResultPublic>> {
  const res = await fetchImpl("/api/upper-limb-motor-screen/session-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse(res);
}

export async function finalizeUpperLimbMotorScreenSessionResult(
  sessionResultId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<UpperLimbClientResult<UpperLimbMotorScreenSessionResultPublic>> {
  const res = await fetchImpl(
    `/api/upper-limb-motor-screen/session-results/${encodeURIComponent(sessionResultId)}/finalize`,
    { method: "POST" },
  );
  return parseJsonResponse(res);
}
