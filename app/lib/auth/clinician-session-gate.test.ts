/**
 * Focused tests for clinician layout session gate helpers.
 *
 * Run: npx tsx --test app/lib/auth/clinician-session-gate.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClinicianLoginRedirect,
  mapProviderSessionToDisplay,
  performClinicianLogout,
  probeClinicianSession,
  resolveClinicianAuthGate,
  sanitizeClinicianReturnTo,
} from "./clinician-session-gate";

describe("sanitizeClinicianReturnTo()", () => {
  it("allows internal clinician paths", () => {
    assert.equal(sanitizeClinicianReturnTo("/clinician"), "/clinician");
    assert.equal(sanitizeClinicianReturnTo("/clinician/patients"), "/clinician/patients");
    assert.equal(
      sanitizeClinicianReturnTo("/clinician/assessment?id=123"),
      "/clinician/assessment?id=123",
    );
  });

  it("rejects external and unsafe paths with clinician default", () => {
    assert.equal(sanitizeClinicianReturnTo("https://evil.example"), "/clinician");
    assert.equal(sanitizeClinicianReturnTo("//evil.example"), "/clinician");
    assert.equal(sanitizeClinicianReturnTo("javascript:alert(1)"), "/clinician");
    assert.equal(sanitizeClinicianReturnTo("/admin"), "/clinician");
    assert.equal(sanitizeClinicianReturnTo("/"), "/clinician");
    assert.equal(sanitizeClinicianReturnTo(""), "/clinician");
    assert.equal(sanitizeClinicianReturnTo("   "), "/clinician");
  });

  it("buildClinicianLoginRedirect always encodes an internal clinician path", () => {
    assert.equal(
      buildClinicianLoginRedirect("https://evil.example"),
      "/login?returnTo=%2Fclinician",
    );
    assert.equal(
      buildClinicianLoginRedirect("/clinician/patients"),
      "/login?returnTo=%2Fclinician%2Fpatients",
    );
    assert.equal(
      buildClinicianLoginRedirect("/clinician/assessment?id=123"),
      "/login?returnTo=%2Fclinician%2Fassessment%3Fid%3D123",
    );
  });
});

describe("clinician session gate", () => {
  it("5. missing layout session redirects to login with internal returnTo only", () => {
    const gate = resolveClinicianAuthGate({
      session: null,
      devBypassActive: false,
      nodeEnv: "production",
    });
    assert.equal(gate, "unauthenticated");
  });

  it("6. valid session renders Supabase provider identity", () => {
    const display = mapProviderSessionToDisplay({
      user: { id: "user-1", email: "provider@example.com" },
      profile: {
        id: "user-1",
        name: "Dr. Aisha Provider",
        clinic_name: "RASQ Clinic",
        email: "provider@example.com",
        role: "provider",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    });

    assert.ok(display);
    assert.equal(display.fullName, "Dr. Aisha Provider");
    assert.equal(display.email, "provider@example.com");
    assert.equal(display.initials, "DA");
  });

  it("7. profile-null session falls back safely to email", () => {
    const display = mapProviderSessionToDisplay({
      user: { id: "user-2", email: "fallback@example.com" },
      profile: null,
    });

    assert.ok(display);
    assert.equal(display.fullName, "fallback@example.com");
    assert.equal(display.email, "fallback@example.com");
    assert.equal(display.initials, "F");
  });

  it("8. dev bypass works only in development", () => {
    assert.equal(
      resolveClinicianAuthGate({
        session: null,
        devBypassActive: true,
        nodeEnv: "development",
      }),
      "authenticated",
    );

    assert.equal(
      resolveClinicianAuthGate({
        session: null,
        devBypassActive: true,
        nodeEnv: "production",
      }),
      "unauthenticated",
    );
  });

  it("probeClinicianSession failure resolves to unauthenticated", async () => {
    const probe = await probeClinicianSession({
      getProviderSession: async () => {
        throw new Error("network down");
      },
      devBypassActive: false,
      nodeEnv: "production",
    });

    assert.equal(probe.status, "unauthenticated");
  });

  it("9. logout calls supabaseSignOut and clearAuthSession", async () => {
    let signOutCalled = false;
    let clearCalled = false;
    let loginNavigated = false;
    let refreshed = false;

    await performClinicianLogout({
      supabaseSignOut: async () => {
        signOutCalled = true;
      },
      clearAuthSession: () => {
        clearCalled = true;
      },
      navigateToLogin: () => {
        loginNavigated = true;
      },
      refresh: () => {
        refreshed = true;
      },
    });

    assert.equal(signOutCalled, true);
    assert.equal(clearCalled, true);
    assert.equal(loginNavigated, true);
    assert.equal(refreshed, true);
  });

  it("logout still clears legacy state when supabaseSignOut fails", async () => {
    let clearCalled = false;
    let loginNavigated = false;

    await performClinicianLogout({
      supabaseSignOut: async () => {
        throw new Error("sign-out failed");
      },
      clearAuthSession: () => {
        clearCalled = true;
      },
      navigateToLogin: () => {
        loginNavigated = true;
      },
      refresh: () => {},
    });

    assert.equal(clearCalled, true);
    assert.equal(loginNavigated, true);
  });
});
