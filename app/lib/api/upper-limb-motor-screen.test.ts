/**
 * Run: npx tsx --test app/lib/api/upper-limb-motor-screen.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildMotorScreenPatientLink,
  createForwardReachAssignment,
  getForwardReachAssignmentByToken,
  MOTOR_SCREEN_SCREEN_DEFINITION_ID,
  type ForwardReachAssignmentInput,
} from "./upper-limb-motor-screen";

function validInput(overrides: Partial<ForwardReachAssignmentInput> = {}): ForwardReachAssignmentInput {
  return {
    patientId: "patient-1",
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
    forwardReachTaskGroup: {
      testedSide: "right",
      eligible: true,
      restPeriodSeconds: 30,
      targetPlacement: { direction: "forward", height: "shoulder height", distance: "arm's length" },
    },
    ...overrides,
  };
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createForwardReachAssignment", () => {
  it("sends exactly one forwardReach task group with attempts fixed to 1", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ assignmentId: "a1", patientAccessToken: "tok", expiresAt: "2026-08-07T00:00:00.000Z" }),
        { status: 201 },
      );
    }) as typeof fetch;

    await createForwardReachAssignment(validInput());

    assert.ok(capturedBody);
    const body = capturedBody as unknown as Record<string, unknown>;
    assert.equal(body.screenDefinitionId, MOTOR_SCREEN_SCREEN_DEFINITION_ID);
    const groups = body.taskAssignmentGroups as Record<string, unknown>[];
    assert.equal(groups.length, 1);
    assert.equal(groups[0].taskId, "forwardReach");
    assert.equal(groups[0].attempts, 1);
  });

  it("posts to the existing clinician assignment endpoint unmodified", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method ?? "";
      return new Response(
        JSON.stringify({ assignmentId: "a1", patientAccessToken: "tok", expiresAt: "2026-08-07T00:00:00.000Z" }),
        { status: 201 },
      );
    }) as typeof fetch;

    await createForwardReachAssignment(validInput());
    assert.equal(capturedUrl, "/api/clinician/upper-limb-motor-screen/assignments");
    assert.equal(capturedMethod, "POST");
  });

  it("returns the created assignment on success", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ assignmentId: "a1", patientAccessToken: "raw-token", expiresAt: "2026-08-07T00:00:00.000Z" }),
        { status: 201 },
      )) as typeof fetch;

    const result = await createForwardReachAssignment(validInput());
    assert.equal(result.assignmentId, "a1");
    assert.equal(result.patientAccessToken, "raw-token");
  });

  it("surfaces the server's validation message on 400 without inventing one", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "affectedSide is required and must be 'left' or 'right'." }), {
        status: 400,
      })) as typeof fetch;

    await assert.rejects(
      createForwardReachAssignment(validInput()),
      /affectedSide is required/,
    );
  });

  it("maps 401 to a generic session-expired message without exposing internals", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 401 })) as typeof fetch;
    await assert.rejects(createForwardReachAssignment(validInput()), /session has expired/i);
  });

  it("maps 404 to a generic patient-not-found message", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 404 })) as typeof fetch;
    await assert.rejects(createForwardReachAssignment(validInput()), /Patient not found/);
  });

  it("maps unexpected 500 to a generic message, not a raw error dump", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>Internal Server Error trace...</html>", { status: 500 })) as typeof fetch;
    const err = await createForwardReachAssignment(validInput()).catch((e: Error) => e);
    assert.ok(err instanceof Error);
    assert.doesNotMatch(err.message, /trace|html/i);
  });

  it("throws a generic connectivity message when the network call itself fails", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;
    await assert.rejects(createForwardReachAssignment(validInput()), /connection/i);
  });
});

describe("buildMotorScreenPatientLink", () => {
  it("returns empty string when window is unavailable (server-side)", () => {
    assert.equal(buildMotorScreenPatientLink("tok"), "");
  });
});

describe("getForwardReachAssignmentByToken", () => {
  it("maps HTTP 404 to invalid_or_expired without distinguishing cause", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 404 })) as typeof fetch;
    const result = await getForwardReachAssignmentByToken("tok");
    assert.deepEqual(result, { ok: false, kind: "invalid_or_expired" });
  });

  it("maps HTTP 500 to server_error", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 500 })) as typeof fetch;
    const result = await getForwardReachAssignmentByToken("tok");
    assert.deepEqual(result, { ok: false, kind: "server_error" });
  });

  it("maps a network failure to server_error", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    const result = await getForwardReachAssignmentByToken("tok");
    assert.deepEqual(result, { ok: false, kind: "server_error" });
  });

  it("returns the sanitized assignment on success", async () => {
    const view = {
      assignmentId: "a1",
      screenDefinitionId: "rasq-upper-limb-motor-screen-v1",
      status: "assigned",
      affectedSide: "right",
      deliveryMode: "in_clinic",
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
          targetPlacement: { direction: "forward", height: "shoulder height", distance: "arm's length" },
        },
      ],
      expiresAt: "2026-08-07T00:00:00.000Z",
    };
    globalThis.fetch = (async () => new Response(JSON.stringify(view), { status: 200 })) as typeof fetch;
    const result = await getForwardReachAssignmentByToken("tok");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.assignment.assignmentId, "a1");
      assert.equal("providerId" in result.assignment, false);
      assert.equal("patientId" in result.assignment, false);
      assert.equal("tokenHash" in result.assignment, false);
    }
  });
});
