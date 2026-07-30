/**
 * Run: npx tsx --test app/api/remote-assessments/__tests__/token-get-route.test.ts
 *
 * Lives outside the [token] directory because Node's test runner treats
 * "[token]" in a CLI file-path argument as a glob character class, not a
 * literal path segment — it silently matches zero files when passed
 * directly. Import specifiers are not glob-parsed, so importing the route
 * from its real location works fine.
 *
 * Scope note: the first describe block below only covers branches that
 * return before the Supabase client is ever queried (missing/empty token,
 * Supabase not configured) and deliberately never installs fake Supabase
 * credentials, as before. Stage 3 added a `__setServiceRoleClientForTests`
 * seam to this route (matching save-draft/submit) specifically to cover the
 * new resumable-draft DB round trip — see the second describe block.
 * 429/rate-limit behavior for this route's bucket is covered at the shared
 * helper level in app/lib/rate-limit.test.ts.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { __setServiceRoleClientForTests, GET } from "../[token]/route";

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

/**
 * Stage 3 resume support — full DB round trip using the fake in-memory
 * Supabase client (no real or fake network call), matching the pattern
 * already used by token-save-draft-route.test.ts and
 * token-submit-route.test.ts.
 */
describe("GET /api/remote-assessments/[token] — resumable draft", { concurrency: 1 }, () => {
  type FakeRequestRow = {
    assessment_type: string;
    included_sections: unknown;
    expires_at: string;
    assessment_id: string | null;
  };

  let requestRow: FakeRequestRow | null;
  let assessmentStructuredData: unknown;

  function resetState() {
    requestRow = {
      assessment_type: "post_stroke_intake",
      included_sections: [],
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      assessment_id: "assessment-1",
    };
    assessmentStructuredData = {
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["no_new_urgent_symptoms"], stopped: false, recordedAt: "2026-07-30T00:00:00.000Z", flags: ["clinician_review_required"] },
        functionalIntake: { moreAffectedSide: "left", recordedAt: "2026-07-30T00:00:00.000Z", flags: ["clinician_review_required"] },
      },
      assessmentLanguage: "en",
    };
  }

  function makeFakeClient() {
    return {
      from(table: string) {
        if (table === "remote_assessment_requests") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gt: () => ({
                    maybeSingle: async () => ({ data: requestRow, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "assessments") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { structured_data: assessmentStructuredData }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    };
  }

  function paramsFor(token: string) {
    return { params: Promise.resolve({ token }) };
  }

  beforeEach(() => {
    resetState();
    __setServiceRoleClientForTests(makeFakeClient() as never);
  });

  afterEach(() => {
    __setServiceRoleClientForTests(null);
  });

  it("returns the resumable draft for a linked post_stroke_intake assessment", async () => {
    const res = await GET(makeRequest(), paramsFor("tok"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      draft?: { respondent?: unknown; urgentGate?: unknown; functionalIntake?: unknown; assessmentLanguage?: string };
    };
    assert.deepEqual(body.draft?.respondent, { type: "patient" });
    assert.equal((body.draft?.urgentGate as { stopped: boolean }).stopped, false);
    assert.deepEqual(body.draft?.functionalIntake, { moreAffectedSide: "left" });
    assert.equal(body.draft?.assessmentLanguage, "en");
  });

  it("never exposes assessment_id, patient_id, or provider_id in the response", async () => {
    const res = await GET(makeRequest(), paramsFor("tok"));
    const serialized = JSON.stringify(await res.json());
    assert.doesNotMatch(serialized, /assessment_id|patient_id|provider_id|assessmentId/i);
  });

  it("omits draft entirely when there is no linked assessment yet", async () => {
    requestRow!.assessment_id = null;
    const res = await GET(makeRequest(), paramsFor("tok"));
    const body = (await res.json()) as { draft?: unknown };
    assert.equal(body.draft, undefined);
  });

  it("omits draft entirely for a non-post_stroke_intake request, even with a linked assessment", async () => {
    requestRow!.assessment_type = "remote_questionnaire";
    const res = await GET(makeRequest(), paramsFor("tok"));
    const body = (await res.json()) as { draft?: unknown };
    assert.equal(body.draft, undefined);
  });

  it("drops an invalid enum value from functionalIntake rather than failing the whole response", async () => {
    assessmentStructuredData = {
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["no_new_urgent_symptoms"], stopped: false },
        functionalIntake: { moreAffectedSide: "left", assistiveDevice: "not_a_real_device" },
      },
      assessmentLanguage: "en",
    };
    const res = await GET(makeRequest(), paramsFor("tok"));
    const body = (await res.json()) as { draft?: { functionalIntake?: Record<string, unknown> } };
    assert.equal(body.draft?.functionalIntake?.moreAffectedSide, "left");
    assert.equal(body.draft?.functionalIntake?.assistiveDevice, undefined);
  });
});
