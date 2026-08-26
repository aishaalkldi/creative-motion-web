/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/api/upper-limb-motor-screen/assignments/route.test.ts"
 *
 * Uses createUpperLimbAssignmentPostHandler(deps) directly, injecting
 * fakes for auth, rate limiting, id/clock generation, and a minimal
 * fake Supabase admin client — no real Next.js server, Supabase
 * client, or database.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createUpperLimbAssignmentGetHandler,
  createUpperLimbAssignmentPostHandler,
  type UpperLimbAssignmentGetDependencies,
  type UpperLimbAssignmentPostDependencies,
} from "./route";

const SCREEN_DEFINITION_ID = "upper-limb-forward-reach-v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeGetRequest(params: Record<string, string>): any {
  const searchParams = new URLSearchParams(params);
  return { nextUrl: { searchParams } };
}

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const PATIENT_ID = "22222222-2222-2222-2222-222222222222";
const GENERATED_ID = "33333333-3333-3333-3333-333333333333";
const NOW = "2026-08-17T10:00:00.000Z";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeRequest(body: unknown | (() => unknown)): any {
  return {
    json: async () => {
      if (typeof body === "function") return (body as () => unknown)();
      return body;
    },
  };
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

function taskGroup(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "forwardReach",
    testedSide: "right",
    eligible: true,
    attempts: 5,
    restPeriodSeconds: 30,
    targetPlacement: { direction: "forward", height: "shoulder height", distance: "arm's length" },
    ...overrides,
  };
}

const VALID_BODY = {
  patientId: PATIENT_ID,
  screenDefinitionId: "upper-limb-motor-screen-v1",
  affectedSide: "right",
  configuration: validConfiguration(),
  taskAssignmentGroups: [taskGroup()],
};

type FakeResult = { data: unknown; error: { code?: string; message: string } | null };

type FakeAdminOptions = {
  patientLookup?: FakeResult;
  insertResult?: FakeResult;
  findResult?: FakeResult;
};

