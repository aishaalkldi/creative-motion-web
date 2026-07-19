/**
 * Run: npx tsx --experimental-test-module-mocks --test app/api/remote-assessments/__tests__/token-extract-route.test.ts
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const REMOTE_REQUEST = { id: "req-11111111-1111-1111-1111-111111111111", status: "pending" };

type Extraction = {
  body_region: string;
  side: string;
  primary_symptom: string;
  aggravating_factor: string | null;
  language: string;
  confidence: number;
};

type ExtractResult =
  | { ok: true; extraction: Extraction }
  | { ok: false; code: "invalid_key" | "quota_or_billing" | "rate_limit" | "provider_error" | "no_content" | "invalid_output" };

const SHOULDER_EXTRACTION: Extraction = {
  body_region: "shoulder",
  side: "right",
  primary_symptom: "pain",
  aggravating_factor: "overhead arm elevation",
  language: "ar",
  confidence: 0.9,
};

let extractResult: ExtractResult = { ok: true, extraction: SHOULDER_EXTRACTION };
let remoteRequestData: typeof REMOTE_REQUEST | null = REMOTE_REQUEST;
let capturedArgs: { apiKey: string; text: string; language: string } | null = null;

function createRouteSupabaseMock() {
  const client = {
    from: (table: string) => {
      if (table === "remote_assessment_requests") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: async () => ({ data: remoteRequestData, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
  return client;
}

function makeRequest(token: string, body: unknown, ip?: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/remote-assessments/${encodeURIComponent(token)}/extract`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip ?? `10.5.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: JSON.stringify(body),
    },
  );
}

function resetState() {
  remoteRequestData = REMOTE_REQUEST;
  extractResult = { ok: true, extraction: SHOULDER_EXTRACTION };
  capturedArgs = null;
}

mock.module("@/app/lib/openai/server-env", {
  namedExports: {
    getOpenAiKeyConfig: () => ({ ok: true, apiKey: "sk-test-key" }),
  },
});

mock.module("@/app/lib/ai/extract-clinical-fields", {
  namedExports: {
    extractStructuredClinicalFields: async (apiKey: string, text: string, language: string) => {
      capturedArgs = { apiKey, text, language };
      return extractResult;
    },
  },
});

describe("POST /api/remote-assessments/[token]/extract", { concurrency: 1 }, () => {
  let POST: typeof import("../[token]/extract/route").POST;
  let setServiceRoleClient: typeof import("../[token]/extract/route").__setServiceRoleClientForTests;

  before(async () => {
    resetState();
    ({ POST, __setServiceRoleClientForTests: setServiceRoleClient } = await import(
      "../[token]/extract/route"
    ));
    setServiceRoleClient(createRouteSupabaseMock());
  });

  after(() => {
    setServiceRoleClient(null);
    mock.restoreAll();
  });

  it("returns 404 for an empty token", async () => {
    const res = await POST(makeRequest("", { text: "نص" }), { params: Promise.resolve({ token: "" }) });
    assert.equal(res.status, 404);
  });

  it("returns the acceptance-example structured extraction and preserves the original Arabic text", async () => {
    resetState();
    const arabic = "عندي ألم في الكتف الأيمن لما أرفع يدي.";
    const token = crypto.randomUUID();

    const res = await POST(makeRequest(token, { text: arabic, language: "ar" }), {
      params: Promise.resolve({ token }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { original_transcript: string; extraction: Extraction };
    assert.equal(body.original_transcript, arabic);
    assert.deepEqual(body.extraction, {
      body_region: "shoulder",
      side: "right",
      primary_symptom: "pain",
      aggravating_factor: "overhead arm elevation",
      language: "ar",
      confidence: 0.9,
    });
    assert.equal(capturedArgs?.text, arabic);
    assert.equal(capturedArgs?.language, "ar");
  });

  it("returns exactly the six whitelisted fields — no diagnosis or unsupported clinical conclusion", async () => {
    resetState();
    const token = crypto.randomUUID();
    const res = await POST(makeRequest(token, { text: "نص عربي" }), {
      params: Promise.resolve({ token }),
    });
    const body = (await res.json()) as { extraction: Record<string, unknown> };
    assert.deepEqual(Object.keys(body.extraction).sort(), [
      "aggravating_factor",
      "body_region",
      "confidence",
      "language",
      "primary_symptom",
      "side",
    ]);
    assert.equal("diagnosis" in body.extraction, false);
    assert.equal("treatment_recommendation" in body.extraction, false);
    assert.equal("clinical_impression" in body.extraction, false);
  });

  it("defaults language to Arabic when not specified", async () => {
    resetState();
    const token = crypto.randomUUID();
    await POST(makeRequest(token, { text: "نص عربي" }), { params: Promise.resolve({ token }) });
    assert.equal(capturedArgs?.language, "ar");
  });

  it("rejects an invalid (nonexistent) token safely", async () => {
    resetState();
    remoteRequestData = null;
    const token = crypto.randomUUID();
    const res = await POST(makeRequest(token, { text: "نص" }), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
  });

  it("rejects an expired token the same safe way as an invalid one", async () => {
    resetState();
    remoteRequestData = null;
    const token = crypto.randomUUID();
    const res = await POST(makeRequest(token, { text: "نص" }), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
  });

  it("safely handles malformed/unparseable AI output without leaking provider details", async () => {
    resetState();
    extractResult = { ok: false, code: "invalid_output" };
    const token = crypto.randomUUID();

    const res = await POST(makeRequest(token, { text: "نص عربي" }), {
      params: Promise.resolve({ token }),
    });

    assert.equal(res.status, 502);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Structured extraction is temporarily unavailable.");
    assert.doesNotMatch(body.error, /json|parse|openai/i);
  });

  it("rejects missing text with a 400", async () => {
    resetState();
    const token = crypto.randomUUID();
    const res = await POST(makeRequest(token, {}), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 400);
  });

  it("applies rate limiting after repeated requests from the same token/IP", async () => {
    resetState();
    const token = crypto.randomUUID();
    const ip = "10.9.9.10";

    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      last = await POST(makeRequest(token, { text: "نص عربي" }, ip), {
        params: Promise.resolve({ token }),
      });
    }
    assert.equal(last?.status, 429);
  });
});
