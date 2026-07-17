/**
 * Run: npx tsx --test app/api/clinician/ai-session-summary/__tests__/approve-route.test.ts
 *
 * Route-level 401 branches require Next.js request context (cookies()).
 * Unauthorized provider access is covered in clinician-summary-persistence.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../approve/route";

describe("POST /api/clinician/ai-session-summary/approve", () => {
  it("returns 503 when Supabase is not configured", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      const req = new NextRequest("http://localhost/api/clinician/ai-session-summary/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryId: "abc-123" }),
      });
      const res = await POST(req);
      assert.equal(res.status, 503);
    } finally {
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    }
  });
});
