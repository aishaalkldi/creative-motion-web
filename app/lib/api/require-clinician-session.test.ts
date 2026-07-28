/**
 * Focused tests for requireClinicianSession().
 *
 * Run: node --experimental-test-module-mocks --test app/lib/api/require-clinician-session.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";

type FakeUser = { id: string; email?: string } | null;

let authUser: FakeUser = null;
let cookieJar: Array<{ name: string; value: string }> = [];
const savedEnv: Record<string, string | undefined> = {};

function makeFakeSupabaseClient() {
  return {
    auth: {
      getUser: async () =>
        authUser
          ? { data: { user: authUser }, error: null }
          : { data: { user: null }, error: { message: "Auth session missing" } },
    },
  };
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      getAll: () => cookieJar,
      set: () => {},
    }),
  },
});

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient: () => makeFakeSupabaseClient(),
  },
});

let requireClinicianSession: typeof import("./require-clinician-session").requireClinicianSession;

before(async () => {
  savedEnv.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  savedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  ({ requireClinicianSession } = await import("./require-clinician-session"));
});

afterEach(() => {
  authUser = null;
  cookieJar = [];
});

describe("requireClinicianSession()", () => {
  it("returns 503 when Supabase env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await requireClinicianSession();
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.response.status, 503);
    const json = (await result.response.json()) as { error: string };
    assert.equal(json.error, "Service temporarily unavailable.");

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  });

  it('returns default 401 { error: "Unauthorized." } when no session', async () => {
    authUser = null;

    const result = await requireClinicianSession();
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.response.status, 401);
    const json = (await result.response.json()) as { error: string };
    assert.equal(json.error, "Unauthorized.");
  });

  it('returns overridden 401 { error: "Unauthorized" } when requested', async () => {
    authUser = null;

    const result = await requireClinicianSession({ unauthorizedMessage: "Unauthorized" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.response.status, 401);
    const json = (await result.response.json()) as { error: string };
    assert.equal(json.error, "Unauthorized");
  });

  it("returns authenticated user when session is valid", async () => {
    authUser = { id: "user-123", email: "provider@example.com" };
    cookieJar = [{ name: "sb-test-project-auth-token", value: "fake-session" }];

    const result = await requireClinicianSession();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.user.id, "user-123");
  });
});
