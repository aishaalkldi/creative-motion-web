/**
 * Run: npx tsx --test app/api/remote-assessments/__tests__/token-submit-route.test.ts
 *
 * See token-get-route.test.ts for why this lives outside the [token] dir.
 *
 * Scope note: plain `tsx`/`node` processes do not load .env.local (only
 * Next's own dev/build/start tooling does that), so NEXT_PUBLIC_SUPABASE_URL
 * / SUPABASE_SERVICE_ROLE_KEY are unset by default here regardless of what's
 * in .env.local. This suite installs FAKE placeholder values for those two
 * vars so `adminClient()` succeeds in constructing a client object (which
 * does not itself make a network call) — every test below returns before
 * the route ever awaits a real `.from(...)` query, so no live or fake
 * network call happens in any of them. This also makes the suite safe even
 * if run under a harness that *does* load real .env.local values, since the
 * real values are saved and restored around a deliberate override. Only the
 * branches that require an actual DB round trip (not-found/expired/
 * already-submitted/insert success) are out of scope for this PR.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  __setServiceRoleClientForTests,
  POST,
  resolveAssessmentStatusForInsert,
  resolveAssessmentTypeForInsert,
} from "../[token]/submit/route";
import { REMOTE_ASSESSMENT_MAX_JSON_BYTES } from "@/app/lib/remote-assessment-validation";

const FAKE_SUPABASE_URL = "http://127.0.0.1:54321";
const FAKE_SUPABASE_SERVICE_ROLE_KEY = "test-fake-service-role-key";

function makeRequest(init: {
  body?: unknown;
  rawBody?: string;
  contentLength?: string;
  ip?: string;
}): NextRequest {
  const headers: Record<string, string> = {
    "x-forwarded-for": init.ip ?? `10.2.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  };
  if (init.contentLength !== undefined) headers["content-length"] = init.contentLength;

  const bodyText = init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);
  if (bodyText !== undefined && init.contentLength === undefined) {
    headers["content-length"] = String(Buffer.byteLength(bodyText));
  }

  return new NextRequest("http://localhost/api/remote-assessments/x/submit", {
    method: "POST",
    headers,
    body: bodyText,
  });
}

function paramsFor(token: string) {
  return { params: Promise.resolve({ token }) };
}

// Explicit concurrency:1 — the "not configured" test mutates process.env;
// sibling tests must not interleave with that mutation.
describe("POST /api/remote-assessments/[token]/submit", { concurrency: 1 }, () => {
  let savedUrl: string | undefined;
  let savedKey: string | undefined;

  before(() => {
    savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SUPABASE_SERVICE_ROLE_KEY;
  });

  after(() => {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  it("returns 404 for an empty token", async () => {
    const req = makeRequest({ body: { structuredData: { a: "b" } } });
    const res = await POST(req, paramsFor(""));
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
  });

  it("returns 413 when Content-Length exceeds the byte cap", async () => {
    const req = makeRequest({
      rawBody: "{}",
      contentLength: String(REMOTE_ASSESSMENT_MAX_JSON_BYTES + 1),
    });
    const res = await POST(req, paramsFor(crypto.randomUUID()));
    assert.equal(res.status, 413);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Assessment data exceeds allowed size.");
  });

  it("returns 400 for an invalid JSON body", async () => {
    const req = makeRequest({ rawBody: "{not valid json" });
    const res = await POST(req, paramsFor(crypto.randomUUID()));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid JSON body.");
  });

  it("returns 400 when structuredData is missing", async () => {
    const req = makeRequest({ body: {} });
    const res = await POST(req, paramsFor(crypto.randomUUID()));
    assert.equal(res.status, 400);
  });

  it("returns 400 when structuredData is an empty object", async () => {
    const req = makeRequest({ body: { structuredData: {} } });
    const res = await POST(req, paramsFor(crypto.randomUUID()));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid assessment data.");
  });

  it("returns 429 after exceeding the rate limit, before any DB call", async () => {
    const token = crypto.randomUUID();
    const ip = `10.2.99.${Math.floor(Math.random() * 255)}`;
    // Body is intentionally invalid JSON — every allowed call resolves to a
    // deterministic 400 without touching the database; only the last call's
    // status (429) matters for this test.
    for (let i = 0; i < 20; i++) {
      const req = makeRequest({ rawBody: "not json", ip });
      const res = await POST(req, paramsFor(token));
      assert.notEqual(res.status, 429, `call ${i + 1} should not yet be rate-limited`);
    }
    const overLimitReq = makeRequest({ rawBody: "not json", ip });
    const overLimitRes = await POST(overLimitReq, paramsFor(token));
    assert.equal(overLimitRes.status, 429);
  });

  it("returns 503 when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const req = makeRequest({ body: { structuredData: { a: "b" } } });
      const res = await POST(req, paramsFor(crypto.randomUUID()));
      assert.equal(res.status, 503);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SUPABASE_SERVICE_ROLE_KEY;
    }
  });
});

/**
 * Regression coverage for the assessments.type hard-code fix: this used to be
 * `type: "remote_questionnaire"` unconditionally on insert, ignoring
 * remote_assessment_requests.assessment_type entirely. The DB round trip
 * itself is out of scope for this suite (see file header) — these tests
 * cover the exported pure decision function directly.
 */
