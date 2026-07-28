/**
 * Run: npx tsx --test hooks/useTranslationProgress.test.ts
 *
 * This repo has no React test renderer (no @testing-library/react, no
 * react-test-renderer, no jsdom) and adding one is out of scope for this
 * stage, so this hook's render-cycle behavior cannot be exercised directly.
 * Instead, these tests prove the two guarantees that matter for the
 * MyMemory-removal fix at the module level:
 *   1. The hook module no longer imports the deleted fallback module (if it
 *      did, this file's import below would throw at load time, since
 *      app/lib/clinical/arabic-clinical-translate-fallback.ts has been deleted).
 *   2. No reference to MyMemory, the deleted fallback, or any non-approved
 *      translation host remains in the hook's source, and merely loading the
 *      module issues no network request of any kind.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";

const SOURCE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "useTranslationProgress.ts");

describe("useTranslationProgress — MyMemory fallback removed", () => {
  it("imports without error now that the deleted fallback module has no remaining reference", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called merely by importing the module");
    }) as typeof fetch;

    try {
      const mod = await import("./useTranslationProgress");
      assert.equal(typeof mod.useTranslationProgress, "function");
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalled, false);
  });

  it("source contains no reference to the deleted MyMemory fallback module", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    assert.ok(!source.includes("arabic-clinical-translate-fallback"));
    assert.ok(!source.includes("translateArabicToEnglishClinical"));
  });

  it("source contains no mymemory or translated.net host reference", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    assert.ok(!/mymemory/i.test(source));
    assert.ok(!/translated\.net/i.test(source));
  });

  it("source's only network call target is the approved internal translate route", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    const fetchCalls = [...source.matchAll(/fetch\(\s*`([^`]*)`/g)].map((m) => m[1]);
    assert.ok(fetchCalls.length > 0, "expected at least one fetch call in the hook");
    for (const url of fetchCalls) {
      assert.match(url, /^\/api\/assessments\//);
    }
  });

  it("the catch branch sets state to 'failed' and contains no fallback call (source-level check)", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    const catchBlockMatch = source.match(/\} catch \{([\s\S]*?)\n {6}\}/);
    assert.ok(catchBlockMatch, "expected a catch block in translateField");
    const catchBody = catchBlockMatch![1];
    assert.match(catchBody, /'failed'/);
    assert.ok(!/translateArabicToEnglishClinical/.test(catchBody));
  });
});
