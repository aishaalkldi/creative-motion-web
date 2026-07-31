/**
 * Run: npx tsx --test app/api/patient/upper-limb-motor-screen/assignments/__tests__/token-get-route.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { hashPatientAccessToken } from "@/app/lib/upper-limb-motor-screen-api/token";
import { __setServiceRoleClientForTests, GET } from "../[token]/route";

function validAssignmentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1",
    screenDefinitionId: "upper-limb-motor-screen-v1",
    status: "assigned",
    assignedAt: "2026-07-30T10:00:00.000Z",
    assignedBy: "provider-1",
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
        restPeriodSeconds: 30,
        targetPlacement: {
          direction: "forward",
          height: "shoulder height",
          distance: "arm's length",
        },
      },
    ],
    ...overrides,
  };
}

function makeRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/patient/upper-limb-motor-screen/assignments/x",
    {
      headers: {
        "x-forwarded-for": `10.2.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
    },
  );
}

describe("GET /api/patient/upper-limb-motor-screen/assignments/[token]", () => {
  type AssignmentRow = {
    id: string;
    status: string;
    token_expires_at: string;
    assignment_payload: unknown;
    patient_id: string;
    provider_id: string;
    token_hash: string;
  };

  let assignmentRow: AssignmentRow | null;
  let queryEqCalls: Array<{ column: string; value: unknown }>;
  let mutateCalled: boolean;

  function resetState() {
    const rawToken = "patient-access-token-value";
    assignmentRow = {
      id: "assignment-1",
      status: "assigned",
      token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      assignment_payload: validAssignmentPayload(),
      patient_id: "patient-1",
      provider_id: "provider-1",
      token_hash: hashPatientAccessToken(rawToken),
    };
    queryEqCalls = [];
    mutateCalled = false;
    return rawToken;
  }

  function makeFakeClient() {
    return {
      from(table: string) {
        if (table !== "upper_limb_motor_screen_assignments") {
          throw new Error(`unexpected table: ${table}`);
        }
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              queryEqCalls.push({ column, value });
              return {
                maybeSingle: async () => ({ data: assignmentRow, error: null }),
                update: () => {
                  mutateCalled = true;
                  return { eq: () => ({ error: null }) };
                },
              };
            },
          }),
          update: () => {
            mutateCalled = true;
            return { eq: () => ({ error: null }) };
          },
        };
      },
    };
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    __setServiceRoleClientForTests(makeFakeClient() as never);
  });

  afterEach(() => {
    __setServiceRoleClientForTests(null);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("returns sanitized assignment for a valid token", async () => {
    const rawToken = resetState();
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      assignmentId: string;
      screenDefinitionId: string;
      affectedSide: string;
      deliveryMode: string;
      taskAssignmentGroups: Array<{ testedSide: string; taskId: string }>;
      expiresAt: string;
    };
    assert.equal(body.assignmentId, "assignment-1");
    assert.equal(body.screenDefinitionId, "upper-limb-motor-screen-v1");
    assert.equal(body.affectedSide, "right");
    assert.equal(body.deliveryMode, "in_clinic");
    assert.equal(body.taskAssignmentGroups[0].taskId, "forwardReach");
    assert.equal(body.taskAssignmentGroups[0].testedSide, "right");
    assert.ok(body.expiresAt);
  });

  it("hashes the token before lookup", async () => {
    const rawToken = resetState();
    await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.deepEqual(queryEqCalls, [
      { column: "token_hash", value: hashPatientAccessToken(rawToken) },
    ]);
  });

  it("rejects an invalid token", async () => {
    resetState();
    assignmentRow = null;
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: "unknown-token" }) });
    assert.equal(res.status, 404);
  });

  it("rejects an expired token", async () => {
    const rawToken = resetState();
    assignmentRow!.token_expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 404);
  });

  it("rejects completed and cancelled assignments as inactive", async () => {
    const rawToken = resetState();
    for (const status of ["completed", "cancelled"]) {
      assignmentRow!.status = status;
      const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
      assert.equal(res.status, 404, `expected status ${status} to be rejected`);
    }
  });

  it("accepts status started as active", async () => {
    const rawToken = resetState();
    assignmentRow!.status = "started";
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { assignmentId: string };
    assert.equal(body.assignmentId, "assignment-1");
  });

  it("rejects stored payload containing lateralReach", async () => {
    const rawToken = resetState();
    assignmentRow!.assignment_payload = validAssignmentPayload({
      taskAssignmentGroups: [
        {
          taskId: "lateralReach",
          testedSide: "right",
          eligible: true,
          attempts: 1,
          restPeriodSeconds: 30,
          targetPlacement: {
            direction: "lateral",
            height: "shoulder height",
            distance: "arm's length",
          },
        },
      ],
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string; reason?: string; detail?: string };
    assert.equal(body.error, "Something went wrong.");
    assert.equal(body.reason, undefined);
    assert.equal(body.detail, undefined);
  });

  it("rejects stored payload containing elbowExtension", async () => {
    const rawToken = resetState();
    assignmentRow!.assignment_payload = validAssignmentPayload({
      taskAssignmentGroups: [
        {
          taskId: "elbowExtension",
          testedSide: "right",
          eligible: true,
          attempts: 1,
          restPeriodSeconds: 30,
          targetPlacement: {
            direction: "forward",
            height: "shoulder height",
            distance: "arm's length",
          },
        },
      ],
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string; reason?: string; detail?: string };
    assert.equal(body.error, "Something went wrong.");
    assert.equal(body.reason, undefined);
    assert.equal(body.detail, undefined);
  });

  it("rejects stored payload containing multiple task groups", async () => {
    const rawToken = resetState();
    const group = validAssignmentPayload().taskAssignmentGroups[0];
    assignmentRow!.assignment_payload = validAssignmentPayload({
      taskAssignmentGroups: [group, { ...group, testedSide: "left" }],
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string; reason?: string; detail?: string };
    assert.equal(body.error, "Something went wrong.");
    assert.equal(body.reason, undefined);
    assert.equal(body.detail, undefined);
  });

  it("rejects stored payload with attempts other than 1", async () => {
    const rawToken = resetState();
    const payload = validAssignmentPayload();
    (payload.taskAssignmentGroups[0] as { attempts: number }).attempts = 5;
    assignmentRow!.assignment_payload = payload;
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string; reason?: string; detail?: string };
    assert.equal(body.error, "Something went wrong.");
    assert.equal(body.reason, undefined);
    assert.equal(body.detail, undefined);
  });

  it("returns only a generic response for malformed stored assignment", async () => {
    const rawToken = resetState();
    assignmentRow!.assignment_payload = { invalid: true };
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string; reason?: string; detail?: string };
    assert.equal(body.error, "Something went wrong.");
    assert.equal(body.reason, undefined);
    assert.equal(body.detail, undefined);
  });

  it("does not expose token hash in the response", async () => {
    const rawToken = resetState();
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    const text = await res.text();
    assert.equal(text.includes("token_hash"), false);
    assert.equal(text.includes(hashPatientAccessToken(rawToken)), false);
  });

  it("does not expose unrelated patient or clinician data", async () => {
    const rawToken = resetState();
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    const text = await res.text();
    assert.equal(text.includes("patient_id"), false);
    assert.equal(text.includes("provider_id"), false);
    assert.equal(text.includes("assignedBy"), false);
    assert.equal(text.includes("provider-1"), false);
    assert.equal(text.includes("patient-1"), false);
  });

  it("does not mutate the assignment or create a result", async () => {
    const rawToken = resetState();
    await GET(makeRequest(), { params: Promise.resolve({ token: rawToken }) });
    assert.equal(mutateCalled, false);
  });
});

describe("GET /api/patient/upper-limb-motor-screen/assignments/[token] — pre-query branches", () => {
  afterEach(() => {
    __setServiceRoleClientForTests(null);
  });

  it("returns 404 for an empty token", async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: "" }) });
    assert.equal(res.status, 404);
  });

  it("returns 503 when Supabase is not configured", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    __setServiceRoleClientForTests(null);
    try {
      const res = await GET(makeRequest(), {
        params: Promise.resolve({ token: "some-token" }),
      });
      assert.equal(res.status, 503);
    } finally {
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });
});