describe("resolveAssessmentTypeForInsert", () => {
  it("passes post_stroke_intake through unchanged", () => {
    assert.equal(resolveAssessmentTypeForInsert("post_stroke_intake"), "post_stroke_intake");
  });

  it("preserves existing behavior: remote_questionnaire stays remote_questionnaire", () => {
    assert.equal(resolveAssessmentTypeForInsert("remote_questionnaire"), "remote_questionnaire");
  });

  it("preserves existing behavior: any other/unrecognized request type still defaults to remote_questionnaire", () => {
    for (const value of ["general_msk", "sports", "gait", "pain_function", "", "unknown_future_type"]) {
      assert.equal(
        resolveAssessmentTypeForInsert(value),
        "remote_questionnaire",
        `expected "${value}" to default to remote_questionnaire`,
      );
    }
  });
});

/**
 * Regression coverage for the persisted-status fix: a stopped urgent
 * post-stroke intake must never be recorded as "completed" (that would read
 * as clinically finished / cleared). It must also never introduce a new
 * "interrupted" status — "draft" (an existing, already-used value) is reused
 * instead. Every other case keeps the prior universal "completed" default.
 */
describe("resolveAssessmentStatusForInsert", () => {
  it('persists a stopped post_stroke_intake as "draft", never "completed"', () => {
    assert.equal(resolveAssessmentStatusForInsert("post_stroke_intake", true), "draft");
  });

  it('persists a non-stopped post_stroke_intake as "completed" (existing behavior preserved)', () => {
    assert.equal(resolveAssessmentStatusForInsert("post_stroke_intake", false), "completed");
  });

  it('existing remote_questionnaire submissions retain "completed" regardless of the stopped flag', () => {
    assert.equal(resolveAssessmentStatusForInsert("remote_questionnaire", true), "completed");
    assert.equal(resolveAssessmentStatusForInsert("remote_questionnaire", false), "completed");
  });

  it('never produces a new "interrupted" status value', () => {
    for (const [type, stopped] of [
      ["post_stroke_intake", true],
      ["post_stroke_intake", false],
      ["remote_questionnaire", true],
    ] as const) {
      assert.notEqual(resolveAssessmentStatusForInsert(type, stopped), "interrupted");
    }
  });
});

/**
 * Full DB round-trip coverage using the route's __setServiceRoleClientForTests
 * injection seam (a fake in-memory Supabase client — no real or fake network
 * call). This is the regression proof that the urgent-stop path is unchanged
 * after adding the no-urgent draft-save endpoint, plus the new guard that
 * rejects a non-stopped post-stroke payload here (it must go through
 * /save-draft instead).
 */
