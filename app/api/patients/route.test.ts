/**
 * Focused auth-gate tests for POST /api/patients.
 *
 * Mocks next/headers, @supabase/ssr, and @supabase/supabase-js so the route's
 * auth check (sessionClient.auth.getUser()) can be driven directly, without a
 * live Supabase project or a real login.
 *
 * Run: node --experimental-test-module-mocks --test app/api/patients/route.test.ts
 */
import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type FakeUser = { id: string; email?: string } | null;

let cookieJar: Array<{ name: string; value: string }> = [];
let authUser: FakeUser = null;

function makeQueryBuilder() {
  let mode: "select" | "insert" = "select";
  const lookupResult = { data: [] as unknown[], error: null };
  const insertResult = {
    data: {
      id: "patient-1",
      full_name: "Test Patient",
      phone: "0000000000",
      file_number: "P-0001",
      provider_id: authUser?.id ?? "user-123",
      status: "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    error: null,
  };

  const builder = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    order: () => builder,
    insert: () => {
      mode = "insert";
      return builder;
    },
    single: () => Promise.resolve(mode === "insert" ? insertResult : lookupResult),
    then: (
      resolve: (value: typeof lookupResult) => void,
      reject: (reason: unknown) => void,
    ) => Promise.resolve(lookupResult).then(resolve, reject),
  };
  return builder;
}

function makeFakeSupabaseClient() {
  return {
    auth: {
      getUser: async () =>
        authUser
          ? { data: { user: authUser }, error: null }
          : { data: { user: null }, error: { message: "Auth session missing" } },
    },
    from: () => makeQueryBuilder(),
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

mock.module("@supabase/supabase-js", {
  namedExports: {
    createClient: () => makeFakeSupabaseClient(),
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

let POST: (req: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST } = await import("./route.ts"));
});

function makeCreateRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/patients — auth gate", () => {
  it("returns 401 when no Supabase session is present", async () => {
    authUser = null;
    cookieJar = [];

    const res = await POST(makeCreateRequest({ full_name: "Jane Doe", phone: "0000000000" }));

    assert.equal(res.status, 401);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "Unauthorized.");
  });

  it("passes the auth check for an authenticated Supabase user", async () => {
    authUser = { id: "user-123", email: "provider@example.com" };
    cookieJar = [{ name: "sb-test-project-auth-token", value: "fake-session" }];

    const res = await POST(makeCreateRequest({ full_name: "Jane Doe", phone: "0000000000" }));

    assert.notEqual(res.status, 401);
    assert.equal(res.status, 201);
  });
});
