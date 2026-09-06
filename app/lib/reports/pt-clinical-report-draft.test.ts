/**
 * Run: npx tsx --test app/lib/reports/pt-clinical-report-draft.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import {
  buildPtClinicalReportDraft,
  buildPtClinicalReportDraftFallback,
  ptReportContainsPatientReportedLanguage,
  ptReportSectionsMatchSchema,
  PT_CLINICAL_REPORT_DISCLAIMER,
  PT_CLINICAL_REPORT_TITLE,
} from "./pt-clinical-report-draft";
import { PT_REPORT_SECTION_SPECS } from "./pt-clinical-report-schema";
import { validateAndNormalizePtReportSections } from "@/app/lib/ai/synthesize-pt-clinical-report";

const ENGLISH_DRAFT: PatientAssessmentDraft = {
  pain: {
    chiefComplaint: "Pain when reaching overhead",
    painLocation: "Right shoulder",
    painScore: "5",
    aggravating: "Overhead activity and reaching",
    easing: "Rest",
    dailyImpact: "Difficulty combing hair",
    goals: "Return to work without shoulder pain",
  },
};

const ARABIC_STRUCTURED = {
  assessmentLanguage: "ar",
  clinical_translation_status: "approved",
  clinical_translation_reviewed: true,
  chiefComplaint_en: "The patient reports pain when reaching overhead",
  painLocation_en: "The patient reports right shoulder pain",
  aggravating_en: "The patient reports overhead activity and reaching aggravate symptoms",
  easing_en: "The patient reports rest eases symptoms",
  dailyImpact_en: "The patient reports difficulty combing hair",
  goals_en: "The patient reports a goal to return to work without shoulder pain",
  pain: ENGLISH_DRAFT.pain,
};

describe("buildPtClinicalReportDraft", () => {
  it("builds A–J structured PT sections from clinical English fields", () => {
    const report = buildPtClinicalReportDraft({
      structuredData: ARABIC_STRUCTURED,
      draft: {
        ...ENGLISH_DRAFT,
        pain: {
          ...ENGLISH_DRAFT.pain!,
          chiefComplaint: "ألم عند رفع الذراع",
          painLocation: "الكتف الأيمن",
        },
      },
    });

    assert.equal(report.title, PT_CLINICAL_REPORT_TITLE);
    assert.equal(report.disclaimer, PT_CLINICAL_REPORT_DISCLAIMER);
    assert.equal(report.source, "clinical_english");
    assert.ok(ptReportSectionsMatchSchema(report));
    assert.equal(report.sections.length, PT_REPORT_SECTION_SPECS.length);
    assert.equal(report.sections[0]?.id, "presentation");
    assert.equal(report.sections[1]?.id, "primary_complaint");
    assert.equal(report.sections[6]?.id, "pt_interpretation");
    assert.equal(report.sections[9]?.id, "suggested_rasq_modules");
  });

  it("does not invent diagnosis or forbidden pathology terms", () => {
    const report = buildPtClinicalReportDraftFallback({
      structuredData: {
        assessmentLanguage: "en",
        ...ENGLISH_DRAFT,
      },
      draft: ENGLISH_DRAFT,
    });

    const corpus = report.sections
      .flatMap((section) => [...section.paragraphs, ...section.bullets])
      .join("\n")
      .toLowerCase();
    assert.doesNotMatch(corpus, /rotator cuff tear/);
    assert.doesNotMatch(corpus, /the patient has/);
    assert.doesNotMatch(corpus, /diagnosis/);
    assert.ok(ptReportContainsPatientReportedLanguage(report));
  });

  it("preserves original Arabic in structured data while report uses English", () => {
    const structuredData = {
      ...ARABIC_STRUCTURED,
      pain: {
        ...ENGLISH_DRAFT.pain!,
        chiefComplaint: "ألم عند رفع الذراع",
      },
    };
    const report = buildPtClinicalReportDraft({
      structuredData,
      draft: structuredData as PatientAssessmentDraft,
    });
    assert.equal(structuredData.pain.chiefComplaint, "ألم عند رفع الذراع");
    assert.ok(
      report.sections.some((section) =>
        [...section.paragraphs, ...section.bullets].some((line) =>
          line.includes("pain when reaching overhead"),
        ),
      ),
    );
    assert.equal(structuredData.chiefComplaint_en, "The patient reports pain when reaching overhead");
  });

  it("includes therapist-review disclaimer and safety wording", () => {
    const report = buildPtClinicalReportDraft({
      structuredData: { assessmentLanguage: "en", ...ENGLISH_DRAFT },
      draft: ENGLISH_DRAFT,
    });
    assert.match(report.disclaimer, /not a diagnosis/i);
    const safety = report.sections.find((section) => section.id === "safety");
    assert.ok(safety);
    assert.match(safety!.paragraphs.join(" "), /clinician screening is still required/i);
  });
});

describe("validateAndNormalizePtReportSections", () => {
  it("requires all A–J section ids", () => {
    const sections = validateAndNormalizePtReportSections(
      PT_REPORT_SECTION_SPECS.map((spec) => ({
        id: spec.id,
        paragraphs: [`Content for ${spec.id}`],
        bullets: [],
      })),
    );
    assert.ok(sections);
    assert.equal(sections!.length, PT_REPORT_SECTION_SPECS.length);
    assert.equal(sections![0]?.title, "Patient-Reported Presentation");
  });
});
