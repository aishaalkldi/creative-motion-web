/**
 * Run: npx tsx --test app/lib/reports/assessment-interpretation-draft.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import {
  buildAssessmentInterpretationDraft,
  draftOutputContainsForbiddenTerms,
  FORBIDDEN_INTERPRETATION_TERMS,
} from "./assessment-interpretation-draft";

const EMPTY_DRAFT: PatientAssessmentDraft = {
  pain: {
    chiefComplaint: "",
    painLocation: "",
    painScore: "",
    aggravating: "",
    easing: "",
    dailyImpact: "",
    goals: "",
  },
};

const SHOULDER_DRAFT: PatientAssessmentDraft = {
  pain: {
    chiefComplaint: "Shoulder pain when reaching overhead",
    painLocation: "Right shoulder",
    painScore: "6",
    aggravating: "Overhead reaching and dressing",
    easing: "Rest and ice",
    dailyImpact: "Difficulty with overhead reaching and grooming",
    goals: "Return to tennis without pain",
  },
  rom: {
    limitations: "Cannot reach behind back comfortably",
    worseWith: "Reaching overhead causes shoulder pain",
  },
};

const KNEE_DRAFT: PatientAssessmentDraft = {
  pain: {
    chiefComplaint: "Knee pain when climbing stairs",
    painLocation: "Right knee",
    painScore: "5",
    aggravating: "Stairs and squatting",
    easing: "Rest",
    dailyImpact: "Difficulty climbing stairs and walking long distances",
    goals: "Walk without pain",
  },
  functional: {
    standingDuration: "About 10 minutes",
    walkingDistance: "Two blocks before discomfort",
    stairsAbility: "One step at a time, very difficult",
    otherNotes: "",
  },
};

describe("buildAssessmentInterpretationDraft — shoulder-like", () => {
  it("derives shoulder region and review prompts", () => {
    const draft = buildAssessmentInterpretationDraft({ draft: SHOULDER_DRAFT });
    assert.equal(draft.bodyRegionBucket, "Shoulder");
    assert.equal(draft.sufficientDetail, true);
    assert.ok(draft.functionalLimitations.some((line) => line.includes("overhead")));
    assert.ok(
      draft.movementComponents.some((line) => line.includes("shoulder external rotation")),
    );
    assert.ok(draft.musclePerformanceAreas.some((line) => line.includes("rotator cuff")));
    assert.ok(draft.suggestedObjectiveAssessments.some((line) => line.includes("AROM")));
    assert.match(draft.confirmationNote, /Draft only — therapist confirmation required/);
  });

  it("uses required safe prefixes", () => {
    const draft = buildAssessmentInterpretationDraft({ draft: SHOULDER_DRAFT });
    assert.ok(
      draft.functionalLimitations.every((line) =>
        line.startsWith("Patient-reported limitation:"),
      ),
    );
    assert.ok(
      draft.movementComponents.every((line) =>
        line.startsWith("Movement component that may be relevant to assess:"),
      ),
    );
    assert.ok(
      draft.musclePerformanceAreas.every((line) =>
        line.startsWith("Possible muscle performance area for therapist review:"),
      ),
    );
    assert.ok(
      draft.suggestedObjectiveAssessments.every((line) =>
        line.startsWith("Suggested therapist assessment:"),
      ),
    );
  });
});

describe("buildAssessmentInterpretationDraft — knee-like", () => {
  it("derives knee region and stair-related limitations", () => {
    const draft = buildAssessmentInterpretationDraft({ draft: KNEE_DRAFT });
    assert.equal(draft.bodyRegionBucket, "Knee");
    assert.ok(draft.functionalLimitations.some((line) => /stair|walking/i.test(line)));
    assert.ok(draft.movementComponents.some((line) => line.includes("stair negotiation")));
    assert.ok(draft.musclePerformanceAreas.some((line) => line.includes("quadriceps")));
  });
});

describe("buildAssessmentInterpretationDraft — sparse/empty", () => {
  it("returns insufficient detail for empty draft", () => {
    const draft = buildAssessmentInterpretationDraft({ draft: EMPTY_DRAFT });
    assert.equal(draft.bodyRegionBucket, null);
    assert.equal(draft.sufficientDetail, false);
    assert.equal(draft.functionalLimitations.length, 0);
    assert.match(draft.confirmationNote, /Insufficient patient-reported detail/);
  });

  it("still provides generic review prompts when region unknown but text exists", () => {
    const sparse: PatientAssessmentDraft = {
      pain: {
        ...EMPTY_DRAFT.pain!,
        chiefComplaint: "General soreness after activity",
        dailyImpact: "Some difficulty with daily tasks",
      },
    };
    const draft = buildAssessmentInterpretationDraft({ draft: sparse });
    assert.equal(draft.bodyRegionBucket, "General MSK");
    assert.equal(draft.sufficientDetail, true);
    assert.ok(draft.movementComponents.length > 0);
    assert.ok(draft.musclePerformanceAreas.length > 0);
  });
});

describe("forbidden-term guard", () => {
  it("does not emit forbidden pathology or diagnosis wording", () => {
    const toxic: PatientAssessmentDraft = {
      pain: {
        chiefComplaint: "Possible rotator cuff tear and frozen shoulder with deltoid weakness",
        painLocation: "Shoulder",
        painScore: "8",
        aggravating: "Neurological disorder symptoms and treatment recommendation needed",
        easing: "",
        dailyImpact: "Will improve with surgery — clinical improvement expected",
        goals: "Fix diagnosis",
      },
    };

    const draft = buildAssessmentInterpretationDraft({ draft: toxic });
    const hits = draftOutputContainsForbiddenTerms(draft);
    assert.deepEqual(hits, []);

    for (const term of FORBIDDEN_INTERPRETATION_TERMS) {
      const corpus = [
        ...draft.functionalLimitations,
        ...draft.movementComponents,
        ...draft.musclePerformanceAreas,
        ...draft.suggestedObjectiveAssessments,
        draft.confirmationNote,
      ]
        .join("\n")
        .toLowerCase();
      assert.equal(corpus.includes(term), false, `unexpected forbidden term: ${term}`);
    }
  });

  it("prefers English translation meta over Arabic source for rule matching", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "ألم في الكتف",
          painLocation: "الكتف الأيمن",
          painScore: "5",
          aggravating: "",
          easing: "",
          dailyImpact: "صعوبة في الوصول فوق الرأس",
          goals: "",
        },
      },
      submissionMeta: {
        chiefComplaint_en: "Shoulder pain",
        painLocation_en: "Right shoulder",
        dailyImpact_en: "Difficulty with overhead reaching and grooming",
      },
    });

    assert.equal(draft.bodyRegionBucket, "Shoulder");
    assert.ok(draft.functionalLimitations.some((line) => /overhead|groom/i.test(line)));
  });
});
