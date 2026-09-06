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

const APPROVED_PAYLOAD = {
  sourceLanguage: "ar" as const,
  painScore: "6",
  hasRedFlag: false,
  fields: [
    {
      fieldKey: "chiefComplaint",
      label: "Main complaint",
      section: "Pain & Symptoms",
      clinicalEnglish: "The patient reports shoulder pain when reaching overhead",
    },
  ],
};

function mockSections() {
  return PT_REPORT_SECTION_SPECS.map((spec) => ({
    id: spec.id,
    paragraphs: [`Patient-reported content for ${spec.id}`],
    bullets: spec.id === "suggested_objective" ? ["Consider assessing active shoulder movement"] : [],
  }));
}

describe("synthesizePtClinicalReport", () => {
  it("parses valid AI JSON into A–J sections", async () => {
    const result = await synthesizePtClinicalReport(
      "sk-test",
      APPROVED_PAYLOAD,
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
      APPROVED_PAYLOAD,
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
