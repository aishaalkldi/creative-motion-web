/**
 * Run: npx tsx --experimental-test-module-mocks --test app/api/remote-assessments/__tests__/token-translate-route.test.ts
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const REMOTE_REQUEST = { id: "req-11111111-1111-1111-1111-111111111111", status: "pending" };

type TranslateResult =
  | { ok: true; translation: string }
  | { ok: false; code: "invalid_key" | "quota_or_billing" | "rate_limit" | "provider_error" | "no_content" };

let translateResult: TranslateResult = {
  ok: true,
  translation: "Pain in the right shoulder when lifting the arm.",
};
let remoteRequestData: typeof REMOTE_REQUEST | null = REMOTE_REQUEST;
let capturedTranslateArgs: { apiKey: string; text: string } | null = null;

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
    `http://localhost/api/remote-assessments/${encodeURIComponent(token)}/translate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip ?? `10.4.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: JSON.stringify(body),
    },
  );
}

function resetState() {
  remoteRequestData = REMOTE_REQUEST;
  translateResult = { ok: true, translation: "Pain in the right shoulder when lifting the arm." };
  capturedTranslateArgs = null;
}

mock.module("@/app/lib/openai/server-env", {
  namedExports: {
    getOpenAiKeyConfig: () => ({ ok: true, apiKey: "sk-test-key" }),
  },
});

mock.module("@/app/lib/ai/translate-clinical-text", {
  namedExports: {
    translateClinicalText: async (apiKey: string, text: string) => {
      capturedTranslateArgs = { apiKey, text };
      return translateResult;
    },
  },
});

describe("POST /api/remote-assessments/[token]/translate", { concurrency: 1 }, () => {
  let POST: typeof import("../[token]/translate/route").POST;
  let setServiceRoleClient: typeof import("../[token]/translate/route").__setServiceRoleClientForTests;

  before(async () => {
    resetState();
    ({ POST, __setServiceRoleClientForTests: setServiceRoleClient } = await import(
      "../[token]/translate/route"
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

  it("succeeds for a valid pending token and preserves the original Arabic text unchanged", async () => {
    resetState();
    const arabic = "عندي ألم في الكتف الأيمن لما أرفع يدي.";
    const token = crypto.randomUUID();

    const res = await POST(makeRequest(token, { text: arabic }), {
      params: Promise.resolve({ token }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { original_transcript: string; translation: string };
    assert.equal(body.original_transcript, arabic);
    assert.equal(body.translation, "Pain in the right shoulder when lifting the arm.");
    assert.equal(capturedTranslateArgs?.text, arabic);
  });

  it("rejects an invalid (nonexistent) token safely, without a distinguishing error", async () => {
    resetState();
    remoteRequestData = null;
    const token = crypto.randomUUID();

    const res = await POST(makeRequest(token, { text: "نص" }), {
      params: Promise.resolve({ token }),
    });

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
  });

  it("rejects an expired token the same safe way as an invalid one", async () => {
    // The DB query filters on expires_at > now(); an expired row simply
    // never matches, so it surfaces as the same "no row" result as an
    // invalid token — this is intentional (no token-enumeration signal).
    resetState();
    remoteRequestData = null;
    const token = crypto.randomUUID();

    const res = await POST(makeRequest(token, { text: "نص" }), {
      params: Promise.resolve({ token }),
    });

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
  });

  it("rejects missing text with a 400", async () => {
    resetState();
    const token = crypto.randomUUID();
    const res = await POST(makeRequest(token, {}), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 400);
  });

  it("returns a safe generic error when translation fails, never the raw provider error", async () => {
    resetState();
    translateResult = { ok: false, code: "invalid_key" };
    const token = crypto.randomUUID();

    const res = await POST(makeRequest(token, { text: "نص عربي" }), {
      params: Promise.resolve({ token }),
    });

    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.doesNotMatch(body.error, /key|sk-|api/i);
  });

  it("applies rate limiting after repeated requests from the same token/IP", async () => {
    resetState();
    const token = crypto.randomUUID();
    const ip = "10.9.9.9";

    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      last = await POST(makeRequest(token, { text: "نص عربي" }, ip), {
        params: Promise.resolve({ token }),
      });
    }
    assert.equal(last?.status, 429);
  });
});
