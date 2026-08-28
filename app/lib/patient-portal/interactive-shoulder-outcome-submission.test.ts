/**
 * Run:
 *   npx tsx --test app/lib/patient-portal/interactive-shoulder-outcome-submission.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTERACTIVE_SHOULDER_OUTCOME_NETWORK_ERROR,
  buildInteractiveShoulderOutcomeRequestBody,
  shouldSubmitInteractiveShoulderOutcome,
  submitInteractiveShoulderOutcome,
  type SubmitInteractiveShoulderOutcomeInput,
} from "./interactive-shoulder-outcome-submission";
import type { InteractiveShoulderSessionCompletionSnapshot } from "@/app/lib/interactive-shoulder/orchestrator-cv-session-types";

const TOKEN = "patient-token-abc123";
const PLAN_SESSION_ID = "33333333-3333-3333-3333-333333333333";

function snapshot(
  overrides: Partial<InteractiveShoulderSessionCompletionSnapshot> = {},
): InteractiveShoulderSessionCompletionSnapshot {
  return {
    sessionState: "completed",
    sessionElapsedSeconds: 95,
    accumulatedBlockResults: [
      {
        blockId: "block-1",
        movementId: "shoulder-abduction-reach",
        startedAtMs: 0,
        completedAtMs: 4000,
        completionReason: "duration",
        interaction: {
          targetsContacted: 5,
          patternsCompleted: 0,
          timingSamplesMs: [],
          responseConsistency: null,
          participationDurationSeconds: 30,
        },
        measured: {
          validRepetitions: 5,
          invalidRepetitions: 0,
          rangeValuesDegrees: [],
          holdDurationSeconds: null,
          movementSpeed: null,
          returnControl: null,
          trackingConfidence: null,
        },
        interpreted: {
          compensationEvents: 0,
          asymmetryObservations: [],
          fatigueTrend: "unknown",
          reducedControl: false,
          trackingLimitations: [],
        },
      },
    ],
    ...overrides,
  };
}

function validInput(
  overrides: Partial<SubmitInteractiveShoulderOutcomeInput> = {},
): SubmitInteractiveShoulderOutcomeInput {
  return {
    token: TOKEN,
    planSessionId: PLAN_SESSION_ID,
    snapshot: snapshot(),
    ...overrides,
  };
}

describe("buildInteractiveShoulderOutcomeRequestBody", () => {
  it("maps sessionElapsedSeconds to totalElapsedSeconds, and derives block counts from the real accumulated results", () => {
    const body = buildInteractiveShoulderOutcomeRequestBody(validInput());
    assert.equal(body.totalElapsedSeconds, 95);
    assert.equal(body.blocksCompleted, 1);
    assert.equal(body.blocksTotal, 1);
    assert.deepEqual(body.blockResults, snapshot().accumulatedBlockResults);
  });

  it("never includes providerId, patientId, planId, or prescribedSide", () => {
    const body = buildInteractiveShoulderOutcomeRequestBody(validInput()) as Record<string, unknown>;
    for (const forbidden of ["providerId", "patientId", "planId", "prescribedSide"]) {
      assert.equal(Object.prototype.hasOwnProperty.call(body, forbidden), false, forbidden);
    }
  });

  it("carries the real token and planSessionId through unchanged", () => {
    const body = buildInteractiveShoulderOutcomeRequestBody(validInput());
    assert.equal(body.token, TOKEN);
    assert.equal(body.planSessionId, PLAN_SESSION_ID);
  });
});

describe("shouldSubmitInteractiveShoulderOutcome", () => {
  it("only 'idle' permits starting a submission attempt", () => {
    assert.equal(shouldSubmitInteractiveShoulderOutcome("idle"), true);
  });

  it("a concurrent 'submitting' attempt is never duplicated — repeated calls/renders while in flight submit nothing new", () => {
    assert.equal(shouldSubmitInteractiveShoulderOutcome("submitting"), false);
  });

  it("a completed 'submitted' attempt is never resubmitted, however many more times it is asked", () => {
    assert.equal(shouldSubmitInteractiveShoulderOutcome("submitted"), false);
    // Idempotent under repetition — asking again changes nothing.
    assert.equal(shouldSubmitInteractiveShoulderOutcome("submitted"), false);
    assert.equal(shouldSubmitInteractiveShoulderOutcome("submitted"), false);
  });
});

describe("submitInteractiveShoulderOutcome", () => {
  it("POSTs exactly once, to the existing endpoint, with the built request body", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "x", created: true }), { status: 201 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const result = await submitInteractiveShoulderOutcome(validInput(), fetchImpl);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.created, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/patient/interactive-shoulder-outcomes");
    assert.equal(calls[0].init.method, "POST");
  });

  it("a non-2xx response maps to a friendly message, not a raw status/body leak", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "internal database failure detail" }), {
        status: 500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any;

    const result = await submitInteractiveShoulderOutcome(validInput(), fetchImpl);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "internal database failure detail");
  });

  it("a network failure maps to a friendly retry-safe message", async () => {
    const fetchImpl = (async () => {
      throw new Error("fetch failed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const result = await submitInteractiveShoulderOutcome(validInput(), fetchImpl);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, INTERACTIVE_SHOULDER_OUTCOME_NETWORK_ERROR);
  });

  it("calling it again after a failure sends the same snapshot content — never regenerates a new measurement", async () => {
    const bodies: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      return new Response("{}", { status: 500 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const input = validInput();
    await submitInteractiveShoulderOutcome(input, fetchImpl);
    await submitInteractiveShoulderOutcome(input, fetchImpl);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
  });

  it("a successful (created) response is reported as created:true; a replay is created:false", async () => {
    const fetchImplCreated = (async () =>
      new Response(JSON.stringify({ id: "x", created: true }), { status: 201 })) as unknown as typeof fetch;
    const fetchImplReplay = (async () =>
      new Response(JSON.stringify({ id: "x", created: false }), { status: 200 })) as unknown as typeof fetch;

    const created = await submitInteractiveShoulderOutcome(validInput(), fetchImplCreated);
    const replay = await submitInteractiveShoulderOutcome(validInput(), fetchImplReplay);
    assert.equal(created.ok && created.created, true);
    assert.equal(replay.ok && replay.created, false);
  });
});
