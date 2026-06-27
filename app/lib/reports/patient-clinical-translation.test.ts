/**
 * Run: npx tsx --test app/lib/reports/patient-clinical-translation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTranslationMeta,
  isTranslatablePatientFieldKey,
  readStoredClinicalTranslation,
} from "./patient-clinical-translation";

describe("isTranslatablePatientFieldKey", () => {
  it("excludes numeric pain score fields", () => {
    assert.equal(isTranslatablePatientFieldKey("painScore"), false);
    assert.equal(isTranslatablePatientFieldKey("painLocation"), true);
    assert.equal(isTranslatablePatientFieldKey(undefined), false);
  });
});

describe("readStoredClinicalTranslation", () => {
  it("reads stored English clinical translation from submission meta", () => {
    const translation = readStoredClinicalTranslation(
      {
        painLocation_en: "Pain in the right shoulder when lifting the arm.",
        painLocation_en_generated_at: "2026-06-22T10:00:00.000Z",
      },
      "painLocation",
    );
    assert.equal(translation, "Pain in the right shoulder when lifting the arm.");
  });

  it("returns empty string when translation is missing or field is not translatable", () => {
    assert.equal(readStoredClinicalTranslation({}, "painLocation"), "");
    assert.equal(readStoredClinicalTranslation({ painScore_en: "5" }, "painScore"), "");
  });
});

describe("extractTranslationMeta", () => {
  it("collects all stored field translations and timestamps", () => {
    const meta = extractTranslationMeta({
      painLocation_en: "Right shoulder pain",
      painLocation_en_generated_at: "2026-06-22T10:00:00.000Z",
      aggravating_en: "Overhead reach",
      aggravating_en_generated_at: "2026-06-22T10:00:01.000Z",
      painLocation_en_reviewed: true,
    });

    assert.deepEqual(meta.translations, {
      painLocation_en: "Right shoulder pain",
      aggravating_en: "Overhead reach",
    });
    assert.deepEqual(meta.generatedAt, {
      painLocation: "2026-06-22T10:00:00.000Z",
      aggravating: "2026-06-22T10:00:01.000Z",
    });
  });
});
