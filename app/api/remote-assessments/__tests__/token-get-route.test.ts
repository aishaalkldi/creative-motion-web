/**
 * Run: npx tsx --test app/api/remote-assessments/__tests__/token-get-route.test.ts
 *
 * Lives outside the [token] directory because Node's test runner treats
 * "[token]" in a CLI file-path argument as a glob character class, not a
 * literal path segment — it silently matches zero files when passed
 * directly. Import specifiers are not glob-parsed, so importing the route
 * from its real location works fine.
 *
 * Scope note: this route always reaches a real `.from(...)` DB query once
 * adminClient() succeeds — there's no pre-DB validation step for GET as
 * there is for submit — so unlike token-submit-route.test.ts, this suite
 * deliberately never installs even fake Supabase credentials. It only
 * covers branches that return before the Supabase client is ever queried:
 *   - missing/empty token (returns before adminClient() is even called)
 *   - Supabase not configured (adminClient() returns null without a call)
 * 429/rate-limit behavior for this route's bucket is covered at the shared
 * helper level in app/lib/rate-limit.test.ts, since a route-level 429 test
 * here would require enough "allowed" calls to reach the real DB query
 * first. The not-found/expired/success branches require a live or mocked
 * database and are intentionally out of scope for this PR.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../[token]/route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/remote-assessments/x", {
    headers: { "x-forwarded-for": `10.1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` },
  });
}

describe("GET /api/remote-assessments/[token]", () => {
  it("returns 404 for an empty token", async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: "" }) });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
  });

  it("returns 404 for a whitespace-only token", async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ token: "   " }) });
    assert.equal(res.status, 404);
  });

  it("returns 503 when Supabase is not configured", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const res = await GET(makeRequest(), {
        params: Promise.resolve({ token: crypto.randomUUID() }),
      });
      assert.equal(res.status, 503);
    } finally {
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });
});
