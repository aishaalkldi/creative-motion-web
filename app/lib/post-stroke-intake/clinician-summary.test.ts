/**
 * Run: npx tsx --test app/lib/post-stroke-intake/clinician-summary.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPostStrokeIntakeClinicianReviewEntries,
  buildPostStrokeIntakeSummary,
  extractPostStrokeIntakeSubmissionMeta,
  formatPostStrokeInputModeIndicator,
  POST_STROKE_INTAKE_ASSESSMENT_TITLE,
} from "./clinician-summary";

const SAMPLE_STRUCTURED_DATA = {
  assessmentLanguage: "en",
  postStrokeIntake: {
    respondent: { type: "patient_with_caregiver_assistance", assistanceType: "technology_support" },
    functionalIntake: {
      functionalGoal: "Walk to the kitchen safely",
    },
    subjectiveNarrative: {
      responses: [
        { questionId: "mainDifficulty", inputMode: "text", text: "Trouble with balance when walking." },
        { questionId: "onsetOrChange", inputMode: "voice", text: "Since discharge two weeks ago." },
        { questionId: "dailyImpact", inputMode: "text", text: "Cooking and bathing take longer." },
        { questionId: "mostDifficultActivities", inputMode: "text", text: "Stairs and getting dressed." },
        { questionId: "additionalInformation", inputMode: "text", text: "Fatigue by afternoon." },
      ],
      patientConfirmedAt: "2026-07-30T12:00:00.000Z",
    },
  },
};

describe("extractPostStrokeIntakeSubmissionMeta", () => {
  it("returns structured_data for post_stroke_intake with a postStrokeIntake payload", () => {
    const meta = extractPostStrokeIntakeSubmissionMeta(SAMPLE_STRUCTURED_DATA, "post_stroke_intake");
    assert.ok(meta);
    assert.equal(meta.assessmentLanguage, "en");
  });

  it("returns null for remote_questionnaire even when postStrokeIntake is present", () => {
    assert.equal(extractPostStrokeIntakeSubmissionMeta(SAMPLE_STRUCTURED_DATA, "remote_questionnaire"), null);
  });

  it("returns null for post_stroke_intake without postStrokeIntake", () => {
    assert.equal(extractPostStrokeIntakeSubmissionMeta({}, "post_stroke_intake"), null);
  });
});

describe("buildPostStrokeIntakeClinicianReviewEntries — Gate 1 facts", () => {
  it("includes respondent, functional goal, narrative answers, and assessment language", () => {
    const entries = buildPostStrokeIntakeClinicianReviewEntries(SAMPLE_STRUCTURED_DATA);
    const keys = entries.map((entry) => entry.fieldKey);
    assert.ok(keys.includes("respondent"));
    assert.ok(keys.includes("functionalGoal"));
    assert.ok(keys.includes("mainDifficulty"));
    assert.ok(keys.includes("onsetOrChange"));
    assert.ok(keys.includes("dailyImpact"));
    assert.ok(keys.includes("mostDifficultActivities"));
    assert.ok(keys.includes("additionalInformation"));
    assert.ok(keys.includes("assessmentLanguage"));
  });

  it("does not duplicate functional goal inside narrative question rows", () => {
    const entries = buildPostStrokeIntakeClinicianReviewEntries(SAMPLE_STRUCTURED_DATA);
    const goalEntries = entries.filter((entry) => entry.value.includes("Walk to the kitchen safely"));
    assert.equal(goalEntries.length, 1);
    assert.equal(goalEntries[0]?.fieldKey, "functionalGoal");
  });

  it("renders narrative input-mode indicators for voice and text answers", () => {
    const entries = buildPostStrokeIntakeClinicianReviewEntries(SAMPLE_STRUCTURED_DATA);
    const onset = entries.find((entry) => entry.fieldKey === "onsetOrChange");
    const main = entries.find((entry) => entry.fieldKey === "mainDifficulty");
    assert.equal(onset?.inputMode, "voice");
    assert.equal(main?.inputMode, "text");
    assert.equal(formatPostStrokeInputModeIndicator("voice"), "Recorded by voice");
    assert.equal(formatPostStrokeInputModeIndicator("text"), "Typed");
  });

  it("never exposes client confirmation state as a review row", () => {
    const entries = buildPostStrokeIntakeClinicianReviewEntries(SAMPLE_STRUCTURED_DATA);
    assert.equal(
      entries.some((entry) => entry.fieldKey.includes("patientConfirmed")),
      false,
    );
  });
});

describe("buildPostStrokeIntakeSummary — patient profile", () => {
  it("builds a clinician-visible summary for submitted post_stroke_intake", () => {
    const summary = buildPostStrokeIntakeSummary(SAMPLE_STRUCTURED_DATA, "2026-07-30T08:00:00.000Z");
    assert.ok(summary);
    assert.equal(summary.title, POST_STROKE_INTAKE_ASSESSMENT_TITLE);
    assert.equal(summary.hasRedFlag, false);
    assert.ok(summary.rows.length > 0);
  });

  it("returns null for unrelated payloads", () => {
    assert.equal(buildPostStrokeIntakeSummary({ pain: { chiefComplaint: "x" } }, "2026-07-30"), null);
  });
});
