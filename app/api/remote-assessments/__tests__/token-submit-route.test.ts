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
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../[token]/submit/route";
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
