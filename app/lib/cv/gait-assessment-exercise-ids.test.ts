/**
 * Run: npx tsx --test app/lib/cv/gait-assessment-exercise-ids.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GAIT_WALKING_OBSERVATION_EXERCISE_ID,
  isGaitAssessmentExerciseId,
} from "./gait-assessment-exercise-ids";

describe("gait assessment exercise id filter", () => {
  it("matches primary walking observation id", () => {
    assert.equal(isGaitAssessmentExerciseId(GAIT_WALKING_OBSERVATION_EXERCISE_ID), true);
    assert.equal(isGaitAssessmentExerciseId("GAIT-WALKING-OBSERVATION"), true);
  });

  it("matches future gait-walking- prefixed ids", () => {
    assert.equal(isGaitAssessmentExerciseId("gait-walking-v2"), true);
  });

  it("rejects non-gait exercise ids", () => {
    assert.equal(isGaitAssessmentExerciseId("sit-to-stand"), false);
    assert.equal(isGaitAssessmentExerciseId("heel-raise"), false);
    assert.equal(isGaitAssessmentExerciseId(""), false);
  });
});
