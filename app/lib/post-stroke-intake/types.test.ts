/**
 * Run: npx tsx --test app/lib/post-stroke-intake/types.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  firstIncompleteFunctionalIntakeScreen,
  firstIncompleteSubjectiveNarrativeScreen,
  getVisibleAssistanceTypes,
  isAssistanceTypeValidForRespondent,
  isFunctionalIntakeComplete,
  isSubjectiveNarrativeComplete,
  isValidPostStrokeAssistanceType,
  isValidPostStrokeAssistiveDevice,
  isValidPostStrokeCommunicationSupport,
  isValidPostStrokeFallsOrNearFalls,
  isValidPostStrokeFunctionalAbility,
  isValidPostStrokeMoreAffectedSide,
  isValidPostStrokeRespondentType,
  isValidPostStrokeSubjectiveInputMode,
  isValidPostStrokeSubjectiveQuestionId,
  isValidPostStrokeUpperLimbUse,
  isValidPostStrokeWalkingAbility,
  POST_STROKE_SUBJECTIVE_QUESTION_IDS,
  shouldShowAssistanceTypeSection,
  type PostStrokeFunctionalIntake,
  type PostStrokeSubjectiveResponse,
} from "./types";

describe("shouldShowAssistanceTypeSection", () => {
  it("hides the assistance-type section for a plain patient respondent", () => {
    assert.equal(shouldShowAssistanceTypeSection("patient"), false);
  });

  it("hides the section when no respondent type has been chosen yet", () => {
    assert.equal(shouldShowAssistanceTypeSection(null), false);
  });

  it("shows the section when a caregiver assisted the patient", () => {
    assert.equal(shouldShowAssistanceTypeSection("patient_with_caregiver_assistance"), true);
  });

  it("shows the section when a caregiver is reporting as proxy", () => {
    assert.equal(shouldShowAssistanceTypeSection("caregiver_proxy"), true);
  });
});

describe("getVisibleAssistanceTypes", () => {
  it("returns no options for a plain patient respondent", () => {
    assert.deepEqual(getVisibleAssistanceTypes("patient"), []);
  });

  it("returns exactly the four permitted options for patient_with_caregiver_assistance, excluding caregiver_answered_for_patient", () => {
    const visible = getVisibleAssistanceTypes("patient_with_caregiver_assistance");
    assert.deepEqual(
      [...visible].sort(),
      ["communication_support", "other", "question_clarification", "technology_support"].sort(),
    );
    assert.ok(!visible.includes("caregiver_answered_for_patient"));
  });

  it("excludes caregiver_answered_for_patient for caregiver_proxy — already established by respondent type", () => {
    const visible = getVisibleAssistanceTypes("caregiver_proxy");
    assert.ok(!visible.includes("caregiver_answered_for_patient"));
    assert.equal(visible.length, 4);
  });
});

describe("isAssistanceTypeValidForRespondent", () => {
  it("treats an unset assistance type as always valid", () => {
    assert.equal(isAssistanceTypeValidForRespondent(undefined, "patient"), true);
    assert.equal(isAssistanceTypeValidForRespondent(undefined, "caregiver_proxy"), true);
  });

  it("invalidates a selected assistance type when respondent switches to plain patient", () => {
    assert.equal(isAssistanceTypeValidForRespondent("technology_support", "patient"), false);
  });

  it("keeps a valid assistance type valid when switching between the two caregiver-involved respondent types", () => {
    assert.equal(isAssistanceTypeValidForRespondent("communication_support", "patient_with_caregiver_assistance"), true);
    assert.equal(isAssistanceTypeValidForRespondent("communication_support", "caregiver_proxy"), true);
  });

  it("invalidates caregiver_answered_for_patient for every respondent type (never a visible choice)", () => {
    assert.equal(isAssistanceTypeValidForRespondent("caregiver_answered_for_patient", "patient_with_caregiver_assistance"), false);
    assert.equal(isAssistanceTypeValidForRespondent("caregiver_answered_for_patient", "caregiver_proxy"), false);
  });
});

describe("existing closed-enum guards remain unchanged", () => {
  it("still validates respondent type against the closed enum", () => {
    assert.equal(isValidPostStrokeRespondentType("caregiver_proxy"), true);
    assert.equal(isValidPostStrokeRespondentType("not_real"), false);
  });

  it("still validates assistance type against the closed enum, including caregiver_answered_for_patient as a stored value", () => {
    assert.equal(isValidPostStrokeAssistanceType("caregiver_answered_for_patient"), true);
    assert.equal(isValidPostStrokeAssistanceType("not_real"), false);
  });
});

describe("Stage 3 closed-enum guards", () => {
  it("validates moreAffectedSide", () => {
    for (const value of ["left", "right", "both", "unsure"]) {
      assert.equal(isValidPostStrokeMoreAffectedSide(value), true, value);
    }
    assert.equal(isValidPostStrokeMoreAffectedSide("diagnosis"), false);
    assert.equal(isValidPostStrokeMoreAffectedSide(undefined), false);
  });

  it("validates sitting/standing functional ability", () => {
    for (const value of ["independent", "requires_supervision", "requires_physical_assistance", "unable"]) {
      assert.equal(isValidPostStrokeFunctionalAbility(value), true, value);
    }
    assert.equal(isValidPostStrokeFunctionalAbility("with_assistive_device"), false);
  });

  it("validates walkingAbility, including the extra with_assistive_device value", () => {
    for (const value of [
      "independent",
      "with_assistive_device",
      "requires_supervision",
      "requires_physical_assistance",
      "unable",
    ]) {
      assert.equal(isValidPostStrokeWalkingAbility(value), true, value);
    }
    assert.equal(isValidPostStrokeWalkingAbility("not_real"), false);
  });

  it("validates assistiveDevice", () => {
    for (const value of ["none", "cane", "walker", "wheelchair", "other"]) {
      assert.equal(isValidPostStrokeAssistiveDevice(value), true, value);
    }
    assert.equal(isValidPostStrokeAssistiveDevice("crutches"), false);
  });

  it("validates recentFalls", () => {
    for (const value of ["none", "near_fall", "fall_without_injury", "fall_with_injury_already_reported"]) {
      assert.equal(isValidPostStrokeFallsOrNearFalls(value), true, value);
    }
    assert.equal(isValidPostStrokeFallsOrNearFalls("fall_risk_high"), false);
  });

  it("validates upperLimbUse", () => {
    for (const value of ["functional_use", "limited_use", "minimal_use", "no_functional_use", "unsure"]) {
      assert.equal(isValidPostStrokeUpperLimbUse(value), true, value);
    }
    assert.equal(isValidPostStrokeUpperLimbUse("not_real"), false);
  });

  it("validates communicationSupport", () => {
    for (const value of [
      "none",
      "extra_time",
      "simplified_questions",
      "caregiver_support",
      "alternative_communication",
      "other",
    ]) {
      assert.equal(isValidPostStrokeCommunicationSupport(value), true, value);
    }
    assert.equal(isValidPostStrokeCommunicationSupport("not_real"), false);
  });
});

const COMPLETE_FUNCTIONAL_INTAKE: PostStrokeFunctionalIntake = {
  moreAffectedSide: "left",
  sittingAbility: "independent",
  standingAbility: "independent",
  walkingAbility: "independent",
  assistiveDevice: "none",
  recentFalls: "none",
  upperLimbUse: "functional_use",
  communicationSupport: "none",
  functionalGoal: "Walk to the kitchen safely",
  recordedAt: "2026-07-30T00:00:00.000Z",
  flags: ["clinician_review_required"],
};

describe("firstIncompleteFunctionalIntakeScreen", () => {
  it("returns screen 1 when nothing has been answered yet", () => {
    assert.equal(firstIncompleteFunctionalIntakeScreen(undefined), 1);
    assert.equal(firstIncompleteFunctionalIntakeScreen({}), 1);
  });

  it("returns screen 1 when assistiveDevice is 'other' without the required other-text", () => {
    assert.equal(
      firstIncompleteFunctionalIntakeScreen({
        ...COMPLETE_FUNCTIONAL_INTAKE,
        assistiveDevice: "other",
        assistiveDeviceOtherText: undefined,
      }),
      1,
    );
  });

  it("returns screen 2 once screen 1 is complete but screen 2 is not", () => {
    const { upperLimbUse: _upperLimbUse, communicationSupport: _communicationSupport, ...screen1Only } =
      COMPLETE_FUNCTIONAL_INTAKE;
    assert.equal(firstIncompleteFunctionalIntakeScreen(screen1Only), 2);
  });

  it("returns screen 2 when communicationSupport is 'other' without the required other-text", () => {
    assert.equal(
      firstIncompleteFunctionalIntakeScreen({
        ...COMPLETE_FUNCTIONAL_INTAKE,
        communicationSupport: "other",
        communicationSupportOtherText: undefined,
      }),
      2,
    );
  });

  it("returns screen 3 once screens 1 and 2 are complete", () => {
    const { functionalGoal: _functionalGoal, ...withoutGoal } = COMPLETE_FUNCTIONAL_INTAKE;
    assert.equal(firstIncompleteFunctionalIntakeScreen(withoutGoal), 3);
  });

  it("returns screen 3 when everything, including the goal, is already complete", () => {
    assert.equal(firstIncompleteFunctionalIntakeScreen(COMPLETE_FUNCTIONAL_INTAKE), 3);
  });
});

describe("isFunctionalIntakeComplete", () => {
  it("is true for a fully answered functional intake", () => {
    assert.equal(isFunctionalIntakeComplete(COMPLETE_FUNCTIONAL_INTAKE), true);
  });

  it("is false when undefined or empty", () => {
    assert.equal(isFunctionalIntakeComplete(undefined), false);
    assert.equal(isFunctionalIntakeComplete({}), false);
  });

  it("is false when any required field is missing", () => {
    const { recentFalls: _recentFalls, ...missingRecentFalls } = COMPLETE_FUNCTIONAL_INTAKE;
    assert.equal(isFunctionalIntakeComplete(missingRecentFalls), false);
  });

  it("is false when 'other' is selected but the paired other-text is missing", () => {
    assert.equal(
      isFunctionalIntakeComplete({ ...COMPLETE_FUNCTIONAL_INTAKE, assistiveDevice: "other" }),
      false,
    );
    assert.equal(
      isFunctionalIntakeComplete({ ...COMPLETE_FUNCTIONAL_INTAKE, communicationSupport: "other" }),
      false,
    );
  });

  it("is true when 'other' is selected together with its other-text", () => {
    assert.equal(
      isFunctionalIntakeComplete({
        ...COMPLETE_FUNCTIONAL_INTAKE,
        assistiveDevice: "other",
        assistiveDeviceOtherText: "Custom rollator",
      }),
      true,
    );
  });
});

describe("Stage 4 — subjective narrative closed-enum guards", () => {
  it("validates every question id in the closed 5-question set", () => {
    for (const id of POST_STROKE_SUBJECTIVE_QUESTION_IDS) {
      assert.equal(isValidPostStrokeSubjectiveQuestionId(id), true, id);
    }
    assert.equal(isValidPostStrokeSubjectiveQuestionId("affectedSide"), false);
    assert.equal(isValidPostStrokeSubjectiveQuestionId("functionalGoal"), false);
  });

  it("does not repeat any Stage 2/3 closed-enum field as a subjective question id", () => {
    const forbidden = [
      "moreAffectedSide",
      "sittingAbility",
      "standingAbility",
      "walkingAbility",
      "recentFalls",
      "communicationSupport",
      "functionalGoal",
    ];
    for (const id of forbidden) {
      assert.equal(isValidPostStrokeSubjectiveQuestionId(id), false, id);
    }
  });

  it("validates input mode as exactly text or voice", () => {
    assert.equal(isValidPostStrokeSubjectiveInputMode("text"), true);
    assert.equal(isValidPostStrokeSubjectiveInputMode("voice"), true);
    assert.equal(isValidPostStrokeSubjectiveInputMode("speech"), false);
    assert.equal(isValidPostStrokeSubjectiveInputMode(undefined), false);
  });
});

function response(questionId: PostStrokeSubjectiveResponse["questionId"], text: string): PostStrokeSubjectiveResponse {
  return { questionId, inputMode: "text", text };
}

const COMPLETE_RESPONSES: PostStrokeSubjectiveResponse[] = [
  response("mainDifficulty", "Trouble gripping objects."),
  response("onsetOrChange", "Started three weeks ago."),
  response("dailyImpact", "Makes cooking harder."),
  response("mostDifficultActivities", "Buttoning shirts."),
];

describe("firstIncompleteSubjectiveNarrativeScreen", () => {
  it("returns A when nothing has been answered yet", () => {
    assert.equal(firstIncompleteSubjectiveNarrativeScreen(undefined), "A");
    assert.equal(firstIncompleteSubjectiveNarrativeScreen([]), "A");
  });

  it("returns A when only some of screen A's three questions are answered", () => {
    assert.equal(
      firstIncompleteSubjectiveNarrativeScreen([response("mainDifficulty", "Trouble gripping objects.")]),
      "A",
    );
  });

  it("returns B once all three screen-A questions are answered, even if screen B is not", () => {
    const screenAOnly = COMPLETE_RESPONSES.filter((r) => r.questionId !== "mostDifficultActivities");
    assert.equal(firstIncompleteSubjectiveNarrativeScreen(screenAOnly), "B");
  });

  it("returns B once everything, including the optional question, is already complete", () => {
    assert.equal(
      firstIncompleteSubjectiveNarrativeScreen([...COMPLETE_RESPONSES, response("additionalInformation", "None.")]),
      "B",
    );
  });
});

describe("isSubjectiveNarrativeComplete", () => {
  it("is true once all four required questions are answered", () => {
    assert.equal(isSubjectiveNarrativeComplete(COMPLETE_RESPONSES), true);
  });

  it("is false when undefined, empty, or any required question is missing", () => {
    assert.equal(isSubjectiveNarrativeComplete(undefined), false);
    assert.equal(isSubjectiveNarrativeComplete([]), false);
    assert.equal(
      isSubjectiveNarrativeComplete(COMPLETE_RESPONSES.filter((r) => r.questionId !== "onsetOrChange")),
      false,
    );
  });

  it("never requires additionalInformation — it stays optional", () => {
    assert.equal(isSubjectiveNarrativeComplete(COMPLETE_RESPONSES), true);
    assert.equal(
      isSubjectiveNarrativeComplete(COMPLETE_RESPONSES.filter((r) => r.questionId !== "additionalInformation")),
      true,
    );
  });
});