describe("POST /api/remote-assessments/[token]/submit — DB round trip", { concurrency: 1 }, () => {
  type FakeRequestRow = {
    id: string;
    patient_id: string;
    provider_id: string;
    status: string;
    assessment_id: string | null;
    submitted_at: string | null;
    assessment_type: string;
  };

  let requestRow: FakeRequestRow | null;
  let insertedType: string | null;
  let insertedStatus: string | null;
  let finalizeCalls: Record<string, unknown>[];

  function resetState() {
    requestRow = {
      id: "req-1",
      patient_id: "patient-1",
      provider_id: "provider-1",
      status: "pending",
      assessment_id: null,
      submitted_at: null,
      assessment_type: "post_stroke_intake",
    };
    insertedType = null;
    insertedStatus = null;
    finalizeCalls = [];
  }

  function makeFakeClient() {
    return {
      from(table: string) {
        if (table === "remote_assessment_requests") {
          return {
            select: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: async () => ({ data: requestRow, error: null }),
                }),
              }),
            }),
            update: (patch: Record<string, unknown>) => ({
              eq: async () => {
                finalizeCalls.push(patch);
                if (requestRow) {
                  requestRow = {
                    ...requestRow,
                    status: (patch.status as string) ?? requestRow.status,
                    submitted_at: (patch.submitted_at as string) ?? requestRow.submitted_at,
                    assessment_id: (patch.assessment_id as string) ?? requestRow.assessment_id,
                  };
                }
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
                  insertedType = row.type as string;
                  insertedStatus = row.status as string;
                  return { data: { id: "assessment-1", created_at: "2026-07-29T00:00:00.000Z" }, error: null };
                },
              }),
            }),
          };
        }
        if (table === "speech_transcription_sessions") {
          return {
            update: () => ({
              eq: () => ({
                is: async () => ({ error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    };
  }

  beforeEach(() => {
    resetState();
    __setServiceRoleClientForTests(makeFakeClient() as never);
  });

  afterEach(() => {
    __setServiceRoleClientForTests(null);
  });

  it("preserves the existing urgent-stop path exactly: draft status, submitted request, server flags", async () => {
    const req = makeRequest({
      body: {
        structuredData: {
          postStrokeIntake: {
            respondent: { type: "patient" },
            urgentGate: { symptoms: ["fall_with_injury"] },
          },
          assessmentLanguage: "en",
        },
      },
    });
    const res = await POST(req, paramsFor("tok"));
    assert.equal(res.status, 200);
    assert.equal(insertedType, "post_stroke_intake");
    assert.equal(insertedStatus, "draft");
    assert.equal(requestRow!.status, "submitted");
    assert.ok(requestRow!.submitted_at);
  });

  it("rejects a non-stopped post-stroke payload — must use /save-draft instead", async () => {
    const req = makeRequest({
      body: {
        structuredData: {
          postStrokeIntake: {
            respondent: { type: "patient" },
            urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          },
          assessmentLanguage: "en",
        },
      },
    });
    const res = await POST(req, paramsFor("tok"));
    assert.equal(res.status, 400);
    assert.equal(insertedType, null, "no assessment should be inserted");
    assert.equal(requestRow!.status, "pending", "the request must remain pending");
  });

  it("preserves existing remote_questionnaire behavior: completed status, submitted request", async () => {
    requestRow!.assessment_type = "remote_questionnaire";
    const req = makeRequest({ body: { structuredData: { pain: { chiefComplaint: "Shoulder pain" } } } });
    const res = await POST(req, paramsFor("tok"));
    assert.equal(res.status, 200);
    assert.equal(insertedType, "remote_questionnaire");
    assert.equal(insertedStatus, "completed");
    assert.equal(requestRow!.status, "submitted");
  });
});
