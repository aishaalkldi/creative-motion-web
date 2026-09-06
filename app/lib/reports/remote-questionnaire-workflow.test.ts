/**
 * Run: npx tsx --test app/lib/reports/remote-questionnaire-workflow.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canGeneratePtClinicalReport,
  invalidatePtReportOnTranslationChange,
  prepareRemoteQuestionnaireSubmission,
  readClinicalTranslationStatus,
  readPtClinicalReportForDisplay,
  readPtClinicalReportStatus,
  resolveRemoteQuestionnaireWorkflowStep,
} from "./remote-questionnaire-workflow";
import { applyClinicalEnglishFieldEdit } from "./patient-clinical-translation";

const ARABIC_DRAFT = {
  assessmentLanguage: "ar",
  pain: {
    chiefComplaint: "ألم في الكتف",
    painLocation: "الكتف الأيمن",
    painScore: "6",
    aggravating: "رفع الذراع",
    easing: "الراحة",
    dailyImpact: "صعوبة في المشي",
    goals: "العودة للعمل",
  },
};

describe("prepareRemoteQuestionnaireSubmission", () => {
  it("stores original Arabic only without _en fields", () => {
    const saved = prepareRemoteQuestionnaireSubmission(ARABIC_DRAFT);
    assert.equal(saved.clinical_translation_status, "not_generated");
    assert.equal(saved.pt_clinical_report_status, "not_generated");
    assert.equal((saved.pain as typeof ARABIC_DRAFT.pain).chiefComplaint, "ألم في الكتف");
    assert.equal(saved.chiefComplaint_en, undefined);
  });

  it("marks English submissions as translation not required", () => {
    const saved = prepareRemoteQuestionnaireSubmission({
      assessmentLanguage: "en",
      pain: {
        chiefComplaint: "Shoulder pain",
        painLocation: "Right shoulder",
        painScore: "4",
        aggravating: "",
        easing: "",
        dailyImpact: "",
        goals: "",
      },
    });
    assert.equal(saved.clinical_translation_status, "not_required");
  });
});

describe("patient submit workflow contract", () => {
  it("submit route does not auto-translate on patient submission", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "app/api/remote-assessments/[token]/submit/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(source, /batchTranslateRemoteQuestionnaire/);
    assert.match(source, /prepareRemoteQuestionnaireSubmission/);
  });
});

describe("clinical translation workflow gates", () => {
  it("blocks PT report until translation is approved for Arabic", () => {
    const withoutTranslation = prepareRemoteQuestionnaireSubmission(ARABIC_DRAFT);
    assert.equal(readClinicalTranslationStatus(withoutTranslation), "not_generated");
    assert.equal(
      canGeneratePtClinicalReport(withoutTranslation, withoutTranslation as typeof ARABIC_DRAFT),
      false,
    );

    const withTranslationNotApproved = {
      ...withoutTranslation,
      clinical_translation_status: "review_required",
      chiefComplaint_en: "Shoulder pain",
      painLocation_en: "Right shoulder",
      aggravating_en: "Raising the arm",
      easing_en: "Rest",
      dailyImpact_en: "Difficulty walking",
      goals_en: "Return to work",
    };
    assert.equal(
      canGeneratePtClinicalReport(
        withTranslationNotApproved,
        withTranslationNotApproved as typeof ARABIC_DRAFT,
      ),
      false,
    );

    const withApprovedTranslation = {
      ...withTranslationNotApproved,
      clinical_translation_status: "approved",
      clinical_translation_reviewed: true,
    };
    assert.equal(
      canGeneratePtClinicalReport(
        withApprovedTranslation,
        withApprovedTranslation as typeof ARABIC_DRAFT,
      ),
      true,
    );
  });

  it("maps legacy complete status to review_required", () => {
    const data = { clinical_translation_status: "complete" };
    assert.equal(readClinicalTranslationStatus(data), "review_required");
  });

  it("allows PT report for English submissions without _en fields", () => {
    const english = prepareRemoteQuestionnaireSubmission({
      assessmentLanguage: "en",
      pain: {
        chiefComplaint: "Shoulder pain",
        painLocation: "Right shoulder",
        painScore: "4",
        aggravating: "Overhead reach",
        easing: "Rest",
        dailyImpact: "Dressing is hard",
        goals: "Return to work",
      },
    });
    assert.equal(
      canGeneratePtClinicalReport(english, english as typeof ARABIC_DRAFT),
      true,
    );
  });

  it("invalidates approval and PT report after translation edit", () => {
    const approved = {
      ...ARABIC_DRAFT,
      clinical_translation_status: "approved",
      clinical_translation_reviewed: true,
      chiefComplaint_en: "Shoulder pain",
      pt_clinical_report_status: "draft_ready",
      pt_clinical_report_draft: { schemaVersion: 1, sections: [] },
      pt_clinical_report_final: { schemaVersion: 1, sections: [] },
    };
    const edited = applyClinicalEnglishFieldEdit(approved, "chiefComplaint", "Updated shoulder pain");
    const invalidated = invalidatePtReportOnTranslationChange(edited);
    assert.equal(invalidated.clinical_translation_reviewed, false);
    assert.equal(invalidated.clinical_translation_status, "review_required");
    assert.equal(invalidated.pt_clinical_report_status, "not_generated");
    assert.equal(invalidated.pt_clinical_report_draft, undefined);
    assert.equal((invalidated.pain as typeof ARABIC_DRAFT.pain).chiefComplaint, "ألم في الكتف");
    assert.equal(invalidated.chiefComplaint_en, "Updated shoulder pain");
    assert.equal(invalidated.chiefComplaint_en_ai, "Shoulder pain");
  });

  it("reads finalized PT report for display", () => {
    const finalReport = {
      schemaVersion: 1,
      title: "PT Clinical Report",
      disclaimer: "AI-generated draft for physiotherapist review. Not a diagnosis.",
      therapistReviewNote: "Draft only",
      sections: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceLanguage: "ar",
      source: "clinical_english",
    };
    const data = {
      pt_clinical_report_status: "finalized",
      pt_clinical_report_draft: { schemaVersion: 1, title: "Draft" },
      pt_clinical_report_final: finalReport,
    };
    assert.equal(readPtClinicalReportStatus(data), "finalized");
    assert.deepEqual(readPtClinicalReportForDisplay(data), finalReport);
  });

  it("resolves workflow steps", () => {
    const submitted = prepareRemoteQuestionnaireSubmission(ARABIC_DRAFT);
    assert.equal(
      resolveRemoteQuestionnaireWorkflowStep(submitted, submitted as typeof ARABIC_DRAFT),
      "clinical_english_pending",
    );

    const review = {
      ...submitted,
      clinical_translation_status: "review_required",
      chiefComplaint_en: "Shoulder pain",
      painLocation_en: "Right shoulder",
      aggravating_en: "Raising the arm",
      easing_en: "Rest",
      dailyImpact_en: "Difficulty walking",
      goals_en: "Return to work",
    };
    assert.equal(
      resolveRemoteQuestionnaireWorkflowStep(review, review as typeof ARABIC_DRAFT),
      "translation_review",
    );

    const approved = {
      ...review,
      clinical_translation_status: "approved",
      clinical_translation_reviewed: true,
    };
    assert.equal(
      resolveRemoteQuestionnaireWorkflowStep(approved, approved as typeof ARABIC_DRAFT),
      "translation_approved",
    );
  });
});
