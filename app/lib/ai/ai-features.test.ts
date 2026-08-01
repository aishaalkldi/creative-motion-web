/**
 * Regression coverage for the NEXT_PUBLIC_ENABLE_AI_TRANSLATION client
 * bundling bug: AI_FEATURES.translation must be read via a literal, static
 * `process.env.NEXT_PUBLIC_...` expression, not a dynamic `process.env[name]`
 * lookup — Next.js can only inline NEXT_PUBLIC_* values into the client
 * bundle when the reference is statically analyzable at build time. A
 * dynamic lookup silently evaluates to `undefined` in the browser regardless
 * of the real .env.local value, which previously kept the flag permanently
 * "off" on the client no matter what was configured.
 *
 * Run: npx tsx --test app/lib/ai/ai-features.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const AI_FEATURES_SOURCE_PATH = path.join(DIR, "ai-features.ts");
const REVIEW_SOURCE_PATH = path.join(
  DIR,
  "..",
  "..",
  "components",
  "PatientSubmittedAnswersReview.tsx",
);

let importCounter = 0;

/** Sets the env var, imports a fresh copy of the module, then restores the env var. */
async function loadWithTranslationEnv(value: string | undefined) {
  const saved = process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION;
  if (value === undefined) delete process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION;
  else process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION = value;
  try {
    // Cache-busting query forces Node's ESM loader to re-evaluate the module
    // (and its top-level `process.env` reads) rather than serving the
    // already-cached instance from an earlier import in this same process.
    importCounter += 1;
    return await import(`./ai-features.ts?regression-check=${importCounter}`);
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION;
    else process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION = saved;
  }
}

describe("AI_FEATURES.translation — statically-accessed value", () => {
  it("is enabled when the value is exactly 'true'", async () => {
    const mod = await loadWithTranslationEnv("true");
    assert.equal(mod.AI_FEATURES.translation, true);
    assert.equal(mod.isAiTranslationEnabled(), true);
  });

  it("is disabled when the variable is missing", async () => {
    const mod = await loadWithTranslationEnv(undefined);
    assert.equal(mod.AI_FEATURES.translation, false);
    assert.equal(mod.isAiTranslationEnabled(), false);
  });

  it("is disabled for 'false', 'TRUE', '1', and any other non-exact value", async () => {
    for (const value of ["false", "TRUE", "1", "yes", "enabled", ""]) {
      const mod = await loadWithTranslationEnv(value);
      assert.equal(
        mod.AI_FEATURES.translation,
        false,
        `expected translation to be disabled for NEXT_PUBLIC_ENABLE_AI_TRANSLATION=${JSON.stringify(value)}`,
      );
    }
  });

  it("does not change the other AI feature flags' behavior", async () => {
    const mod = await loadWithTranslationEnv("true");
    assert.equal(mod.AI_FEATURES.voiceWhisper, false);
    assert.equal(mod.AI_FEATURES.clinicalSummary, false);
    assert.equal(mod.AI_FEATURES.soapDraft, false);
    assert.equal(mod.AI_FEATURES.coPilot, false);
  });

  it("keeps the existing setup notice text unchanged", async () => {
    const mod = await loadWithTranslationEnv(undefined);
    assert.equal(
      mod.AI_TRANSLATION_SETUP_NOTICE,
      "AI English translation is currently under setup. Original Arabic answers are available for clinician review.",
    );
  });
});

describe("ai-features.ts source uses only statically-inlinable env access", () => {
  it("never uses a dynamic process.env[name] bracket lookup", () => {
    const source = readFileSync(AI_FEATURES_SOURCE_PATH, "utf8");
    // Strip comments first — the fix's own doc comment mentions the old,
    // now-removed dynamic-access pattern as an explanation of the bug.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(codeOnly, /process\.env\[/);
  });

  it("reads each NEXT_PUBLIC client flag via a literal process.env.NEXT_PUBLIC_... expression", () => {
    const source = readFileSync(AI_FEATURES_SOURCE_PATH, "utf8");
    for (const name of [
      "NEXT_PUBLIC_ENABLE_AI_TRANSLATION",
      "NEXT_PUBLIC_ENABLE_AI_VOICE_WHISPER",
      "NEXT_PUBLIC_ENABLE_AI_CLINICAL_SUMMARY",
      "NEXT_PUBLIC_ENABLE_AI_SOAP_DRAFT",
      "NEXT_PUBLIC_ENABLE_AI_COPILOT",
    ]) {
      const pattern = new RegExp(`process\\.env\\.${name} === "true"`);
      assert.match(source, pattern, `expected a static, literal reference to ${name}`);
    }
  });

  it("has no side effects — pure constant flags, no fetch/PATCH/state mutation", () => {
    const source = readFileSync(AI_FEATURES_SOURCE_PATH, "utf8");
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /reviewed\s*[:=]\s*true/);
  });
});

describe("PatientSubmittedAnswersReview — setup notice and translation-control eligibility wiring", () => {
  // No React render harness exists in this repository (established
  // convention — see Stage 1's voice-clinical-assistant.test.ts). These are
  // source-level checks confirming the existing, untouched boolean wiring
  // that this fix now makes reachable in the browser for the first time.
  const source = readFileSync(REVIEW_SOURCE_PATH, "utf8");

  it("shows the setup notice only when translation is disabled, language is Arabic, and the report is not compact", () => {
    assert.match(
      source,
      /showSetupNotice\s*=\s*!aiTranslationEnabled\s*&&\s*assessmentLanguage === "ar"\s*&&\s*!compact/,
    );
  });

  it("makes per-field translation controls eligible only when translation is enabled", () => {
    assert.match(source, /useTranslation\s*=\s*\n\s*aiTranslationEnabled\s*&&/);
  });

  it("derives both from isAiTranslationEnabled() — the single fixed source of truth", () => {
    assert.match(source, /const aiTranslationEnabled = isAiTranslationEnabled\(\);/);
  });
});
