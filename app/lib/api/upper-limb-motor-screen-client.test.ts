/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/api/upper-limb-motor-screen-client.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createUpperLimbMotorScreenAssignment,
  fetchLatestUpperLimbMotorScreenAssignment,
} from "./upper-limb-motor-screen-client";
import type { ForwardReachAssignmentRequestBody } from "@/app/lib/upper-limb-motor-screen/forward-reach-assignment-request";

// Matches isUuidPatientId's stricter UUIDv4-shaped pattern (version
// nibble in [1-5], variant nibble in [89ab]) — a plain "1111...1111"
// fixture would NOT pass this check, unlike the looser server-side
// UUID_RE used by the API routes.
const REAL_PATIENT_ID = "22222222-2222-4222-a222-222222222222";
const NUMERIC_DEMO_PATIENT_ID = "42";

function fakeFetch(responseBody: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

function validAssignmentBody(
  patientId: string,
): ForwardReachAssignmentRequestBody {
  return {
    patientId,
    screenDefinitionId: "upper-limb-forward-reach-v1",
    affectedSide: "right",
    configuration: {
      startingSittingPosition: "chair_with_armrests",
      backTrunkSupport: "full_back_support",
      affectedArmSupport: "armrest",
      baselinePainScore: 2,
      permittedMovementRange: { kind: "not_applicable" },
      caregiverSupervisionRequirement: "not_required",
      deliveryMode: "in_clinic",
      patientSpecificStopCriteria: [],
    },
    taskAssignmentGroups: [
      {
        taskId: "forwardReach",
        testedSide: "right",
        eligible: true,
        attempts: 1,
        restPeriodSeconds: 0,
        targetPlacement: { direction: "forward", height: "shoulder height", distance: "arm's length" },
      },
    ],
  };
}

describe("fetchLatestUpperLimbMotorScreenAssignment — demo/numeric patient guard", () => {
  it("a numeric/demo patientId never issues a fetch call", async () => {
    const { impl, calls } = fakeFetch({ assignment: null });
    const result = await fetchLatestUpperLimbMotorScreenAssignment(
      NUMERIC_DEMO_PATIENT_ID,
      "upper-limb-forward-reach-v1",
      impl,
    );
    assert.deepEqual(result, { ok: false, skipped: true, reason: "non_uuid_patient" });
    assert.equal(calls.length, 0);
  });

  it("a real UUID patientId issues exactly one fetch call to the assignments endpoint", async () => {
    const { impl, calls } = fakeFetch({ assignment: null });
    const result = await fetchLatestUpperLimbMotorScreenAssignment(
      REAL_PATIENT_ID,
      "upper-limb-forward-reach-v1",
      impl,
    );
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("/api/upper-limb-motor-screen/assignments?"));
    assert.ok(calls[0].url.includes(`patientId=${encodeURIComponent(REAL_PATIENT_ID)}`));
  });
});

describe("createUpperLimbMotorScreenAssignment — demo/numeric patient guard", () => {
  it("a numeric/demo patientId in the request body never issues a fetch call", async () => {
    const { impl, calls } = fakeFetch({});
    const result = await createUpperLimbMotorScreenAssignment(
      validAssignmentBody(NUMERIC_DEMO_PATIENT_ID),
      impl,
    );
    assert.deepEqual(result, { ok: false, skipped: true, reason: "non_uuid_patient" });
    assert.equal(calls.length, 0);
  });

  it("a real UUID patientId issues exactly one POST to the assignments endpoint", async () => {
    const { impl, calls } = fakeFetch({ assignment: { id: "a1" }, patientId: REAL_PATIENT_ID });
    const result = await createUpperLimbMotorScreenAssignment(validAssignmentBody(REAL_PATIENT_ID), impl);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/upper-limb-motor-screen/assignments");
    assert.equal(calls[0].init?.method, "POST");
  });

  it("propagates a non-ok response as a typed failure, not a fabricated success", async () => {
    const { impl } = fakeFetch({ error: "Invalid assignment." }, 400);
    const result = await createUpperLimbMotorScreenAssignment(validAssignmentBody(REAL_PATIENT_ID), impl);
    if (result.ok) throw new Error("expected a failure result");
    if ("skipped" in result) throw new Error("expected a non-skipped failure");
    assert.equal(result.status, 400);
    assert.equal(result.error, "Invalid assignment.");
  });
});
