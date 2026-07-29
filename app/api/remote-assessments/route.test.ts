/**
 * Focused mocked coverage for POST /api/remote-assessments — specifically the
 * link-generation fix: the returned `url` must route a post_stroke_intake
 * request to /post-stroke-intake/[token] and every other request type
 * (remote_questionnaire, the default) to /assessment/[token], unchanged.
 *
 * No real Supabase network call is made — every dependency is mocked, and a
 * global fetch guard fails any test that attempts a real network call.
 *
 * Run: npx tsx --experimental-test-module-mocks --test app/api/remote-assessments/route.test.ts
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type FakeUser = { id: string; email?: string } | null;
type FakePatient = { id: string; provider_id: string } | null;

let authUser: FakeUser = { id: "provider-1", email: "provider@example.com" };
let authError: unknown = null;
let patientRow: FakePatient = { id: "patient-1", provider_id: "provider-1" };
let patientQueryError: { code?: string; message?: string } | null = null;
let insertCalls: Array<Record<string, unknown>> = [];
let insertedRow: { token: string; expires_at: string } | null = {
  token: "generated-token",
  expires_at: "2026-08-05T00:00:00.000Z",
};
let insertError: { code?: string; message?: string } | null = null;

function resetState() {
  authUser = { id: crypto.randomUUID(), email: "provider@example.com" };
  authError = null;
  patientRow = { id: "patient-1", provider_id: authUser.id };
  patientQueryError = null;
  insertCalls = [];
  insertedRow = { token: "generated-token", expires_at: "2026-08-05T00:00:00.000Z" };
  insertError = null;
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

// Same pattern as app/api/assessments/[id]/route.test.ts — only @supabase/ssr's
// createServerClient is mocked; SUPABASE_SERVICE_ROLE_KEY is left unset so
// adminClient falls back to sessionClient, exactly as in production with no
// service key configured.
function makeFakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: authError }),
    },
    from: (table: string) => {
      if (table === "patients") {
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
      if (table === "remote_assessment_requests") {
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
  return new Request("http://localhost/api/remote-assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/remote-assessments — link generation", { concurrency: 1 }, () => {
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
    ({ POST } = await import("./route"));
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

  it('routes assessmentType "post_stroke_intake" to /post-stroke-intake/[token]', async () => {
    const res = await POST(
      makeRequest({ patientId: "patient-1", assessmentType: "post_stroke_intake" }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; url: string };
    assert.equal(body.url, `/post-stroke-intake/${body.token}`);
  });

  it('routes assessmentType "remote_questionnaire" to /assessment/[token]', async () => {
    const res = await POST(
      makeRequest({ patientId: "patient-1", assessmentType: "remote_questionnaire" }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; url: string };
    assert.equal(body.url, `/assessment/${body.token}`);
  });

  it("routes the default (omitted assessmentType) to /assessment/[token], unchanged", async () => {
    const res = await POST(makeRequest({ patientId: "patient-1" }));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; url: string };
    assert.equal(body.url, `/assessment/${body.token}`);
  });

  it("routes every other known assessment type to /assessment/[token], unchanged", async () => {
    for (const assessmentType of ["general_msk", "sports", "gait", "pain_function"]) {
      const res = await POST(makeRequest({ patientId: "patient-1", assessmentType }));
      assert.equal(res.status, 200);
      const body = (await res.json()) as { token: string; url: string };
      assert.equal(body.url, `/assessment/${body.token}`, `expected ${assessmentType} to route to /assessment`);
    }
  });

  it("persists the requested assessment_type on the remote_assessment_requests row", async () => {
    await POST(makeRequest({ patientId: "patient-1", assessmentType: "post_stroke_intake" }));
    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0].assessment_type, "post_stroke_intake");
  });
});
