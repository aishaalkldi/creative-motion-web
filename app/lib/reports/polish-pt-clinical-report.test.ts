/**
 * Run: npx tsx --test app/lib/reports/polish-pt-clinical-report.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conservativeDedupeLines } from "./polish-pt-clinical-report";
import { buildStructuredClinicalSourceBundle } from "./structured-clinical-source-bundle";
import type { ClinicalConcept } from "./questionnaire-clinical-field-registry";

const BUNDLE = buildStructuredClinicalSourceBundle({
  structuredData: {
    assessmentLanguage: "en",
    worseWith_en: "The patient reports pain when raising the arm.",
    limitations_en: "The patient reports difficulty raising the arm.",
    rom: { worseWith: "pain raising arm", limitations: "difficulty raising arm" },
  },
  draft: {
    rom: {
      worseWith: "pain raising arm",
      limitations: "difficulty raising arm",
    },
  },
});

describe("conservativeDedupeLines", () => {
  it("does not remove pain and difficulty statements that share movement language", () => {
    const seen = new Set<ClinicalConcept>();
    const result = conservativeDedupeLines(
      [
        "The patient reports pain when raising the arm.",
        "The patient reports difficulty raising the arm.",
      ],
      BUNDLE,
      seen,
    );
    assert.equal(result.length, 2);
  });
});
