/**
 * Patient CV API allowlist validation (unit tests).
 * Run: npx tsx --test app/lib/cv/cv-patient-metrics-validation.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CV_Y2_MINI_SQUAT_PATIENT_PROTOTYPE_VERSION,
  CV_Y1B_PATIENT_PROTOTYPE_VERSION,
  CV_Y3_SINGLE_LEG_STANCE_PATIENT_PROTOTYPE_VERSION,
  CV_Y4_HEEL_RAISE_PATIENT_PROTOTYPE_VERSION,
  patientCvPrototypeVersion,
} from "@/app/lib/cv/bio-0-contracts";
import { isCvEnabledExercise } from "@/app/lib/cv/cv-patient-config";

function isAllowedPatientCvExerciseId(exerciseId: string): boolean {
  return isCvEnabledExercise(exerciseId);
}

describe("patient CV metrics allowlist (API contract)", () => {
  it("accepts sit-to-stand, mini-squat, and single-leg-stance", () => {
    assert.equal(isAllowedPatientCvExerciseId("sit-to-stand"), true);
    assert.equal(isAllowedPatientCvExerciseId("mini-squat"), true);
    assert.equal(isAllowedPatientCvExerciseId("single-leg-stance"), true);
  });

  it("rejects heel-raise and unknown exercise ids", () => {
    assert.equal(isAllowedPatientCvExerciseId("heel-raise"), false);
    assert.equal(isAllowedPatientCvExerciseId("step-up"), false);
  });

  it("maps prototype_version per exercise", () => {
    assert.equal(patientCvPrototypeVersion("sit-to-stand"), CV_Y1B_PATIENT_PROTOTYPE_VERSION);
    assert.equal(patientCvPrototypeVersion("mini-squat"), CV_Y2_MINI_SQUAT_PATIENT_PROTOTYPE_VERSION);
    assert.equal(
      patientCvPrototypeVersion("single-leg-stance"),
      CV_Y3_SINGLE_LEG_STANCE_PATIENT_PROTOTYPE_VERSION,
    );
    assert.equal(patientCvPrototypeVersion("heel-raise"), CV_Y4_HEEL_RAISE_PATIENT_PROTOTYPE_VERSION);
  });
});
