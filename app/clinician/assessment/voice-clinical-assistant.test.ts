/**
 * Run: npx tsx --test app/clinician/assessment/voice-clinical-assistant.test.ts
 *
 * Proves the MyMemory removal from the live-session voice assistant.
 * translateArabicToEnglish / translateEnglishToArabic had no remaining
 * executable consumers once VoiceClinicalAssistant.tsx's translate buttons
 * and their imports were removed, so they were deleted rather than kept as
 * misleading always-null stubs. These tests confirm that deletion left no
 * dangling reference and no MyMemory string in the module, and that the
 * unrelated extraction/normalization helpers in the same file are unaffected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it } from "node:test";
import { normalizeTranscriptText, extractStructuredFields } from "./voice-clinical-assistant";

const SOURCE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "voice-clinical-assistant.ts");

describe("MyMemory-backed translation functions removed entirely", () => {
  it("no longer exports translateArabicToEnglish or translateEnglishToArabic", async () => {
    const mod = (await import("./voice-clinical-assistant")) as Record<string, unknown>;
    assert.equal("translateArabicToEnglish" in mod, false);
    assert.equal("translateEnglishToArabic" in mod, false);
  });

  it("source contains no executable mymemory/translated.net URL and no fetch() call at all", () => {
    // The file retains a documentation-only comment explaining that MyMemory
    // was removed (see the block above translateEnglishToArabic's deletion) —
    // that historical reference is expected and intentional, not a leak. What
    // must be zero is any executable network call: the specific host URLs,
    // and any remaining `fetch(` call in the module at all.
    const source = readFileSync(SOURCE_PATH, "utf8");
    assert.ok(!/api\.mymemory\.translated\.net/i.test(source));
    assert.ok(!/translated\.net\/get/i.test(source));
    assert.ok(!/\bfetch\(/.test(source));
  });

  it("importing the module issues no network request", async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called merely by importing the module");
    }) as typeof fetch;

    try {
      await import("./voice-clinical-assistant");
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalled, false);
  });
});

describe("unrelated clinical extraction helpers remain unaffected", () => {
  it("normalizeTranscriptText still collapses whitespace as before", () => {
    assert.equal(normalizeTranscriptText("  hello   world  "), "hello world");
  });

  it("extractStructuredFields still returns the expected shape for empty input", () => {
    assert.deepEqual(extractStructuredFields(""), {
      painLocation: "",
      severity: "",
      aggravating: "",
      relieving: "",
      functionalLimitation: "",
    });
  });

  it("extractStructuredFields still extracts from ordinary English text without throwing", () => {
    const result = extractStructuredFields("I have pain in my right shoulder when I lift my arm.");
    assert.equal(typeof result.painLocation, "string");
    assert.equal(typeof result.severity, "string");
    assert.equal(typeof result.aggravating, "string");
    assert.equal(typeof result.relieving, "string");
    assert.equal(typeof result.functionalLimitation, "string");
  });
});