function buildFakeAdminClient(options: FakeAdminOptions = {}) {
  const insertCalls: unknown[] = [];
  // Records the exact (column, value) pairs the ownership lookup filters
  // on, in call order — a regression test asserts against this so a
  // swapped column or value (e.g. .eq("provider_id", patientId) instead
  // of .eq("id", patientId)) fails the test even though the fake still
  // "works" mechanically.
  const patientEqCalls: [string, unknown][] = [];
  const findEqCalls: [string, unknown][] = [];
  const patientLookup: FakeResult = options.patientLookup ?? {
    data: { id: PATIENT_ID, provider_id: PROVIDER_ID },
    error: null,
  };
  const insertResult: FakeResult = options.insertResult ?? {
    data: null,
    error: { message: "insert not configured for this test" },
  };
  const findResult: FakeResult = options.findResult ?? { data: null, error: null };

  const client = {
    from(table: string) {
      if (table === "patients") {
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              patientEqCalls.push([column, value]);
              return {
                eq: (column2: string, value2: unknown) => {
                  patientEqCalls.push([column2, value2]);
                  return { single: async () => patientLookup };
                },
              };
            },
          }),
        };
      }
      if (table === "upper_limb_motor_screen_assignments") {
        // Single chainable builder covering both write (insert -> select
        // -> single) and read (select -> eq* -> order -> limit ->
        // maybeSingle) call shapes — mirrors how a real Supabase query
        // builder is one object regardless of which methods get called.
        const builder = {
          insert: (payload: unknown) => {
            insertCalls.push(payload);
            return builder;
          },
          select: () => builder,
          eq: (column: string, value: unknown) => {
            findEqCalls.push([column, value]);
            return builder;
          },
          order: () => builder,
          limit: () => builder,
          single: async () => insertResult,
          maybeSingle: async () => findResult,
        };
        return builder;
      }
      throw new Error(`unexpected table in fake admin client: ${table}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { client, insertCalls, patientEqCalls, findEqCalls };
}

type BuildDepsOptions = {
  authenticated?: boolean;
  rateLimited?: boolean;
  admin?: FakeAdminOptions;
};

function buildDeps(options: BuildDepsOptions = {}) {
  const { client, insertCalls, patientEqCalls, findEqCalls } = buildFakeAdminClient(options.admin);
  const deps: UpperLimbAssignmentPostDependencies = {
    getAuthenticatedUser: async () =>
      options.authenticated === false ? null : { id: PROVIDER_ID },
    adminClient: client,
    checkWriteLimit: () =>
      options.rateLimited ? { allowed: false, retryAfterSec: 30 } : { allowed: true },
    generateId: () => GENERATED_ID,
    now: () => NOW,
  };
  return { deps, insertCalls, patientEqCalls, findEqCalls };
}

function buildGetDeps(options: BuildDepsOptions = {}) {
  const { client, patientEqCalls, findEqCalls } = buildFakeAdminClient(options.admin);
  const deps: UpperLimbAssignmentGetDependencies = {
    getAuthenticatedUser: async () =>
      options.authenticated === false ? null : { id: PROVIDER_ID },
    adminClient: client,
  };
  return { deps, patientEqCalls, findEqCalls };
}

const INSERTED_ROW = {
  id: GENERATED_ID,
  provider_id: PROVIDER_ID,
  patient_id: PATIENT_ID,
  status: "assigned",
  assignment_payload: {
    id: GENERATED_ID,
    screenDefinitionId: VALID_BODY.screenDefinitionId,
    status: "assigned",
    assignedAt: NOW,
    assignedBy: PROVIDER_ID,
    affectedSide: VALID_BODY.affectedSide,
    configuration: VALID_BODY.configuration,
    taskAssignmentGroups: VALID_BODY.taskAssignmentGroups,
  },
  schema_version: "upper-limb-motor-screen/v1",
  screen_definition_id: null,
  assigned_at: null,
  affected_side: null,
  delivery_mode: null,
  token_hash: null,
  token_expires_at: null,
  created_at: NOW,
  updated_at: NOW,
};

describe("POST /api/upper-limb-motor-screen/assignments", () => {
  it("unauthenticated request -> 401, no ownership lookup or insert", async () => {
    const { deps, insertCalls } = buildDeps({ authenticated: false });
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(VALID_BODY));
    assert.equal(res.status, 401);
    assert.deepEqual(insertCalls, []);
  });

  it("rate-limited -> 429, no insert", async () => {
    const { deps, insertCalls } = buildDeps({ rateLimited: true });
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(VALID_BODY));
    assert.equal(res.status, 429);
    assert.deepEqual(insertCalls, []);
  });

  it("invalid JSON body -> 400", async () => {
    const { deps } = buildDeps();
    const res = await createUpperLimbAssignmentPostHandler(deps)(
      fakeRequest(() => {
        throw new Error("not json");
      }),
    );
    assert.equal(res.status, 400);
  });

  it("missing patientId -> 400, no ownership lookup", async () => {
    const { deps, insertCalls, patientEqCalls } = buildDeps();
    const { patientId: _drop, ...rest } = VALID_BODY;
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(rest));
    assert.equal(res.status, 400);
    assert.deepEqual(insertCalls, []);
    assert.deepEqual(patientEqCalls, []);
  });

  it("malformed (non-UUID) patientId -> 400, no ownership lookup, no insert", async () => {
    const { deps, insertCalls, patientEqCalls } = buildDeps();
    const res = await createUpperLimbAssignmentPostHandler(deps)(
      fakeRequest({ ...VALID_BODY, patientId: "not-a-uuid" }),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(insertCalls, []);
    // The malformed id must never even reach the ownership lookup —
    // this is the shape check being rejected before validatePatientOwnership runs.
    assert.deepEqual(patientEqCalls, []);
  });

  it("malformed patientId rejects a numeric/demo-style id too (never silently treated as ownable)", async () => {
    const { deps, insertCalls, patientEqCalls } = buildDeps();
    const res = await createUpperLimbAssignmentPostHandler(deps)(
      fakeRequest({ ...VALID_BODY, patientId: "42" }),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(insertCalls, []);
    assert.deepEqual(patientEqCalls, []);
  });

  it("patient ownership failure -> 404, no insert", async () => {
    const { deps, insertCalls } = buildDeps({
      admin: { patientLookup: { data: null, error: { code: "PGRST116", message: "no rows" } } },
    });
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(VALID_BODY));
    assert.equal(res.status, 404);
    assert.deepEqual(insertCalls, []);
  });

  it("ownership lookup filters on exactly (id, patientId) then (provider_id, providerId) — regression guard against swapped columns/values", async () => {
    const { deps, patientEqCalls } = buildDeps({
      admin: { insertResult: { data: INSERTED_ROW, error: null } },
    });
    await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(VALID_BODY));
    assert.deepEqual(patientEqCalls, [
      ["id", PATIENT_ID],
      ["provider_id", PROVIDER_ID],
    ]);
  });

  it("invalid assignment shape (missing screenDefinitionId) -> 400, no insert", async () => {
    const { deps, insertCalls } = buildDeps();
    const { screenDefinitionId: _drop, ...rest } = VALID_BODY;
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(rest));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.reason);
    assert.deepEqual(insertCalls, []);
  });

  it("successful creation -> 201, id/status/assignedAt/assignedBy are server-decided", async () => {
    const { deps, insertCalls } = buildDeps({
      admin: { insertResult: { data: INSERTED_ROW, error: null } },
    });
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(VALID_BODY));
    assert.equal(res.status, 201);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedPayload = insertCalls[0] as any;
    assert.equal(insertedPayload.id, GENERATED_ID);
    assert.equal(insertedPayload.provider_id, PROVIDER_ID);
    assert.equal(insertedPayload.patient_id, PATIENT_ID);
    assert.equal(insertedPayload.status, "assigned");
    assert.equal(insertedPayload.assignment_payload.assignedAt, NOW);
    assert.equal(insertedPayload.assignment_payload.assignedBy, PROVIDER_ID);
  });

  it("attacker-supplied id/status/assignedBy/providerId in the body are ignored", async () => {
    const { deps, insertCalls } = buildDeps({
      admin: { insertResult: { data: INSERTED_ROW, error: null } },
    });
    await createUpperLimbAssignmentPostHandler(deps)(
      fakeRequest({
        ...VALID_BODY,
        id: "attacker-id",
        status: "completed",
        assignedBy: "attacker-provider",
        providerId: "attacker-provider",
      }),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedPayload = insertCalls[0] as any;
    assert.equal(insertedPayload.id, GENERATED_ID);
    assert.equal(insertedPayload.status, "assigned");
    assert.equal(insertedPayload.provider_id, PROVIDER_ID);
    assert.equal(insertedPayload.assignment_payload.assignedBy, PROVIDER_ID);
  });

  it("insert failure -> sanitized 500", async () => {
    const { deps } = buildDeps({
      admin: { insertResult: { data: null, error: { message: "duplicate key value violates unique constraint" } } },
    });
    const res = await createUpperLimbAssignmentPostHandler(deps)(fakeRequest(VALID_BODY));
    assert.equal(res.status, 500);
    const json = await res.json();
    assert.ok(!JSON.stringify(json).includes("unique constraint"));
  });
});

describe("GET /api/upper-limb-motor-screen/assignments", () => {
  it("unauthenticated request -> 401, no lookups", async () => {
    const { deps, patientEqCalls, findEqCalls } = buildGetDeps({ authenticated: false });
    const res = await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ patientId: PATIENT_ID, screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.equal(res.status, 401);
    assert.deepEqual(patientEqCalls, []);
    assert.deepEqual(findEqCalls, []);
  });

  it("missing patientId -> 400, no lookups", async () => {
    const { deps, findEqCalls } = buildGetDeps();
    const res = await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(findEqCalls, []);
  });

  it("malformed (non-UUID) patientId -> 400, no lookups", async () => {
    const { deps, patientEqCalls, findEqCalls } = buildGetDeps();
    const res = await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ patientId: "42", screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(patientEqCalls, []);
    assert.deepEqual(findEqCalls, []);
  });

  it("missing screenDefinitionId -> 400, no find lookup", async () => {
    const { deps, findEqCalls } = buildGetDeps();
    const res = await createUpperLimbAssignmentGetHandler(deps)(fakeGetRequest({ patientId: PATIENT_ID }));
    assert.equal(res.status, 400);
    assert.deepEqual(findEqCalls, []);
  });

  it("patient ownership failure -> 404, never leaks another provider's data, no find lookup", async () => {
    const { deps, findEqCalls } = buildGetDeps({
      admin: { patientLookup: { data: null, error: { code: "PGRST116", message: "no rows" } } },
    });
    const res = await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ patientId: PATIENT_ID, screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.equal(res.status, 404);
    assert.deepEqual(findEqCalls, []);
  });

  it("no matching assignment -> 200 { assignment: null }, never fabricated", async () => {
    const { deps } = buildGetDeps({ admin: { findResult: { data: null, error: null } } });
    const res = await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ patientId: PATIENT_ID, screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.assignment, null);
  });

  it("find lookup filters on exactly (patient_id, provider_id, screenDefinitionId) — provider-scoped, regression guard", async () => {
    const { deps, findEqCalls } = buildGetDeps({
      admin: { findResult: { data: INSERTED_ROW, error: null } },
    });
    await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ patientId: PATIENT_ID, screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.deepEqual(findEqCalls, [
      ["patient_id", PATIENT_ID],
      ["provider_id", PROVIDER_ID],
      ["assignment_payload->>screenDefinitionId", SCREEN_DEFINITION_ID],
    ]);
  });

  it("returns the found assignment in the same public shape as POST", async () => {
    const { deps } = buildGetDeps({ admin: { findResult: { data: INSERTED_ROW, error: null } } });
    const res = await createUpperLimbAssignmentGetHandler(deps)(
      fakeGetRequest({ patientId: PATIENT_ID, screenDefinitionId: SCREEN_DEFINITION_ID }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.assignment.assignment.id, GENERATED_ID);
    assert.equal(json.assignment.patientId, PATIENT_ID);
    assert.equal(json.assignment.providerId, PROVIDER_ID);
  });
});
