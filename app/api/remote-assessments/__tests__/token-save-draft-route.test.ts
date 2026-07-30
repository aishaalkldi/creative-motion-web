/**
 * Run: npx tsx --test app/api/remote-assessments/__tests__/token-save-draft-route.test.ts
 *
 * Unlike token-submit-route.test.ts (which deliberately scopes DB round-trip
 * branches out — see that file's header note), this suite exercises the full
 * insert/update/idempotency logic directly by injecting a fake Supabase
 * client via the route's __setServiceRoleClientForTests test hook (the same
 * seam the route already exposes for this purpose). No real or fake network
 * call is made — the fake client is a plain in-memory object.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  __setServiceRoleClientForTests,
  POST,
} from "../[token]/save-draft/route";
import { REMOTE_ASSESSMENT_MAX_JSON_BYTES } from "@/app/lib/remote-assessment-validation";

const FAKE_SUPABASE_URL = "http://127.0.0.1:54321";
const FAKE_SUPABASE_SERVICE_ROLE_KEY = "test-fake-service-role-key";

type FakeRequestRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  status: string;
  assessment_id: string | null;
  assessment_type: string;
};

type FakeAssessmentRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  status: string;
  structured_data: unknown;
};

let requestRow: FakeRequestRow | null;
let requestFetchError: { code?: string; message?: string } | null;
let assessmentsById: Map<string, FakeAssessmentRow>;
let insertCalls: Record<string, unknown>[];
let updateAssessmentCalls: { id: string; patch: Record<string, unknown> }[];
let linkUpdateCalls: Record<string, unknown>[];
let insertError: { code?: string; message?: string } | null;
let updateError: { code?: string; message?: string } | null;
let linkError: { code?: string; message?: string } | null;
let nextAssessmentId: number;

function resetState() {
  requestRow = {
    id: "req-1",
    patient_id: "patient-1",
    provider_id: "provider-1",
    status: "pending",
    assessment_id: null,
    assessment_type: "post_stroke_intake",
  };
  requestFetchError = null;
  assessmentsById = new Map();
  insertCalls = [];
  updateAssessmentCalls = [];
  linkUpdateCalls = [];
  insertError = null;
  updateError = null;
  linkError = null;
  nextAssessmentId = 1;
}

function makeFakeClient() {
  return {
    from(table: string) {
      if (table === "remote_assessment_requests") {
        return {
          select: () => ({
            eq: () => ({
              gt: () => ({
                maybeSingle: async () => ({ data: requestRow, error: requestFetchError }),
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              linkUpdateCalls.push(patch);
              if (linkError) return { error: linkError };
              if (requestRow) requestRow = { ...requestRow, assessment_id: patch.assessment_id as string };
              return { error: null };
            },
          }),
        };
      }
      if (table === "assessments") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                insertCalls.push(row);
                if (insertError) return { data: null, error: insertError };
                const id = `assessment-${nextAssessmentId++}`;
                assessmentsById.set(id, {
                  id,
                  patient_id: row.patient_id as string,
                  provider_id: row.provider_id as string,
                  type: row.type as string,
                  status: row.status as string,
                  structured_data: row.structured_data,
                });
                return { data: { id }, error: null };
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_c1: string, id: string) => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => {
                      updateAssessmentCalls.push({ id, patch });
                      if (updateError) return { data: null, error: updateError };
                      const existing = assessmentsById.get(id);
                      if (existing) {
                        assessmentsById.set(id, { ...existing, structured_data: patch.structured_data });
                      }
                      return { data: { id }, error: null };
                    },
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function makeRequest(init: {
  body?: unknown;
  rawBody?: string;
  contentLength?: string;
  ip?: string;
}): NextRequest {
  const headers: Record<string, string> = {
    "x-forwarded-for": init.ip ?? `10.3.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  };
  if (init.contentLength !== undefined) headers["content-length"] = init.contentLength;

  const bodyText = init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);
  if (bodyText !== undefined && init.contentLength === undefined) {
    headers["content-length"] = String(Buffer.byteLength(bodyText));
  }

  return new NextRequest("http://localhost/api/remote-assessments/x/save-draft", {
    method: "POST",
    headers,
    body: bodyText,
  });
}

function paramsFor(token: string) {
  return { params: Promise.resolve({ token }) };
}

function noUrgentBody(postStrokeIntakeOverrides: Record<string, unknown> = {}) {
  return {
    structuredData: {
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
        ...postStrokeIntakeOverrides,
      },
      assessmentLanguage: "en",
    },
  };
}

describe("POST /api/remote-assessments/[token]/save-draft", { concurrency: 1 }, () => {
  const savedEnv: Record<string, string | undefined> = {};

  before(() => {
    savedEnv.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedEnv.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SUPABASE_SERVICE_ROLE_KEY;
  });

  after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    __setServiceRoleClientForTests(null);
  });

  beforeEach(() => {
    resetState();
    __setServiceRoleClientForTests(makeFakeClient() as never);
  });

  afterEach(() => {
    __setServiceRoleClientForTests(null);
  });

  it("returns 404 for an empty token", async () => {
    const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor(""));
    assert.equal(res.status, 404);
  });

  it("returns 413 when Content-Length exceeds the byte cap", async () => {
    const res = await POST(
      makeRequest({ rawBody: "{}", contentLength: String(REMOTE_ASSESSMENT_MAX_JSON_BYTES + 1) }),
      paramsFor("tok"),
    );
    assert.equal(res.status, 413);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest({ rawBody: "{not valid" }), paramsFor("tok"));
    assert.equal(res.status, 400);
  });

  it("returns 404 when the request is not found", async () => {
    requestRow = null;
    const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("missing-token"));
    assert.equal(res.status, 404);
  });

  it("returns 404 when the request has already reached a terminal state", async () => {
    requestRow!.status = "submitted";
    const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    assert.equal(res.status, 404);
  });

  it("returns 400 for a non-post_stroke_intake request type", async () => {
    requestRow!.assessment_type = "remote_questionnaire";
    const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    assert.equal(res.status, 400);
  });

  it("rejects a real urgent symptom — must go through /submit instead", async () => {
    const res = await POST(
      makeRequest({
        body: noUrgentBody({ urgentGate: { symptoms: ["fall_with_injury"] } }),
      }),
      paramsFor("tok"),
    );
    assert.equal(res.status, 400);
    assert.equal(insertCalls.length, 0);
  });

  it("creates exactly one draft assessment on first save", async () => {
    const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    assert.equal(res.status, 200);
    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0].type, "post_stroke_intake");
    assert.equal(insertCalls[0].status, "draft");
  });

  it("keeps the request pending and never sets submitted_at", async () => {
    await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    assert.equal(requestRow!.status, "pending");
    // The route never writes submitted_at at all for this endpoint.
    assert.equal(linkUpdateCalls.every((call) => !("submitted_at" in call)), true);
  });

  it("links assessment_id back onto the request row", async () => {
    const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    const body = (await res.json()) as { saved: boolean; assessmentId: string };
    assert.equal(body.saved, true);
    assert.equal(requestRow!.assessment_id, body.assessmentId);
  });

  it("persists stopped: false", async () => {
    await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    const [id] = assessmentsById.keys();
    const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
    const postStroke = stored.postStrokeIntake as Record<string, unknown>;
    const urgentGate = postStroke.urgentGate as { stopped: boolean };
    assert.equal(urgentGate.stopped, false);
  });

  it("generates the timestamp server-side, discarding a spoofed one", async () => {
    await POST(
      makeRequest({
        body: noUrgentBody({ urgentGate: { symptoms: ["no_new_urgent_symptoms"], recordedAt: "1999-01-01T00:00:00.000Z" } }),
      }),
      paramsFor("tok"),
    );
    const [id] = assessmentsById.keys();
    const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
    const postStroke = stored.postStrokeIntake as Record<string, unknown>;
    const urgentGate = postStroke.urgentGate as { recordedAt: string };
    assert.notEqual(urgentGate.recordedAt, "1999-01-01T00:00:00.000Z");
    assert.ok(!Number.isNaN(Date.parse(urgentGate.recordedAt)));
  });

  it("persists flags equal to exactly ['clinician_review_required']", async () => {
    await POST(
      makeRequest({
        body: noUrgentBody({ urgentGate: { symptoms: ["no_new_urgent_symptoms"], flags: ["urgent_symptoms_reported", "intake_stopped"] } }),
      }),
      paramsFor("tok"),
    );
    const [id] = assessmentsById.keys();
    const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
    const postStroke = stored.postStrokeIntake as Record<string, unknown>;
    const urgentGate = postStroke.urgentGate as { flags: string[] };
    assert.deepEqual(urgentGate.flags, ["clinician_review_required"]);
  });

  it("discards a spoofed stopped: true", async () => {
    await POST(
      makeRequest({
        body: noUrgentBody({ urgentGate: { symptoms: ["no_new_urgent_symptoms"], stopped: true } }),
      }),
      paramsFor("tok"),
    );
    const [id] = assessmentsById.keys();
    const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
    const postStroke = stored.postStrokeIntake as Record<string, unknown>;
    const urgentGate = postStroke.urgentGate as { stopped: boolean };
    assert.equal(urgentGate.stopped, false);
  });

  it("reuses the already-linked draft on a repeated save — no second assessment row", async () => {
    const first = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    const firstBody = (await first.json()) as { assessmentId: string };
    assert.equal(insertCalls.length, 1);

    const second = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    const secondBody = (await second.json()) as { assessmentId: string };

    assert.equal(insertCalls.length, 1, "expected no second insert");
    assert.equal(updateAssessmentCalls.length, 1, "expected the second save to update instead");
    assert.equal(secondBody.assessmentId, firstBody.assessmentId);
    assert.equal(assessmentsById.size, 1);
  });

  it("updates the existing draft's content on a repeated save with different data", async () => {
    await POST(
      makeRequest({ body: noUrgentBody({ respondent: { type: "patient" } }) }),
      paramsFor("tok"),
    );
    await POST(
      makeRequest({
        body: noUrgentBody({ respondent: { type: "patient_with_caregiver_assistance", assistanceType: "technology_support" } }),
      }),
      paramsFor("tok"),
    );

    assert.equal(assessmentsById.size, 1);
    const [id] = assessmentsById.keys();
    const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
    const postStroke = stored.postStrokeIntake as Record<string, unknown>;
    const respondent = postStroke.respondent as { type: string; assistanceType?: string };
    assert.equal(respondent.type, "patient_with_caregiver_assistance");
    assert.equal(respondent.assistanceType, "technology_support");
  });

  it("never persists a safety clearance, diagnosis, risk score, severity, or delivery-mode field", async () => {
    await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
    const [id] = assessmentsById.keys();
    const serialized = JSON.stringify(assessmentsById.get(id!)!.structured_data);
    assert.doesNotMatch(serialized, /diagnos|severity|safe|unsafe|cleared|remote_self|remote_supervised|in_clinic|risk_score/i);
  });

  it("returns 503 when Supabase is not configured and no test override is set", async () => {
    __setServiceRoleClientForTests(null);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const res = await POST(makeRequest({ body: noUrgentBody() }), paramsFor("tok"));
      assert.equal(res.status, 503);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  describe("Stage 3 — functionalIntake partial saves", () => {
    it("persists a partial functionalIntake alongside the preserved respondent/urgentGate", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({
            functionalIntake: {
              moreAffectedSide: "left",
              sittingAbility: "independent",
              standingAbility: "independent",
              walkingAbility: "independent",
              assistiveDevice: "none",
              recentFalls: "none",
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 200);
      const [id] = assessmentsById.keys();
      const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      assert.deepEqual(postStroke.respondent, { type: "patient" });
      const functionalIntake = postStroke.functionalIntake as Record<string, unknown>;
      assert.equal(functionalIntake.moreAffectedSide, "left");
    });

    it("reuses the same assessment across screen-by-screen partial saves — no second row", async () => {
      const first = await POST(
        makeRequest({
          body: noUrgentBody({ functionalIntake: { moreAffectedSide: "left" } }),
        }),
        paramsFor("tok"),
      );
      const firstBody = (await first.json()) as { assessmentId: string };

      const second = await POST(
        makeRequest({
          body: noUrgentBody({
            functionalIntake: { moreAffectedSide: "left", upperLimbUse: "limited_use" },
          }),
        }),
        paramsFor("tok"),
      );
      const secondBody = (await second.json()) as { assessmentId: string };

      assert.equal(insertCalls.length, 1, "expected no second insert across screens");
      assert.equal(secondBody.assessmentId, firstBody.assessmentId);

      const stored = assessmentsById.get(firstBody.assessmentId)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      const functionalIntake = postStroke.functionalIntake as Record<string, unknown>;
      assert.equal(functionalIntake.upperLimbUse, "limited_use");
    });

    it("rejects an unexpected field inside functionalIntake — no assessment written", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({ functionalIntake: { moreAffectedSide: "left", diagnosis: "stroke" } }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 400);
      assert.equal(insertCalls.length, 0);
    });

    it("requires assistiveDeviceOtherText when assistiveDevice is 'other'", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({ functionalIntake: { assistiveDevice: "other" } }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 400);
    });

    it("keeps the request pending and submitted_at null during Stage 3 partial saves", async () => {
      await POST(
        makeRequest({ body: noUrgentBody({ functionalIntake: { moreAffectedSide: "left" } }) }),
        paramsFor("tok"),
      );
      assert.equal(requestRow!.status, "pending");
      assert.equal(linkUpdateCalls.every((call) => !("submitted_at" in call)), true);
    });

    it("never persists a fall-risk score, safety verdict, or delivery-mode field", async () => {
      await POST(
        makeRequest({
          body: noUrgentBody({
            functionalIntake: {
              moreAffectedSide: "left",
              sittingAbility: "independent",
              standingAbility: "independent",
              walkingAbility: "independent",
              assistiveDevice: "none",
              recentFalls: "none",
              upperLimbUse: "functional_use",
              communicationSupport: "none",
              functionalGoal: "Walk to the kitchen safely",
            },
          }),
        }),
        paramsFor("tok"),
      );
      const [id] = assessmentsById.keys();
      const serialized = JSON.stringify(assessmentsById.get(id!)!.structured_data);
      assert.doesNotMatch(
        serialized,
        /diagnos|severity|\bsafe\b|unsafe|cleared|remote_self|remote_supervised|in_clinic|risk_score/i,
      );
    });
  });

  describe("Stage 4 — subjective narrative partial saves", () => {
    it("persists text-input responses alongside preserved respondent/urgentGate/functionalIntake", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [
                { questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking far." },
              ],
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 200);
      const [id] = assessmentsById.keys();
      const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      assert.deepEqual(postStroke.respondent, { type: "patient" });
      const narrative = postStroke.subjectiveNarrative as { responses: Array<{ questionId: string; inputMode: string; text: string }> };
      assert.equal(narrative.responses.length, 1);
      assert.equal(narrative.responses[0].text, "Trouble walking far.");
      assert.equal(narrative.responses[0].inputMode, "text");
    });

    it("persists voice-input responses with inputMode = 'voice' — same field, different method", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [
                { questionId: "onsetOrChange", inputMode: "voice", text: "Started two weeks ago." },
              ],
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 200);
      const [id] = assessmentsById.keys();
      const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      const narrative = postStroke.subjectiveNarrative as { responses: Array<{ questionId: string; inputMode: string }> };
      assert.equal(narrative.responses[0].inputMode, "voice");
    });

    it("keeps the request pending and submitted_at null during an ordinary partial save", async () => {
      await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking far." }],
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(requestRow!.status, "pending");
      assert.equal(linkUpdateCalls.every((call) => !("submitted_at" in call)), true);
      const [id] = assessmentsById.keys();
      const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      const narrative = postStroke.subjectiveNarrative as Record<string, unknown>;
      assert.equal(narrative.patientConfirmedAt, undefined);
    });

    it("rejects a client-supplied patientConfirmedAt on a partial save — request stays pending, nothing written", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking far." }],
              patientConfirmedAt: "2020-01-01T00:00:00.000Z",
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 400);
      assert.equal(insertCalls.length, 0);
      assert.equal(requestRow!.status, "pending");
    });

    it("reuses the same assessment across narrative screen-by-screen saves — no duplicate row", async () => {
      const first = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking far." }],
            },
          }),
        }),
        paramsFor("tok"),
      );
      const firstBody = (await first.json()) as { assessmentId: string };

      const second = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [
                { questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking far." },
                { questionId: "onsetOrChange", inputMode: "voice", text: "Two weeks ago." },
              ],
            },
          }),
        }),
        paramsFor("tok"),
      );
      const secondBody = (await second.json()) as { assessmentId: string };

      assert.equal(insertCalls.length, 1, "expected no second insert across narrative screens");
      assert.equal(secondBody.assessmentId, firstBody.assessmentId);

      const stored = assessmentsById.get(firstBody.assessmentId)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      const narrative = postStroke.subjectiveNarrative as { responses: unknown[] };
      assert.equal(narrative.responses.length, 2);
    });

    it("treats additionalInformation as optional — an empty answer is silently dropped, not rejected", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [{ questionId: "additionalInformation", inputMode: "text", text: "   " }],
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 200);
      const [id] = assessmentsById.keys();
      const stored = assessmentsById.get(id!)!.structured_data as Record<string, unknown>;
      const postStroke = stored.postStrokeIntake as Record<string, unknown>;
      assert.equal(postStroke.subjectiveNarrative, undefined);
    });

    it("rejects an unexpected field inside a response entry — no assessment written", async () => {
      const res = await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [
                { questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking.", diagnosis: "stroke" },
              ],
            },
          }),
        }),
        paramsFor("tok"),
      );
      assert.equal(res.status, 400);
      assert.equal(insertCalls.length, 0);
    });

    it("never persists audio, a raw ASR transcript field, or a fall-risk/diagnosis/delivery-mode field", async () => {
      await POST(
        makeRequest({
          body: noUrgentBody({
            subjectiveNarrative: {
              responses: [
                { questionId: "mainDifficulty", inputMode: "voice", text: "Trouble walking daily." },
              ],
            },
          }),
        }),
        paramsFor("tok"),
      );
      const [id] = assessmentsById.keys();
      const serialized = JSON.stringify(assessmentsById.get(id!)!.structured_data);
      assert.doesNotMatch(
        serialized,
        /audio|rawTranscript|diagnos|severity|\bsafe\b|unsafe|cleared|remote_self|remote_supervised|in_clinic|risk_score/i,
      );
    });
  });
});
