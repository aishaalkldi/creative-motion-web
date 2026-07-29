/**
 * Run: npx tsx --test app/lib/post-stroke-intake/types.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getVisibleAssistanceTypes,
  isAssistanceTypeValidForRespondent,
  isValidPostStrokeAssistanceType,
  isValidPostStrokeRespondentType,
  shouldShowAssistanceTypeSection,
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
