/**
 * Focused mocked coverage for the clinician-authenticated extraction route.
 * No real OpenAI, Supabase, or external network call is made anywhere in
 * this file — every external dependency is mocked, and a global fetch guard
 * fails any test that attempts a real network call.
 *
 * Run: npx tsx --experimental-test-module-mocks --test app/api/assessments/[id]/extract/route.test.ts
 * (must be run from within this directory, or from a shell that does not
 * treat the "[id]" path segment as a glob — see Stage 1's report for the
 * same Node test-runner quirk.)
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type FakeUser = { id: string; email?: string } | null;
type FakePatient = { id: string; provider_id: string } | null;
type FakeAssessment = {
  id: string;
  patient_id: string;
  provider_id: string;
  structured_data: Record<string, unknown> | null;
} | null;
type Extraction = {
  body_region: string;
  side: string;
  primary_symptom: string;
  aggravating_factor: string | null;
  language: string;
  confidence: number;
};
type ExtractOutcome =
  | { ok: true; extraction: Extraction }
  | {
      ok: false;
      code: "invalid_key" | "quota_or_billing" | "rate_limit" | "provider_error" | "no_content" | "invalid_output";
    };

const SHOULDER_EXTRACTION: Extraction = {
  body_region: "shoulder",
  side: "right",
  primary_symptom: "pain",
  aggravating_factor: "overhead arm elevation",
  language: "ar",
  confidence: 0.92,
};

let authUser: FakeUser = { id: "user-123", email: "provider@example.com" };
let authError: unknown = null;
let assessmentRow: FakeAssessment = {
  id: "assess-1",
  patient_id: "patient-1",
  provider_id: "user-123",
  structured_data: { pain: { chiefComplaint: "عندي ألم في الكتف الأيمن لما أرفع يدي." } },
};
let assessmentQueryError: { code?: string; message?: string } | null = null;
let patientRow: FakePatient = { id: "patient-1", provider_id: "user-123" };
let patientQueryError: { code?: string; message?: string } | null = null;
let extractOutcome: ExtractOutcome = { ok: true, extraction: SHOULDER_EXTRACTION };
let updateCalls: Array<{ patch: Record<string, unknown> }> = [];
let updateError: { code?: string; message?: string } | null = null;
let capturedExtractArgs: { apiKey: string; text: string; language: string } | null = null;

function resetState() {
  authUser = { id: "user-123", email: "provider@example.com" };
  authError = null;
  assessmentRow = {
    id: "assess-1",
    patient_id: "patient-1",
    provider_id: "user-123",
    structured_data: { pain: { chiefComplaint: "عندي ألم في الكتف الأيمن لما أرفع يدي." } },
  };
  assessmentQueryError = null;
  patientRow = { id: "patient-1", provider_id: "user-123" };
  patientQueryError = null;
  extractOutcome = { ok: true, extraction: SHOULDER_EXTRACTION };
  updateCalls = [];
  updateError = null;
  capturedExtractArgs = null;
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

// See app/api/assessments/[id]/translate/route.test.ts for why only
// @supabase/ssr's createServerClient is mocked here (mock.module() does not
// reliably intercept @supabase/supabase-js's createClient in this tsx/Node
// setup) — we never set SUPABASE_SERVICE_ROLE_KEY, so buildClients() falls
// back to `adminClient = sessionClient`, exactly as in production with no
// service key configured.
function makeFakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: authError }),
    },
    from: (table: string) => {
      if (table === "assessments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: assessmentRow, error: assessmentQueryError }),
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              eq: async () => {
                updateCalls.push({ patch });
                return { error: updateError };
              },
            }),
          }),
        };
      }
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
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient: () => makeFakeClient(),
  },
});

mock.module("@/app/lib/ai/extract-clinical-fields", {
  namedExports: {
    extractStructuredClinicalFields: async (apiKey: string, text: string, language: string) => {
      capturedExtractArgs = { apiKey, text, language };
      return extractOutcome;
    },
  },
});

function makeRequest(body: unknown = {}): NextRequest {
  return new Request("http://localhost/api/assessments/assess-1/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/assessments/[id]/extract", { concurrency: 1 }, () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  before(async () => {
    const testEnv: Record<string, string> = {
      OPENAI_API_KEY: "sk-test-key",
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

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("no real network call is permitted in this test file");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function ctx() {
    return { params: Promise.resolve({ id: "assess-1" }) };
  }

  it("requires clinician authentication — no session returns 401", async () => {
    resetState();
    authUser = null;
    authError = { message: "Auth session missing" };

    const res = await POST(makeRequest(), ctx());

    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Unauthorized");
  });

  it("returns 401 for an unauthenticated request even when the OpenAI key is missing — auth is checked first", async () => {
    resetState();
    authUser = null;
    authError = { message: "Auth session missing" };
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await POST(makeRequest(), ctx());
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: string; code?: string };
      assert.equal(body.error, "Unauthorized");
      assert.notEqual(body.code, "AI_KEY_MISSING");
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = saved;
    }
  });

  it("checks clinician ownership — mismatched provider returns a safe rejection, not the patient row", async () => {
    resetState();
    patientRow = null;
    patientQueryError = { code: "PGRST116", message: "no rows" };

    const res = await POST(makeRequest(), ctx());

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, "AI_CONTEXT_INVALID");
    assert.doesNotMatch(body.error, /patient-1|user-123/);
  });

  it("returns the safe ownership-failure response even when the OpenAI key is missing", async () => {
    resetState();
    patientRow = null;
    patientQueryError = { code: "PGRST116", message: "no rows" };
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await POST(makeRequest(), ctx());
      assert.equal(res.status, 404);
      const body = (await res.json()) as { code: string };
      assert.equal(body.code, "AI_CONTEXT_INVALID");
      assert.notEqual(body.code, "AI_KEY_MISSING");
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = saved;
    }
  });

  it("returns a safe error when the Supabase assessment read fails, without leaking the DB error", async () => {
    resetState();
    assessmentQueryError = { code: "500", message: "connection terminated unexpectedly" };

    const res = await POST(makeRequest(), ctx());
    const text = await res.text();

    assert.equal(res.status, 503);
    const body = JSON.parse(text) as { code: string };
    assert.equal(body.code, "AI_PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(text, /connection terminated|PGRST|500/i);
  });

  it("reads the chief complaint from stored structured_data, ignoring anything sent in the request body", async () => {
    resetState();
    const stored = "عندي ألم في الكتف الأيمن لما أرفع يدي.";
    assessmentRow!.structured_data = { pain: { chiefComplaint: stored } };

    const res = await POST(
      makeRequest({ text: "a completely different, attacker-supplied statement", chiefComplaint: "also ignored" }),
      ctx(),
    );

    assert.equal(res.status, 200);
    assert.equal(capturedExtractArgs?.text, stored);
  });

  it("leaves Arabic original text in structured_data byte-for-byte unchanged after a fresh extraction", async () => {
    resetState();
    const original = "عندي ألم في الكتف الأيمن لما أرفع يدي.";
    assessmentRow!.structured_data = { pain: { chiefComplaint: original } };

    await POST(makeRequest(), ctx());

    assert.equal(updateCalls.length, 1);
    const structuredData = updateCalls[0].patch.structured_data as Record<string, unknown>;
    const pain = structuredData.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, original);
  });

  it("leaves English original text in structured_data byte-for-byte unchanged after a fresh extraction", async () => {
    resetState();
    const original = "I have pain in my right shoulder when I lift my arm.";
    assessmentRow!.structured_data = { pain: { chiefComplaint: original } };

    await POST(makeRequest(), ctx());

    assert.equal(updateCalls.length, 1);
    const structuredData = updateCalls[0].patch.structured_data as Record<string, unknown>;
    const pain = structuredData.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, original);
  });

  it("stores only the six whitelisted extraction fields — no diagnostic or unknown field", async () => {
    resetState();
    await POST(makeRequest(), ctx());

    assert.equal(updateCalls.length, 1);
    const structuredData = updateCalls[0].patch.structured_data as Record<string, unknown>;
    const stored = structuredData.chiefComplaint_extraction as Record<string, unknown>;
    assert.deepEqual(Object.keys(stored).sort(), [
      "aggravating_factor",
      "body_region",
      "confidence",
      "language",
      "primary_symptom",
      "side",
    ]);
    assert.equal("diagnosis" in stored, false);
    assert.equal("treatment_recommendation" in stored, false);
  });

  it("stores chiefComplaint_extraction_reviewed as false on a fresh extraction", async () => {
    resetState();
    await POST(makeRequest(), ctx());

    assert.equal(updateCalls.length, 1);
    const structuredData = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(structuredData.chiefComplaint_extraction_reviewed, false);
    assert.equal(typeof structuredData.chiefComplaint_extraction_generated_at, "string");
  });

  it("returns a cached extraction unchanged, preserving an existing reviewed=true status, without calling the model", async () => {
    resetState();
    assessmentRow!.structured_data = {
      pain: { chiefComplaint: "عندي ألم في الكتف الأيمن لما أرفع يدي." },
      chiefComplaint_extraction: SHOULDER_EXTRACTION,
      chiefComplaint_extraction_generated_at: "2026-01-01T00:00:00.000Z",
      chiefComplaint_extraction_reviewed: true,
    };

    const res = await POST(makeRequest(), ctx());

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      extraction: Extraction;
      generatedAt: string;
      reviewed: boolean;
      cached: boolean;
    };
    assert.deepEqual(body, {
      extraction: SHOULDER_EXTRACTION,
      generatedAt: "2026-01-01T00:00:00.000Z",
      reviewed: true,
      cached: true,
    });
    assert.equal(capturedExtractArgs, null, "extractStructuredClinicalFields must not be called on a cache hit");
    assert.equal(updateCalls.length, 0, "no DB write should happen on a cache hit");
  });

  it("returns a cached extraction without an OpenAI call when reviewed is still false", async () => {
    resetState();
    assessmentRow!.structured_data = {
      pain: { chiefComplaint: "عندي ألم في الكتف الأيمن لما أرفع يدي." },
      chiefComplaint_extraction: SHOULDER_EXTRACTION,
      chiefComplaint_extraction_generated_at: "2026-01-01T00:00:00.000Z",
      chiefComplaint_extraction_reviewed: false,
    };

    const res = await POST(makeRequest(), ctx());
    const body = (await res.json()) as { cached: boolean; reviewed: boolean };

    assert.equal(body.cached, true);
    assert.equal(body.reviewed, false);
    assert.equal(capturedExtractArgs, null);
  });

  it("returns a valid cached extraction successfully even when the OpenAI key is missing — the key is never required for a cache hit", async () => {
    resetState();
    assessmentRow!.structured_data = {
      pain: { chiefComplaint: "عندي ألم في الكتف الأيمن لما أرفع يدي." },
      chiefComplaint_extraction: SHOULDER_EXTRACTION,
      chiefComplaint_extraction_generated_at: "2026-01-01T00:00:00.000Z",
      chiefComplaint_extraction_reviewed: false,
    };
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await POST(makeRequest(), ctx());
      assert.equal(res.status, 200);
      const body = (await res.json()) as { cached: boolean; extraction: Extraction };
      assert.equal(body.cached, true);
      assert.deepEqual(body.extraction, SHOULDER_EXTRACTION);
      assert.equal(capturedExtractArgs, null);
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = saved;
    }
  });

  it("returns a safe validation error when the chief complaint is missing", async () => {
    resetState();
    assessmentRow!.structured_data = { pain: { chiefComplaint: "" } };

    const res = await POST(makeRequest(), ctx());

    assert.equal(res.status, 400);
    const body = (await res.json()) as { code: string };
    assert.equal(body.code, "AI_INVALID_INPUT");
  });

  it("returns a safe validation error when the chief complaint is entirely absent", async () => {
    resetState();
    assessmentRow!.structured_data = {};

    const res = await POST(makeRequest(), ctx());

    assert.equal(res.status, 400);
    const body = (await res.json()) as { code: string };
    assert.equal(body.code, "AI_INVALID_INPUT");
  });

  it("enforces rate limiting after repeated requests from the same clinician", async () => {
    resetState();
    authUser = { id: "user-rate-limit-test", email: "provider@example.com" };
    assessmentRow!.provider_id = "user-rate-limit-test";
    patientRow!.provider_id = "user-rate-limit-test";

    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      assessmentRow!.structured_data = { pain: { chiefComplaint: `statement number ${i}` } };
      last = await POST(makeRequest(), ctx());
    }

    assert.equal(last?.status, 429);
    const body = (await last!.json()) as { code: string };
    assert.equal(body.code, "AI_RATE_LIMITED");
  });

  it("returns a safe error when the OpenAI key is not configured", async () => {
    resetState();
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await POST(makeRequest(), ctx());
      assert.equal(res.status, 503);
      const body = (await res.json()) as { code: string; error: string };
      assert.equal(body.code, "AI_KEY_MISSING");
      assert.doesNotMatch(body.error, /sk-|api key/i);
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = saved;
    }
  });

  it("maps a provider-unavailable extraction error to a safe response without leaking details", async () => {
    resetState();
    extractOutcome = { ok: false, code: "provider_error" };

    const res = await POST(makeRequest(), ctx());
    const text = await res.text();

    assert.equal(res.status, 503);
    assert.doesNotMatch(text, /openai|traceback|stack|APIError/i);
  });

  it("maps a no-content model response to a safe 502", async () => {
    resetState();
    extractOutcome = { ok: false, code: "no_content" };

    const res = await POST(makeRequest(), ctx());

    assert.equal(res.status, 502);
    const body = (await res.json()) as { code: string };
    assert.equal(body.code, "AI_NO_CONTENT");
  });

  it("maps malformed/unparseable model JSON to a safe response without leaking parse detail", async () => {
    resetState();
    extractOutcome = { ok: false, code: "invalid_output" };

    const res = await POST(makeRequest(), ctx());
    const text = await res.text();

    assert.equal(res.status, 503);
    assert.doesNotMatch(text, /json|parse|syntaxerror/i);
  });

  it("returns a safe error when the Supabase update fails, without leaking the DB error", async () => {
    resetState();
    updateError = { code: "23505", message: "duplicate key value violates unique constraint" };

    const res = await POST(makeRequest(), ctx());
    const text = await res.text();

    assert.equal(res.status, 503);
    assert.doesNotMatch(text, /duplicate key|23505|constraint/i);
  });

  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});
