/**
 * Run: npx tsx --test app/lib/reports/polish-pt-clinical-report.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conservativeDedupeLines,
  enrichPtClinicalReportForDisplay,
  filterDisplaySections,
} from "./polish-pt-clinical-report";
import { buildPtClinicalReportDraftFromSections, PT_REPORT_SECTION_SPECS } from "./pt-clinical-report-schema";
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

describe("enrichPtClinicalReportForDisplay", () => {
  it("backfills primary complaint from approved source when section B is empty", () => {
    const structuredData = {
      assessmentLanguage: "ar",
      chiefComplaint_en: "The patient reports weakness in the muscles of the right hand.",
      pain: { chiefComplaint: "عندي ضعف في عضلات اليد اليمنى" },
    };
    const bundle = buildStructuredClinicalSourceBundle({
      structuredData,
      draft: structuredData as { pain: { chiefComplaint: string } },
    });
    const emptyReport = buildPtClinicalReportDraftFromSections(
      PT_REPORT_SECTION_SPECS.map((spec) => ({
        id: spec.id,
        title: spec.title,
        paragraphs:
          spec.id === "presentation"
            ? ["The patient reports pain in the right shoulder and hand."]
            : [],
        bullets: [],
      })),
      { sourceLanguage: "ar", source: "clinical_english" },
    );

    const enriched = enrichPtClinicalReportForDisplay(emptyReport, bundle);
    const primary = enriched.sections.find((section) => section.id === "primary_complaint");
    assert.ok(primary);
    assert.match(primary!.paragraphs.join(" "), /weakness in the muscles of the right hand/i);
  });

  it("hides empty primary complaint when no approved source exists", () => {
    const bundle = buildStructuredClinicalSourceBundle({
      structuredData: { assessmentLanguage: "en" },
      draft: { pain: { painScore: "6" } },
    });
    const emptyReport = buildPtClinicalReportDraftFromSections(
      PT_REPORT_SECTION_SPECS.map((spec) => ({
        id: spec.id,
        title: spec.title,
        paragraphs: [],
        bullets: [],
      })),
      { sourceLanguage: "en", source: "patient_english" },
    );

    const enriched = enrichPtClinicalReportForDisplay(emptyReport, bundle);
    const visible = filterDisplaySections(enriched);
    assert.equal(visible.some((section) => section.id === "primary_complaint"), false);
  });
});
