/**
 * Run: npx tsx --experimental-test-module-mocks --test app/api/clinician/upper-limb-motor-screen/assignments/__tests__/route.test.ts
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";
import { hashPatientAccessToken } from "@/app/lib/upper-limb-motor-screen-api/token";

type FakeUser = { id: string; email?: string } | null;
type FakePatient = { id: string; provider_id: string } | null;

let authUser: FakeUser = { id: "provider-1", email: "provider@example.com" };
let authError: unknown = null;
let patientRow: FakePatient = { id: "patient-1", provider_id: "provider-1" };
let patientQueryError: { code?: string; message?: string } | null = null;
let insertCalls: Array<Record<string, unknown>> = [];
let insertedRow: { id: string; token_expires_at: string } | null = {
  id: "assignment-id-1",
  token_expires_at: "2026-08-07T00:00:00.000Z",
};
let insertError: { code?: string; message?: string } | null = null;
let patientsTableCalled = false;
let insertTableCalled = false;

function resetState() {
  authUser = { id: crypto.randomUUID(), email: "provider@example.com" };
  authError = null;
  patientRow = { id: "patient-1", provider_id: authUser.id };
  patientQueryError = null;
  insertCalls = [];
  insertedRow = {
    id: crypto.randomUUID(),
    token_expires_at: "2026-08-07T00:00:00.000Z",
  };
  insertError = null;
  patientsTableCalled = false;
  insertTableCalled = false;
}

function validConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    startingSittingPosition: "chair_with_armrests",
    backTrunkSupport: "full_back_support",
    affectedArmSupport: "armrest",
    baselinePainScore: 2,
    permittedMovementRange: { kind: "not_applicable" },
    caregiverSupervisionRequirement: "not_required",
    deliveryMode: "in_clinic",
    patientSpecificStopCriteria: [],
    ...overrides,
  };
}

function validTaskGroup(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function validRequestBody(overrides: Record<string, unknown> = {}) {
  return {
    patientId: "patient-1",
    screenDefinitionId: "upper-limb-motor-screen-v1",
    affectedSide: "right",
    configuration: validConfiguration(),
    taskAssignmentGroups: [validTaskGroup()],
    ...overrides,
  };
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

function makeFakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: authError }),
    },
    from: (table: string) => {
      if (table === "patients") {
        patientsTableCalled = true;
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: patientRow, error: patientQueryError }),
              }),
            }),
          }),
        };
      }
      if (table === "upper_limb_motor_screen_assignments") {
        insertTableCalled = true;
        return {
          insert: (row: Record<string, unknown>) => {
            insertCalls.push(row);
            return {
              select: () => ({
                single: async () => ({ data: insertedRow, error: insertError }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient: () => makeFakeClient(),
  },
});

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/clinician/upper-limb-motor-screen/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/clinician/upper-limb-motor-screen/assignments", { concurrency: 1 }, () => {
  let POST: (req: NextRequest) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  before(async () => {
    const testEnv: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
    for (const key of Object.keys(testEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = testEnv[key];
    }
    savedEnv.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ({ POST } = await import("../route"));
  });

  after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    resetState();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("no real network call is permitted in this test file");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects unauthenticated requests", async () => {
    authUser = null;
    const res = await POST(makeRequest(validRequestBody()));
    assert.equal(res.status, 401);
  });

  it("rejects unauthorized patient assignment", async () => {
    patientRow = null;
    patientQueryError = { code: "PGRST116" };
    const res = await POST(makeRequest(validRequestBody()));
    assert.equal(res.status, 404);
  });

  it("returns 201 for a valid Forward Reach assignment", async () => {
    const res = await POST(makeRequest(validRequestBody()));
    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      assignmentId: string;
      patientAccessToken: string;
      expiresAt: string;
    };
    assert.ok(body.assignmentId);
    assert.ok(body.patientAccessToken);
    assert.ok(body.expiresAt);
  });

  it("persists a valid assignment", async () => {
    await POST(makeRequest(validRequestBody()));
    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0].patient_id, "patient-1");
    assert.equal(insertCalls[0].affected_side, "right");
    assert.equal(insertCalls[0].delivery_mode, "in_clinic");
  });

  it("derives assignedBy from the authenticated clinician", async () => {
    await POST(makeRequest(validRequestBody()));
    const payload = insertCalls[0].assignment_payload as { assignedBy: string };
    assert.equal(payload.assignedBy, authUser!.id);
    assert.equal(insertCalls[0].provider_id, authUser!.id);
  });

  it("server-generates assignedAt and assignment ID", async () => {
    await POST(makeRequest(validRequestBody()));
    const payload = insertCalls[0].assignment_payload as {
      id: string;
      assignedAt: string;
    };
    assert.ok(payload.id);
    assert.ok(payload.assignedAt);
    assert.equal(insertCalls[0].id, payload.id);
    assert.equal(insertCalls[0].assigned_at, payload.assignedAt);
  });

  it("returns the raw patient token once in the 201 response", async () => {
    const res = await POST(makeRequest(validRequestBody()));
    const body = (await res.json()) as { patientAccessToken: string };
    assert.ok(body.patientAccessToken.length >= 32);
  });

  it("persists only the token hash, not the raw token", async () => {
    const res = await POST(makeRequest(validRequestBody()));
    const body = (await res.json()) as { patientAccessToken: string };
    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0].token_hash, hashPatientAccessToken(body.patientAccessToken));
    assert.notEqual(insertCalls[0].token_hash, body.patientAccessToken);
    assert.equal("token" in (insertCalls[0] as object), false);
  });

  it("rejects missing affectedSide", async () => {
    const body = validRequestBody();
    delete (body as Record<string, unknown>).affectedSide;
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 400);
  });

  it("rejects invalid affectedSide", async () => {
    const res = await POST(makeRequest(validRequestBody({ affectedSide: "bilateral" })));
    assert.equal(res.status, 400);
  });

  it("rejects missing testedSide", async () => {
    const group = validTaskGroup();
    delete (group as Record<string, unknown>).testedSide;
    const res = await POST(makeRequest(validRequestBody({ taskAssignmentGroups: [group] })));
    assert.equal(res.status, 400);
  });

  it("rejects invalid testedSide", async () => {
    const res = await POST(
      makeRequest(
        validRequestBody({
          taskAssignmentGroups: [validTaskGroup({ testedSide: "bilateral" })],
        }),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("rejects missing deliveryMode", async () => {
    const configuration = validConfiguration();
    delete (configuration as Record<string, unknown>).deliveryMode;
    const res = await POST(makeRequest(validRequestBody({ configuration })));
    assert.equal(res.status, 400);
  });

  it("rejects unsupervised delivery values", async () => {
    for (const deliveryMode of ["remote_self", "self", "unsupervised", "remote"]) {
      const res = await POST(
        makeRequest(
          validRequestBody({
            configuration: validConfiguration({ deliveryMode }),
          }),
        ),
      );
      assert.equal(res.status, 400, `expected ${deliveryMode} to be rejected`);
    }
  });

  it("rejects Lateral Reach", async () => {
    const res = await POST(
      makeRequest(
        validRequestBody({
          taskAssignmentGroups: [validTaskGroup({ taskId: "lateralReach" })],
        }),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("rejects Elbow Extension", async () => {
    const res = await POST(
      makeRequest(
        validRequestBody({
          taskAssignmentGroups: [validTaskGroup({ taskId: "elbowExtension" })],
        }),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("rejects multiple task groups", async () => {
    const res = await POST(
      makeRequest(
        validRequestBody({
          taskAssignmentGroups: [validTaskGroup(), validTaskGroup({ testedSide: "left" })],
        }),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("rejects more than one attempt", async () => {
    const res = await POST(
      makeRequest(
        validRequestBody({
          taskAssignmentGroups: [validTaskGroup({ attempts: 5 })],
        }),
      ),
    );
    assert.equal(res.status, 400);
  });

  it("rejects spoofed assignedBy, assignedAt, id, and status", async () => {
    const res = await POST(
      makeRequest({
        ...validRequestBody(),
        id: "spoofed-id",
        assignedBy: "spoofed-provider",
        assignedAt: "2020-01-01T00:00:00.000Z",
        status: "completed",
      }),
    );
    assert.equal(res.status, 400);
  });

  it("rejects raw frames, landmarks, coordinates, or trajectory fields", async () => {
    for (const forbidden of [
      { landmarks: [{ x: 1 }] },
      { frames: [1] },
      { bodyCoordinates: { x: 1 } },
      { trajectory: [1, 2] },
    ]) {
      const res = await POST(makeRequest({ ...validRequestBody(), ...forbidden }));
      assert.equal(res.status, 400);
    }
  });

  it("rejects diagnostic or treatment language fields", async () => {
    for (const forbidden of [
      { diagnosis: "stroke" },
      { fmaScore: 42 },
      { treatmentPlan: "continue therapy" },
      { clinicianInterpretation: "looks fine" },
    ]) {
      const res = await POST(makeRequest({ ...validRequestBody(), ...forbidden }));
      assert.equal(res.status, 400);
    }
  });

  it("returns 400 for numeric patientId without reaching ownership lookup or insert", async () => {
    const res = await POST(makeRequest(validRequestBody({ patientId: 12345 })));
    assert.equal(res.status, 400);
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });

  it("returns 400 for object patientId without reaching ownership lookup or insert", async () => {
    const res = await POST(makeRequest(validRequestBody({ patientId: { id: "patient-1" } })));
    assert.equal(res.status, 400);
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });

  it("returns 400 for numeric screenDefinitionId", async () => {
    const res = await POST(makeRequest(validRequestBody({ screenDefinitionId: 42 })));
    assert.equal(res.status, 400);
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });

  it("returns 400 for object screenDefinitionId", async () => {
    const res = await POST(
      makeRequest(validRequestBody({ screenDefinitionId: { id: "upper-limb-motor-screen-v1" } })),
    );
    assert.equal(res.status, 400);
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });

  it("returns 400 for whitespace-only patientId", async () => {
    const res = await POST(makeRequest(validRequestBody({ patientId: "   " })));
    assert.equal(res.status, 400);
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });

  it("returns 400 for whitespace-only screenDefinitionId", async () => {
    const res = await POST(makeRequest(validRequestBody({ screenDefinitionId: "\t" })));
    assert.equal(res.status, 400);
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });

  it("rejects an unknown non-server-controlled top-level key independently", async () => {
    const res = await POST(makeRequest({ ...validRequestBody(), unexpectedField: "value" }));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; detail?: string };
    assert.match(body.error, /Unknown request fields/);
    assert.equal(body.detail, "unexpectedField");
    assert.equal(patientsTableCalled, false);
    assert.equal(insertTableCalled, false);
  });
});
