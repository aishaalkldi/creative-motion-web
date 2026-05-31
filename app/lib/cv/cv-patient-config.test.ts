/**
 * Run: npx tsx --test app/lib/cv/cv-patient-config.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CV_Y1_ENABLED_EXERCISE_IDS,
  isCvEnabledExercise,
  PATIENT_MINI_SQUAT_CONFIG,
  PATIENT_STS_CONFIG,
} from "./cv-patient-config";

describe("cv-patient-config allowlist", () => {
  it("includes sit-to-stand and mini-squat", () => {
    assert.deepEqual(CV_Y1_ENABLED_EXERCISE_IDS, ["sit-to-stand", "mini-squat"]);
  });

  it("isCvEnabledExercise accepts allowlisted ids", () => {
    assert.equal(isCvEnabledExercise("sit-to-stand"), true);
    assert.equal(isCvEnabledExercise("mini-squat"), true);
    assert.equal(isCvEnabledExercise("MINI-SQUAT"), true);
  });

  it("rejects unknown exercises", () => {
    assert.equal(isCvEnabledExercise("single-leg-stance"), false);
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
});
