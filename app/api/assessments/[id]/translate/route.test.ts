/**
 * Regression coverage for the clinician-authenticated translation route,
 * locking in behavior that must survive the Phase 1 extraction of
 * translateClinicalText() into a shared module.
 *
 * Run: node --experimental-test-module-mocks --test app/api/assessments/[id]/translate/route.test.ts
 * (or: npx tsx --experimental-test-module-mocks --test <this file>)
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type FakeUser = { id: string; email?: string } | null;
type FakePatient = { id: string; provider_id: string } | null;
type FakeAssessment = {
  id: string;
  patient_id: string;
  provider_id: string;
  structured_data: Record<string, unknown> | null;
} | null;
type TranslateOutcome =
  | { ok: true; translation: string }
  | { ok: false; code: "invalid_key" | "quota_or_billing" | "rate_limit" | "provider_error" | "no_content" };

let authUser: FakeUser = { id: "user-123", email: "provider@example.com" };
let authError: unknown = null;
let assessmentRow: FakeAssessment = {
  id: "assess-1",
  patient_id: "patient-1",
  provider_id: "user-123",
  structured_data: {},
};
let assessmentQueryError: { code?: string; message?: string } | null = null;
let patientRow: FakePatient = { id: "patient-1", provider_id: "user-123" };
let patientQueryError: { code?: string; message?: string } | null = null;
let translateOutcome: TranslateOutcome = { ok: true, translation: "Pain in the right shoulder when lifting the arm." };
let updateCalls: Array<{ patch: Record<string, unknown> }> = [];
let updateError: { code?: string; message?: string } | null = null;
let capturedTranslateArgs: { apiKey: string; text: string } | null = null;

function resetState() {
  authUser = { id: "user-123", email: "provider@example.com" };
  authError = null;
  assessmentRow = {
    id: "assess-1",
    patient_id: "patient-1",
    provider_id: "user-123",
    structured_data: {},
  };
  assessmentQueryError = null;
  patientRow = { id: "patient-1", provider_id: "user-123" };
  patientQueryError = null;
  translateOutcome = { ok: true, translation: "Pain in the right shoulder when lifting the arm." };
  updateCalls = [];
  updateError = null;
  capturedTranslateArgs = null;
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

// NOTE: only @supabase/ssr's createServerClient is mocked here — mock.module()
// does not reliably intercept @supabase/supabase-js's createClient in this
// tsx/Node setup (a CJS/ESM interop quirk, same class of issue as the
// "openai" package — see app/lib/ai/translate-clinical-text.ts's use of
// dependency injection for the same reason). We avoid it entirely by never
// setting SUPABASE_SERVICE_ROLE_KEY: buildClients() then falls back to
// `adminClient = sessionClient`, exactly as it does in production when no
// service key is configured, so one mocked client covers both auth and data.
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

mock.module("@/app/lib/ai/translate-clinical-text", {
  namedExports: {
    translateClinicalText: async (apiKey: string, text: string) => {
      capturedTranslateArgs = { apiKey, text };
      return translateOutcome;
    },
  },
});

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/assessments/assess-1/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/assessments/[id]/translate — regression after shared-function extraction", { concurrency: 1 }, () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};

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

  function ctx() {
    return { params: Promise.resolve({ id: "assess-1" }) };
  }

  it("requires clinician authentication — no session returns 401", async () => {
    resetState();
    authUser = null;
    authError = { message: "Auth session missing" };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Unauthorized");
  });

  it("validates patient/provider ownership — mismatched provider returns a safe 404, not the patient row", async () => {
    resetState();
    patientRow = null;
    patientQueryError = { code: "PGRST116", message: "no rows" };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, "AI_CONTEXT_INVALID");
    assert.doesNotMatch(body.error, /patient-1|user-123/);
  });

  it("returns the cached translation unchanged and never calls the model again", async () => {
    resetState();
    assessmentRow = {
      id: "assess-1",
      patient_id: "patient-1",
      provider_id: "user-123",
      structured_data: {
        "pain.chiefComplaint_en": "Pain in the shoulder.",
        "pain.chiefComplaint_en_generated_at": "2026-01-01T00:00:00.000Z",
      },
    };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 200);
    const body = (await res.json()) as { translation: string; generatedAt: string | null; cached: boolean };
    assert.deepEqual(body, {
      translation: "Pain in the shoulder.",
      generatedAt: "2026-01-01T00:00:00.000Z",
      cached: true,
    });
    assert.equal(capturedTranslateArgs, null, "translateClinicalText must not be called on a cache hit");
    assert.equal(updateCalls.length, 0, "no DB write should happen on a cache hit");
  });

  it("returns the exact existing response shape on a fresh translation", async () => {
    resetState();
    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["cached", "generatedAt", "translation"]);
    assert.equal(body.cached, false);
    assert.equal(body.translation, "Pain in the right shoulder when lifting the arm.");
    assert.equal(typeof body.generatedAt, "string");
  });

  it("writes the reviewed flag as false alongside a fresh translation, matching prior behavior", async () => {
    resetState();
    await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(updateCalls.length, 1);
    const structuredData = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(structuredData["pain.chiefComplaint_en"], "Pain in the right shoulder when lifting the arm.");
    assert.equal(structuredData["pain.chiefComplaint_en_reviewed"], false);
    assert.equal(typeof structuredData["pain.chiefComplaint_en_generated_at"], "string");
  });

  it("maps an invalid-key provider error to a safe 503 without leaking the raw error", async () => {
    resetState();
    translateOutcome = { ok: false, code: "invalid_key" };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, "AI_PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(body.error, /key|sk-|invalid_key/i);
  });

  it("maps a rate-limited provider error to a safe 429", async () => {
    resetState();
    translateOutcome = { ok: false, code: "rate_limit" };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 429);
    const body = (await res.json()) as { code: string };
    assert.equal(body.code, "AI_RATE_LIMITED");
  });

  it("maps a no-content model response to a safe 502", async () => {
    resetState();
    translateOutcome = { ok: false, code: "no_content" };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());

    assert.equal(res.status, 502);
    const body = (await res.json()) as { code: string };
    assert.equal(body.code, "AI_NO_CONTENT");
  });

  it("never exposes a raw provider error string in the response body", async () => {
    resetState();
    translateOutcome = { ok: false, code: "provider_error" };

    const res = await POST(makeRequest({ fieldKey: "pain.chiefComplaint", text: "الألم في الكتف" }), ctx());
    const text = await res.text();
    assert.doesNotMatch(text, /openai|traceback|stack|APIError/i);
  });

  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});
