/**
 * Run: npx tsx --test app/lib/cv/cv-patient-config.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CV_Y1_ENABLED_EXERCISE_IDS,
  isCvEnabledExercise,
  isPatientCvCaptureWired,
  PATIENT_HEEL_RAISE_REP_CONFIG,
  PATIENT_MINI_SQUAT_CONFIG,
  PATIENT_STS_CONFIG,
  resolvePatientCvDetectorKind,
} from "./cv-patient-config";
import { LAB_HEEL_RAISE_REP_CONFIG } from "./heel-raise-detector";

describe("cv-patient-config allowlist", () => {
  it("includes sit-to-stand, mini-squat, single-leg-stance, and heel-raise", () => {
    assert.deepEqual(CV_Y1_ENABLED_EXERCISE_IDS, [
      "sit-to-stand",
      "mini-squat",
      "single-leg-stance",
      "heel-raise",
    ]);
  });

  it("isCvEnabledExercise accepts allowlisted ids", () => {
    assert.equal(isCvEnabledExercise("sit-to-stand"), true);
    assert.equal(isCvEnabledExercise("mini-squat"), true);
    assert.equal(isCvEnabledExercise("MINI-SQUAT"), true);
    assert.equal(isCvEnabledExercise("single-leg-stance"), true);
    assert.equal(isCvEnabledExercise("SINGLE-LEG-STANCE"), true);
  });

  it("isCvEnabledExercise accepts heel-raise", () => {
    assert.equal(isCvEnabledExercise("heel-raise"), true);
    assert.equal(isCvEnabledExercise("HEEL-RAISE"), true);
  });

  it("rejects unknown exercises", () => {
    assert.equal(isCvEnabledExercise("step-up"), false);
    assert.equal(isCvEnabledExercise(""), false);
    assert.equal(isCvEnabledExercise(null), false);
  });

  it("keeps PATIENT_STS_CONFIG unchanged from mini squat config object", () => {
    assert.notEqual(PATIENT_STS_CONFIG, PATIENT_MINI_SQUAT_CONFIG);
    assert.equal(PATIENT_STS_CONFIG.repCountingMode, "baseline");
    assert.equal(PATIENT_STS_CONFIG.minMsBetweenReps, 800);
    assert.equal(PATIENT_MINI_SQUAT_CONFIG.minMsBetweenReps, 1_000);
    assert.equal(PATIENT_MINI_SQUAT_CONFIG.prototypeVersion, "cv-y2-mini-squat");
  });

  it("keeps PATIENT_HEEL_RAISE_REP_CONFIG separate from lab config", () => {
    assert.notEqual(PATIENT_HEEL_RAISE_REP_CONFIG, LAB_HEEL_RAISE_REP_CONFIG);
    assert.equal(PATIENT_HEEL_RAISE_REP_CONFIG.minMsBetweenReps, 800);
    assert.equal(PATIENT_HEEL_RAISE_REP_CONFIG.baselineDurationMs, 3_000);
  });

  it("routes heel-raise to dedicated detector wiring", () => {
    assert.equal(resolvePatientCvDetectorKind("heel-raise"), "heel-raise");
    assert.equal(isPatientCvCaptureWired("heel-raise"), true);
  });
});
