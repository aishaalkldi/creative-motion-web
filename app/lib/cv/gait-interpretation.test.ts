/**
 * Run: npx tsx --test app/lib/cv/gait-interpretation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { GAIT_WALKING_OBSERVATION_EXERCISE_ID } from "@/app/lib/cv/gait-assessment-exercise-ids";
import {
  buildGaitAssistiveInterpretation,
  gaitInterpretationContainsForbiddenTerms,
  shouldShowGaitInterpretation,
} from "./gait-interpretation";

const BASE_METRIC: CvSessionMetricPublic = {
  id: "metric-1",
  exerciseId: GAIT_WALKING_OBSERVATION_EXERCISE_ID,
  repCount: 12,
  sessionDurationS: 24,
  trackingQuality: "good",
  movementDetected: true,
  source: "assessment_movement",
  recordedAt: "2026-06-22T10:00:00.000Z",
};

describe("shouldShowGaitInterpretation", () => {
  it("returns false for non-gait exercises", () => {
    assert.equal(
      shouldShowGaitInterpretation({ ...BASE_METRIC, exerciseId: "sit-to-stand" }),
      false,
    );
  });

  it("returns true for gait exercise with captured data", () => {
    assert.equal(shouldShowGaitInterpretation(BASE_METRIC), true);
  });
});

describe("buildGaitAssistiveInterpretation", () => {
  it("returns assistive interpretation lines and review prompts only", () => {
    const result = buildGaitAssistiveInterpretation(BASE_METRIC);
    assert.ok(result);
    assert.ok(result.interpretationLines.length > 0);
    assert.ok(result.reviewPrompts.length > 0);
    assert.match(result.disclaimer, /Therapist confirmation required/);
  });

  it("returns null when gait metric has no displayable data", () => {
    const result = buildGaitAssistiveInterpretation({
      ...BASE_METRIC,
      sessionDurationS: null,
      repCount: null,
      movementDetected: false,
    });
    assert.equal(result, null);
  });

  it("notes limited tracking without diagnosing", () => {
    const result = buildGaitAssistiveInterpretation({
      ...BASE_METRIC,
      trackingQuality: "poor",
    });
    assert.ok(result);
    assert.ok(
      result.interpretationLines.some((line) => line.includes("Camera visibility was limited")),
    );
  });

  it("does not emit forbidden pathology or diagnosis wording", () => {
    const result = buildGaitAssistiveInterpretation(BASE_METRIC);
    assert.ok(result);
    assert.deepEqual(gaitInterpretationContainsForbiddenTerms(result), []);
  });
});
