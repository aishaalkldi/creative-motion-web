/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/forward-reach-session-load.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadForwardReachSessionState } from "./forward-reach-session-load";

const PATIENT_ID = "22222222-2222-4222-a222-222222222222";
const SCREEN_DEFINITION_ID = "upper-limb-forward-reach-v1";
const ASSIGNMENT_PUBLIC = {
  assignment: { id: "assignment-1" },
  patientId: PATIENT_ID,
  providerId: "provider-1",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
} as unknown as import("./assignment-persistence").UpperLimbMotorScreenAssignmentPublic;
const SESSION_RESULT_PUBLIC = {
  sessionResult: { id: "result-1", status: "computed" },
  assignmentId: "assignment-1",
  patientId: PATIENT_ID,
  providerId: "provider-1",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
} as unknown as import("./session-result-persistence").UpperLimbMotorScreenSessionResultPublic;

function neverCalled(name: string) {
  return async () => {
    throw new Error(`${name} should not have been called`);
  };
}

describe("loadForwardReachSessionState", () => {
  it("non-UUID patient resolves without calling either fetch", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: false,
      patientId: "42",
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: neverCalled("fetchAssignment"),
      fetchSessionResult: neverCalled("fetchSessionResult"),
    });
    assert.deepEqual(result, { cancelled: false, ok: true, assignment: null, sessionResult: null });
  });

  it("no matching assignment -> ok:true with both null, session-result never fetched", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async () => ({ ok: true, data: { assignment: null } }),
      fetchSessionResult: neverCalled("fetchSessionResult"),
    });
    assert.deepEqual(result, { cancelled: false, ok: true, assignment: null, sessionResult: null });
  });

  it("assignment found, no session result yet -> ok:true with sessionResult null", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async () => ({ ok: true, data: { assignment: ASSIGNMENT_PUBLIC } }),
      fetchSessionResult: async () => ({ ok: true, data: { sessionResult: null } }),
    });
    assert.deepEqual(result, {
      cancelled: false,
      ok: true,
      assignment: ASSIGNMENT_PUBLIC,
      sessionResult: null,
    });
  });

  it("assignment and session result both found -> both returned", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async () => ({ ok: true, data: { assignment: ASSIGNMENT_PUBLIC } }),
      fetchSessionResult: async () => ({ ok: true, data: { sessionResult: SESSION_RESULT_PUBLIC } }),
    });
    assert.deepEqual(result, {
      cancelled: false,
      ok: true,
      assignment: ASSIGNMENT_PUBLIC,
      sessionResult: SESSION_RESULT_PUBLIC,
    });
  });

  it("assignment fetch failure -> ok:false with the error message, session-result never fetched", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async () => ({ ok: false, status: 500, error: "Unable to complete request." }),
      fetchSessionResult: neverCalled("fetchSessionResult"),
    });
    assert.deepEqual(result, { cancelled: false, ok: false, error: "Unable to complete request." });
  });

  it("a skipped assignment fetch (should not happen given isUuidPatient is already checked) surfaces no error message", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async () => ({ ok: false, skipped: true, reason: "non_uuid_patient" }),
      fetchSessionResult: neverCalled("fetchSessionResult"),
    });
    assert.deepEqual(result, { cancelled: false, ok: false, error: null });
  });

  it("session-result fetch failure is tolerated as null, not surfaced as a load error", async () => {
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async () => ({ ok: true, data: { assignment: ASSIGNMENT_PUBLIC } }),
      fetchSessionResult: async () => ({ ok: false, status: 500, error: "boom" }),
    });
    assert.deepEqual(result, {
      cancelled: false,
      ok: true,
      assignment: ASSIGNMENT_PUBLIC,
      sessionResult: null,
    });
  });

  it("cancelled after the assignment fetch -> {cancelled:true}, session-result never fetched", async () => {
    let cancelled = false;
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => cancelled,
      fetchAssignment: async () => {
        cancelled = true; // simulates the effect's cleanup firing while this fetch was in flight
        return { ok: true, data: { assignment: ASSIGNMENT_PUBLIC } };
      },
      fetchSessionResult: neverCalled("fetchSessionResult"),
    });
    assert.deepEqual(result, { cancelled: true });
  });

  it("cancelled after the session-result fetch -> {cancelled:true}", async () => {
    let cancelled = false;
    const result = await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => cancelled,
      fetchAssignment: async () => ({ ok: true, data: { assignment: ASSIGNMENT_PUBLIC } }),
      fetchSessionResult: async () => {
        cancelled = true;
        return { ok: true, data: { sessionResult: SESSION_RESULT_PUBLIC } };
      },
    });
    assert.deepEqual(result, { cancelled: true });
  });

  it("passes screenDefinitionId through to fetchAssignment unchanged", async () => {
    let receivedScreenDefinitionId: string | null = null;
    await loadForwardReachSessionState({
      isUuidPatient: true,
      patientId: PATIENT_ID,
      screenDefinitionId: SCREEN_DEFINITION_ID,
      isCancelled: () => false,
      fetchAssignment: async (_patientId, screenDefinitionId) => {
        receivedScreenDefinitionId = screenDefinitionId;
        return { ok: true, data: { assignment: null } };
      },
      fetchSessionResult: neverCalled("fetchSessionResult"),
    });
    assert.equal(receivedScreenDefinitionId, SCREEN_DEFINITION_ID);
  });
});
