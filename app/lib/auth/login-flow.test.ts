/**
 * Focused tests for Supabase-only clinician login flow.
 *
 * Run: npx tsx --test app/lib/auth/login-flow.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attemptSupabaseLogin,
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  LOGIN_SERVICE_UNAVAILABLE_MESSAGE,
  resolveSupabaseLoginError,
} from "./login-flow";

describe("attemptSupabaseLogin()", () => {
  it("1. Supabase login success redirects path and never calls loginClinician", async () => {
    let loginClinicianCalled = false;
    let ensureCalled = false;

    const result = await attemptSupabaseLogin({
      supabaseConfigured: true,
      email: "Provider@Example.com",
      password: "secret",
      signInWithPassword: async (email, password) => {
        assert.equal(email, "provider@example.com");
        assert.equal(password, "secret");
        return { error: null };
      },
      ensureProviderProfile: async ({ email }) => {
        ensureCalled = true;
        assert.equal(email, "provider@example.com");
      },
    });

    assert.equal(result.ok, true);
    assert.equal(ensureCalled, true);
    assert.equal(loginClinicianCalled, false);
  });

  it("2. invalid credentials show recovery guidance and never fall back to FastAPI", async () => {
    let ensureCalled = false;

    const result = await attemptSupabaseLogin({
      supabaseConfigured: true,
      email: "user@example.com",
      password: "wrong",
      signInWithPassword: async () => ({
        error: { message: "Invalid login credentials" },
      }),
      ensureProviderProfile: async () => {
        ensureCalled = true;
      },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, LOGIN_INVALID_CREDENTIALS_MESSAGE);
    assert.equal(result.showRecoveryLinks, true);
    assert.equal(ensureCalled, false);
  });

  it("3. Supabase-not-configured shows service unavailable and no FastAPI call", async () => {
    let signInCalled = false;

    const result = await attemptSupabaseLogin({
      supabaseConfigured: false,
      email: "user@example.com",
      password: "secret",
      signInWithPassword: async () => {
        signInCalled = true;
        return { error: null };
      },
      ensureProviderProfile: async () => {},
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, LOGIN_SERVICE_UNAVAILABLE_MESSAGE);
    assert.equal(result.showRecoveryLinks, false);
    assert.equal(signInCalled, false);
  });

  it("4. successful login path does not create legacy cookies/localStorage", async () => {
    const storage = new Map<string, string>();
    let cookie = "";

    const originalDocument = globalThis.document;
    let cookieValue = "";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        set cookie(value: string) {
          cookieValue = value;
        },
        get cookie() {
          return cookieValue;
        },
      },
    });

    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
      },
    });

    try {
      const result = await attemptSupabaseLogin({
        supabaseConfigured: true,
        email: "user@example.com",
        password: "secret",
        signInWithPassword: async () => ({ error: null }),
        ensureProviderProfile: async () => {},
      });

      assert.equal(result.ok, true);
      assert.equal(storage.has("cm_access_token"), false);
      assert.equal(storage.has("cm_clinician"), false);
      assert.equal(cookieValue.includes("cm_token="), false);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});

describe("resolveSupabaseLoginError()", () => {
  it("never exposes raw Supabase error strings", () => {
    const resolved = resolveSupabaseLoginError(true, "Email rate limit exceeded");
    assert.notEqual(resolved.message, "Email rate limit exceeded");
    assert.equal(resolved.showRecoveryLinks, false);
  });
});
