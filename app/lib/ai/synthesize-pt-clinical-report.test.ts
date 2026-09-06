/**
 * Run: npx tsx --test app/lib/ai/synthesize-pt-clinical-report.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  synthesizePtClinicalReport,
  validateAndNormalizePtReportSections,
} from "./synthesize-pt-clinical-report";
import { PT_REPORT_SECTION_SPECS } from "@/app/lib/reports/pt-clinical-report-schema";
import { buildStructuredClinicalSourceBundle } from "@/app/lib/reports/structured-clinical-source-bundle";

const BUNDLE = buildStructuredClinicalSourceBundle({
  structuredData: {
    assessmentLanguage: "ar",
    clinical_translation_status: "approved",
    chiefComplaint_en: "The patient reports shoulder pain when reaching overhead",
    painLocation_en: "The patient reports right shoulder pain",
    aggravating_en: "The patient reports overhead reaching aggravates symptoms",
    easing_en: "The patient reports rest eases symptoms",
    dailyImpact_en: "The patient reports difficulty combing hair",
    goals_en: "The patient reports a goal to return to work without shoulder pain",
    pain: {
      chiefComplaint: "ألم",
      painLocation: "الكتف",
      painScore: "5",
      aggravating: "رفع",
      easing: "راحة",
      dailyImpact: "تأثير",
      goals: "هدف",
    },
  },
  draft: {
    pain: {
      chiefComplaint: "ألم",
      painLocation: "الكتف",
      painScore: "5",
      aggravating: "رفع",
      easing: "راحة",
      dailyImpact: "تأثير",
      goals: "هدف",
    },
  },
});

function mockSections() {
  return PT_REPORT_SECTION_SPECS.map((spec) => ({
    id: spec.id,
    paragraphs: [`Patient-reported content for ${spec.id}`],
    bullets: spec.id === "suggested_objective" ? ["Consider assessing shoulder movement and movement quality"] : [],
  }));
}

describe("synthesizePtClinicalReport", () => {
  it("parses valid AI JSON into A–J sections", async () => {
    const result = await synthesizePtClinicalReport(
      "sk-test",
      BUNDLE,
      async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ sections: mockSections() }),
            },
          },
        ],
      }),
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.report.sections.length, PT_REPORT_SECTION_SPECS.length);
    assert.equal(result.report.generationMethod, "ai");
    assert.match(result.report.disclaimer, /not a diagnosis/i);
  });

  it("rejects output with forbidden terms", async () => {
    const sections = mockSections();
    sections[6] = {
      id: "pt_interpretation",
      paragraphs: ["This suggests rotator cuff tear"],
      bullets: [],
    };

    const result = await synthesizePtClinicalReport(
      "sk-test",
      BUNDLE,
      async () => ({
        choices: [{ message: { content: JSON.stringify({ sections }) } }],
      }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "forbidden_terms");
  });

  it("rejects incomplete section sets", () => {
    const sections = validateAndNormalizePtReportSections([
      { id: "presentation", paragraphs: ["Only one section"], bullets: [] },
    ]);
    assert.equal(sections, null);
  });
});
