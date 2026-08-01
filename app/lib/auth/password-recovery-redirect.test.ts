/**
 * Run: npx tsx --test app/lib/auth/password-recovery-redirect.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildPasswordRecoveryRedirectTo } from "./password-recovery-redirect";

const RESET_PASSWORD_SOURCE = readFileSync("app/(auth)/reset-password/page.tsx", "utf8");

describe("buildPasswordRecoveryRedirectTo()", () => {
  it("routes recovery through the auth callback with update-password as next", () => {
    assert.equal(
      buildPasswordRecoveryRedirectTo("https://example.test"),
      "https://example.test/api/auth/callback?next=/update-password",
    );
  });

  it("does not send users directly to /update-password", () => {
    const redirectTo = buildPasswordRecoveryRedirectTo("https://example.test");
    assert.notEqual(redirectTo, "https://example.test/update-password");
    assert.match(redirectTo, /\/api\/auth\/callback\?next=\/update-password$/);
  });
});

describe("reset-password page wiring", () => {
  it("uses buildPasswordRecoveryRedirectTo for resetPasswordForEmail redirectTo", () => {
    assert.match(RESET_PASSWORD_SOURCE, /buildPasswordRecoveryRedirectTo\(/);
    assert.match(
      RESET_PASSWORD_SOURCE,
      /redirectTo:\s*buildPasswordRecoveryRedirectTo\(window\.location\.origin\)/,
    );
    assert.doesNotMatch(
      RESET_PASSWORD_SOURCE,
      /redirectTo:\s*`\$\{window\.location\.origin\}\/update-password`/,
    );
  });
});
