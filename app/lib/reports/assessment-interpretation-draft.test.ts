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
  shouldShowAssessmentInterpretationDraft,
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

describe("shoulder comb hair / overhead", () => {
  it("maps overhead grooming to shoulder biomechanical review prompts", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "Pain when I comb my hair",
          painLocation: "Right shoulder",
          painScore: "5",
          aggravating: "Overhead reach",
          easing: "Rest",
          dailyImpact: "Hard to wash my hair",
          goals: "",
        },
      },
    });

    assert.ok(draft.matchedRuleIds.includes("shoulder-overhead"));
    assert.ok(draft.bodyRegionBuckets.includes("Shoulder"));
    assert.ok(draft.hasBiomechanicalPrompts);
    assert.ok(
      draft.movementComponents.some((line) => line.includes("shoulder external rotation")),
    );
    assert.ok(
      draft.movementComponents.some((line) => line.includes("scapulohumeral coordination")),
    );
    assert.ok(
      draft.movementComponents.every((line) => line.startsWith("Movement component for review:")),
    );
  });
});

describe("shoulder behind-back / bra", () => {
  it("maps behind-back and bra tasks to shoulder rotation prompts", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "Cannot reach behind my back",
          painLocation: "Left shoulder",
          painScore: "4",
          aggravating: "Doing my bra clasp and putting on a jacket",
          easing: "",
          dailyImpact: "Dressing is difficult",
          goals: "",
        },
        rom: {
          limitations: "Hand behind back is limited",
          worseWith: "",
        },
      },
    });

    assert.ok(draft.matchedRuleIds.includes("shoulder-behind-back"));
    assert.ok(
      draft.movementComponents.some((line) => line.includes("shoulder internal rotation")),
    );
    assert.ok(
      draft.movementComponents.some((line) => line.includes("hand-behind-back movement")),
    );
  });
});

describe("stairs knee + hip overlap", () => {
  it("generates both knee and hip biomechanical review prompts", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "Knee pain on stairs",
          painLocation: "Right knee",
          painScore: "6",
          aggravating: "Climbing stairs",
          easing: "",
          dailyImpact: "Stairs are very difficult",
          goals: "",
        },
        functional: {
          standingDuration: "",
          walkingDistance: "",
          stairsAbility: "One step at a time",
          otherNotes: "",
        },
      },
    });

    assert.ok(draft.matchedRuleIds.includes("stairs-overlap"));
    assert.ok(draft.bodyRegionBuckets.includes("Knee"));
    assert.ok(draft.bodyRegionBuckets.includes("Hip"));
    assert.ok(draft.movementComponents.some((line) => line.includes("knee flexion")));
    assert.ok(draft.movementComponents.some((line) => line.includes("hip flexion")));
    assert.ok(draft.musclePerformanceAreas.some((line) => line.includes("quadriceps")));
    assert.ok(draft.musclePerformanceAreas.some((line) => line.includes("hip flexors")));
  });
});

describe("low back sitting / getting up", () => {
  it("uses safe trunk-control wording without ROM-loss claims", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "Lower back pain when sitting",
          painLocation: "Lower back",
          painScore: "5",
          aggravating: "Getting up from a chair",
          easing: "",
          dailyImpact: "Pain when standing from sitting",
          goals: "",
        },
      },
    });

    assert.ok(draft.matchedRuleIds.includes("low-back-transfers"));
    assert.ok(
      draft.movementComponents.some((line) => line.includes("functional trunk control")),
    );
    assert.ok(
      draft.movementComponents.some((line) => line.includes("lumbopelvic coordination")),
    );
    assert.ok(
      draft.movementComponents.some((line) => line.includes("sit-to-stand mechanics")),
    );

    const allOutput = [
      ...draft.functionalLimitations,
      ...draft.movementComponents,
      ...draft.musclePerformanceAreas,
      ...draft.suggestedObjectiveAssessments,
    ]
      .join("\n")
      .toLowerCase();
    assert.equal(allOutput.includes("limited rom"), false);
    assert.equal(allOutput.includes("rom loss"), false);
  });
});

describe("no-match", () => {
  it("hides section when draft is empty", () => {
    const draft = buildAssessmentInterpretationDraft({ draft: EMPTY_DRAFT });
    assert.equal(draft.hasBiomechanicalPrompts, false);
    assert.equal(draft.functionalLimitations.length, 0);
    assert.equal(draft.movementComponents.length, 0);
    assert.equal(shouldShowAssessmentInterpretationDraft(draft), false);
  });

  it("shows functional-only section without biomechanical groups when rules do not match", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "General soreness after activity",
          painLocation: "",
          painScore: "3",
          aggravating: "",
          easing: "",
          dailyImpact: "Some difficulty with daily tasks",
          goals: "",
        },
      },
    });

    assert.equal(draft.hasBiomechanicalPrompts, false);
    assert.equal(draft.movementComponents.length, 0);
    assert.ok(draft.functionalLimitations.length > 0);
    assert.equal(shouldShowAssessmentInterpretationDraft(draft), true);
    assert.match(draft.confirmationNote, /No biomechanical review prompts matched/);
  });
});

describe("duplicate removal", () => {
  it("dedupes movement prompts when multiple rules overlap", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "Shoulder pain reaching overhead and behind back",
          painLocation: "Shoulder",
          painScore: "5",
          aggravating: "Overhead reach and bra clasp",
          easing: "",
          dailyImpact: "Comb hair and jacket are difficult",
          goals: "",
        },
      },
    });

    const movementLabels = draft.movementComponents.map((line) =>
      line.replace("Movement component for review:", "").trim(),
    );
    assert.equal(movementLabels.length, new Set(movementLabels.map((v) => v.toLowerCase())).size);
    assert.ok(draft.matchedRuleIds.includes("shoulder-overhead"));
    assert.ok(draft.matchedRuleIds.includes("shoulder-behind-back"));
  });
});

describe("forbidden-term guard", () => {
  it("does not emit forbidden pathology or confirmed-impairment wording", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint:
            "Rotator cuff tear, frozen shoulder, OA, meniscus injury, impingement, radiculopathy, grade 3 weakness",
          painLocation: "Shoulder",
          painScore: "8",
          aggravating: "Treatment recommendation and fall risk prediction",
          easing: "",
          dailyImpact: "Limited ROM and weakness confirmed — clinical improvement expected",
          goals: "Diagnosis",
        },
      },
    });

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
      assert.equal(corpus.includes(term.trim()), false, `unexpected forbidden term: ${term}`);
    }
  });

  it("uses updated objective prefix wording", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "Knee pain on stairs",
          painLocation: "Knee",
          painScore: "4",
          aggravating: "Stairs",
          easing: "",
          dailyImpact: "",
          goals: "",
        },
      },
    });

    assert.ok(
      draft.suggestedObjectiveAssessments.every((line) =>
        line.startsWith("Suggested objective PT assessment item:"),
      ),
    );
  });

  it("prefers English translation meta for biomechanical rule matching", () => {
    const draft = buildAssessmentInterpretationDraft({
      draft: {
        pain: {
          chiefComplaint: "ألم",
          painLocation: "الكتف",
          painScore: "5",
          aggravating: "",
          easing: "",
          dailyImpact: "صعوبة",
          goals: "",
        },
      },
      submissionMeta: {
        dailyImpact_en: "Difficulty combing my hair and reaching overhead",
        painLocation_en: "Right shoulder",
      },
    });

    assert.ok(draft.matchedRuleIds.includes("shoulder-overhead"));
  });
});
