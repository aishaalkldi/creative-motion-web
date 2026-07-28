/**
 * Source-level integration wiring checks for PR B login/layout changes.
 * Component rendering tests are not used — the repo has no React test runner.
 *
 * Run: npx tsx --test app/lib/auth/pr-b-integration-wiring.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const LOGIN_SOURCE = readFileSync("app/login/page.tsx", "utf8");
const LAYOUT_SOURCE = readFileSync("app/clinician/layout.tsx", "utf8");

describe("PR B integration wiring audit", () => {
  it("login page uses Supabase-only attemptSupabaseLogin()", () => {
    assert.match(LOGIN_SOURCE, /attemptSupabaseLogin\(/);
    assert.doesNotMatch(LOGIN_SOURCE, /loginClinician/);
    assert.match(LOGIN_SOURCE, /sanitizeClinicianReturnTo/);
    assert.match(LOGIN_SOURCE, /ensureProviderProfile/);
    assert.match(LOGIN_SOURCE, /href="\/reset-password"/);
    assert.match(LOGIN_SOURCE, /href="\/signup"/);
  });

  it("clinician layout probes Supabase session and gates rendering", () => {
    assert.match(LAYOUT_SOURCE, /probeClinicianSession\(/);
    assert.match(LAYOUT_SOURCE, /getProviderSession/);
    assert.doesNotMatch(LAYOUT_SOURCE, /getClinician/);
    assert.match(LAYOUT_SOURCE, /authStatus === "loading"/);
    assert.match(LAYOUT_SOURCE, /router\.replace\(buildClinicianLoginRedirect/);
    assert.match(LAYOUT_SOURCE, /performClinicianLogout\(/);
    assert.match(LAYOUT_SOURCE, /clearAuthSession/);
  });
});
