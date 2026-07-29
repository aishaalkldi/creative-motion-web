/**
 * Run: npx tsx --test app/lib/ai/generate-pt-medical-report.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  buildPtMedicalReportDraftRecord,
  buildPtMedicalReportGeneratorInput,
  generatePtMedicalReportSections,
  omitEmptyPtReportSections,
  parsePtReportSectionsFromJson,
  readPtMedicalReportDraft,
  validateAndSanitizePtReportSections,
} from "./generate-pt-medical-report";

const APPROVED_FACTS: ApprovedPatientReportFacts = {
  version: 1,
  approvedAt: "2026-07-29T08:00:00.000Z",
  facts: {
    chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
    painLocation: "Right shoulder",
    painScore: "6/10",
    aggravating: "Overhead reaching and lifting.",
    easing: "Rest and ice.",
    goals: "Return to overhead work without pain.",
  },
  chiefComplaintExtraction: {
    body_region: "shoulder",
    side: "right",
    primary_symptom: "pain",
    aggravating_factor: "overhead arm elevation",
    language: "en",
    confidence: 0.9,
  },
};

describe("buildPtMedicalReportGeneratorInput", () => {
  it("includes only approved facts and optional reviewed extraction", () => {
    const input = buildPtMedicalReportGeneratorInput(APPROVED_FACTS);
    assert.equal(input.approvedAt, APPROVED_FACTS.approvedAt);
    assert.deepEqual(input.facts, APPROVED_FACTS.facts);
    assert.deepEqual(input.chiefComplaintExtraction, APPROVED_FACTS.chiefComplaintExtraction);
  });
});

describe("parsePtReportSectionsFromJson", () => {
  it("parses supported sections and ignores unknown keys", () => {
    const parsed = parsePtReportSectionsFromJson(
      JSON.stringify({
        chiefComplaint: "The patient reports shoulder pain.",
        diagnosis: "should be ignored",
        painAndSymptoms: "Pain rated 6/10.",
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed.chiefComplaint, "The patient reports shoulder pain.");
    assert.equal(parsed.painAndSymptoms, "Pain rated 6/10.");
    assert.equal("diagnosis" in parsed, false);
  });

  it("rejects invalid section value types", () => {
    assert.equal(parsePtReportSectionsFromJson(JSON.stringify({ chiefComplaint: 42 })), null);
  });
});

describe("validateAndSanitizePtReportSections", () => {
  it("omits empty sections and adds default review note", () => {
    const result = validateAndSanitizePtReportSections({
      chiefComplaint: "The patient reports shoulder pain.",
      painAndSymptoms: "   ",
      clinicalReviewNote: "",
    });
    assert.equal(result.ok, true);
    assert.equal(result.sections.chiefComplaint, "The patient reports shoulder pain.");
    assert.equal(result.sections.painAndSymptoms, undefined);
    assert.match(result.sections.clinicalReviewNote ?? "", /Therapist review is required/i);
  });

  it("rejects diagnosis, prognosis, and treatment recommendation wording", () => {
    for (const unsafe of [
      "The diagnosis is rotator cuff tear.",
      "Prognosis is good with therapy.",
      "Treatment recommendation includes manual therapy.",
    ]) {
      const result = validateAndSanitizePtReportSections({
        chiefComplaint: unsafe,
        clinicalReviewNote: "Patient-reported draft for therapist review.",
      });
      assert.equal(result.ok, false);
      assert.ok(result.forbiddenPhrases.length > 0);
    }
  });
});

describe("omitEmptyPtReportSections", () => {
  it("drops unsupported empty sections", () => {
    const sections = omitEmptyPtReportSections({
      chiefComplaint: "The patient reports pain.",
      functionalLimitations: "  ",
    });
    assert.deepEqual(Object.keys(sections), ["chiefComplaint"]);
  });
});

describe("buildPtMedicalReportDraftRecord", () => {
  it("creates version 1 on first generation", () => {
    const record = buildPtMedicalReportDraftRecord(
      null,
      APPROVED_FACTS,
      { chiefComplaint: "Draft text." },
      "2026-07-29T09:00:00.000Z",
    );
    assert.equal(record.version, 1);
    assert.equal(record.status, "draft");
    assert.equal(record.sourceFactsVersion, 1);
  });

  it("increments version and replaces sections on regeneration", () => {
    const existing = buildPtMedicalReportDraftRecord(
      null,
      APPROVED_FACTS,
      { chiefComplaint: "First draft." },
      "2026-07-29T09:00:00.000Z",
    );
    const regenerated = buildPtMedicalReportDraftRecord(
      existing,
      APPROVED_FACTS,
      { chiefComplaint: "Second draft." },
      "2026-07-29T10:00:00.000Z",
    );
    assert.equal(regenerated.version, 2);
    assert.equal(regenerated.sections.chiefComplaint, "Second draft.");
    assert.notEqual(regenerated.generatedAt, existing.generatedAt);
  });
});

describe("readPtMedicalReportDraft", () => {
  it("reads a stored draft and ignores invalid records", () => {
    const draft = {
      version: 1,
      status: "draft",
      generatedAt: "2026-07-29T09:00:00.000Z",
      sourceFactsVersion: 1,
      sections: { chiefComplaint: "Draft text." },
    };
    const read = readPtMedicalReportDraft({ ptMedicalReportDraft: draft });
    assert.deepEqual(read?.sections.chiefComplaint, "Draft text.");
    assert.equal(readPtMedicalReportDraft({ ptMedicalReportDraft: { ...draft, status: "approved" } }), null);
  });
});

describe("generatePtMedicalReportSections", () => {
  it("uses injectable AI helper and validates output", async () => {
    const result = await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                clinicalReviewNote:
                  "Compiled from clinician-approved patient-reported information. Therapist review required.",
              }),
            },
          },
        ],
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.sections.chiefComplaint ?? "", /patient reports/i);
    }
  });

  it("rejects unsafe model output", async () => {
    const result = await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                chiefComplaint: "Diagnosis: rotator cuff tear.",
                clinicalReviewNote: "Review required.",
              }),
            },
          },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_output");
    }
  });
});
