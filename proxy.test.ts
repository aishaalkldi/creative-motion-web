/**
 * Focused coverage for proxy.ts's public-route boundary — specifically the
 * fix that lets the anonymous post-stroke intake token route
 * (/post-stroke-intake/[token]) through without a clinician session, the
 * same way /assessment/[token] already works.
 *
 * Run: npx tsx --test proxy.test.ts
 *
 * No Supabase env vars are set here (plain tsx/node does not load .env.local
 * — see the same scope note in app/api/remote-assessments/__tests__/token-submit-route.test.ts),
 * so proxy()'s Supabase session block never runs; authentication in these
 * tests is driven entirely and deterministically by the legacy cm_token
 * cookie, with no network call and no dependency on whatever Supabase
 * project .env.local currently points at.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { isPublic, proxy } from "./proxy";

describe("isPublic — route boundary matching", () => {
  it("treats the new post-stroke intake token route as public", () => {
    assert.equal(isPublic("/post-stroke-intake/example-token"), true);
  });

  it("preserves the existing assessment token route as public", () => {
    assert.equal(isPublic("/assessment/example-token"), true);
  });

  it("does not sweep in an unrelated look-alike path", () => {
    assert.equal(isPublic("/post-stroke-intake-private"), false);
  });

  it("keeps clinician and admin routes protected", () => {
    assert.equal(isPublic("/clinician/dashboard"), false);
    assert.equal(isPublic("/clinician/patients"), false);
    assert.equal(isPublic("/admin"), false);
  });

  it("keeps other protected API routes protected", () => {
    assert.equal(isPublic("/api/patients"), false);
    assert.equal(isPublic("/api/assessments"), false);
  });

  it("leaves every pre-existing public prefix/path unchanged", () => {
    assert.equal(isPublic("/login"), true);
    assert.equal(isPublic("/signup"), true);
    assert.equal(isPublic("/api/remote-assessments/abc"), true);
    assert.equal(isPublic("/patient/xyz"), true);
    assert.equal(isPublic("/api/health/supabase"), true);
    assert.equal(isPublic("/"), true);
  });
});

describe("proxy() — request-level behavior", { concurrency: 1 }, () => {
  const savedEnv: Record<string, string | undefined> = {};

  before(() => {
    // Deterministic regardless of ambient .env.local — force the Supabase
    // session block off so only the legacy cm_token cookie drives `authed`.
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  function makeRequest(pathname: string, cookie?: string): NextRequest {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    return new NextRequest(`http://localhost${pathname}`, { headers });
  }

  it("allows the post-stroke intake token route through anonymously", async () => {
    const res = await proxy(makeRequest("/post-stroke-intake/example-token"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("location"), null);
  });

  it("preserves anonymous access to the existing assessment token route", async () => {
    const res = await proxy(makeRequest("/assessment/example-token"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("location"), null);
  });

  it("redirects an anonymous visitor away from a protected clinician page", async () => {
    const res = await proxy(makeRequest("/clinician/dashboard"));
    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login"));
    assert.ok(location?.includes("returnTo=%2Fclinician%2Fdashboard"));
  });

  it("returns 401 JSON, not a redirect, for a protected API route", async () => {
    const res = await proxy(makeRequest("/api/patients"));
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Unauthorized.");
  });

  it("does not treat an unrelated look-alike path as public — still redirects", async () => {
    const res = await proxy(makeRequest("/post-stroke-intake-private"));
    assert.equal(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login"));
  });

  it("keeps existing authenticated (cm_token) behavior unchanged — no redirect on a protected page", async () => {
    const res = await proxy(makeRequest("/clinician/dashboard", "cm_token=a-valid-looking-legacy-token-1234567890"));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("location"), null);
  });

  it("keeps existing unauthenticated 401 behavior unchanged for a protected API route", async () => {
    const res = await proxy(makeRequest("/api/assessments"));
    assert.equal(res.status, 401);
  });
});
