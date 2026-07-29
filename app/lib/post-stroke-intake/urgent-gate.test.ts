/**
 * Run: npx tsx --test app/lib/post-stroke-intake/urgent-gate.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateUrgentGate,
  isUrgentGateStopped,
  NO_NEW_URGENT_SYMPTOMS,
  URGENT_SYMPTOM_VALUES,
} from "./urgent-gate";
import type { PostStrokeUrgentSymptom } from "./types";

const FIXED_NOW = "2026-07-29T12:00:00.000Z";
const now = () => FIXED_NOW;

describe("isUrgentGateStopped", () => {
  it("is not stopped when only 'no_new_urgent_symptoms' is selected", () => {
    assert.equal(isUrgentGateStopped(["no_new_urgent_symptoms"]), false);
  });

  it("is not stopped when nothing has been selected yet", () => {
    assert.equal(isUrgentGateStopped([]), false);
  });

  it("stops for any single urgent symptom", () => {
    for (const symptom of URGENT_SYMPTOM_VALUES) {
      if (symptom === NO_NEW_URGENT_SYMPTOMS) continue;
      assert.equal(isUrgentGateStopped([symptom]), true, `expected ${symptom} to stop the gate`);
    }
  });

  it("stops for multiple urgent symptoms together", () => {
    assert.equal(
      isUrgentGateStopped(["chest_pain_or_shortness_of_breath", "sudden_severe_headache"]),
      true,
    );
  });

  it("fails closed when 'no_new_urgent_symptoms' is combined with a real symptom", () => {
    assert.equal(
      isUrgentGateStopped(["no_new_urgent_symptoms", "loss_of_consciousness"]),
      true,
    );
  });
});

describe("evaluateUrgentGate", () => {
  it("clears with only the clinician_review_required flag when no new urgent symptoms are reported", () => {
    const result = evaluateUrgentGate(["no_new_urgent_symptoms"], now);
    assert.equal(result.stopped, false);
    assert.deepEqual(result.flags, ["clinician_review_required"]);
    assert.deepEqual(result.symptoms, ["no_new_urgent_symptoms"]);
    assert.equal(result.recordedAt, FIXED_NOW);
  });

  it("stops and records all three required flags for a single urgent symptom", () => {
    const result = evaluateUrgentGate(["fall_with_injury"], now);
    assert.equal(result.stopped, true);
    assert.deepEqual(result.flags, [
      "urgent_symptoms_reported",
      "intake_stopped",
      "clinician_review_required",
    ]);
  });

  it("preserves every selected symptom exactly, in order, with no invented or dropped entries", () => {
    const selected: PostStrokeUrgentSymptom[] = [
      "sudden_severe_headache",
      "new_weakness_or_numbness",
      "other_sudden_deterioration",
    ];
    const result = evaluateUrgentGate(selected, now);
    assert.deepEqual(result.symptoms, selected);
  });

  it("fails closed and stops when 'no_new_urgent_symptoms' is combined with a real symptom", () => {
    const result = evaluateUrgentGate(["no_new_urgent_symptoms", "sudden_visual_change"], now);
    assert.equal(result.stopped, true);
    assert.ok(result.symptoms.includes("sudden_visual_change"));
  });

  it("records the exact timestamp supplied by the injected clock", () => {
    const result = evaluateUrgentGate(["loss_of_consciousness"], () => "2026-01-01T00:00:00.000Z");
    assert.equal(result.recordedAt, "2026-01-01T00:00:00.000Z");
  });

  it("never adds a clinical verdict — flags are only factual operational states", () => {
    const stopped = evaluateUrgentGate(["chest_pain_or_shortness_of_breath"], now);
    const cleared = evaluateUrgentGate(["no_new_urgent_symptoms"], now);
    for (const flag of [...stopped.flags, ...cleared.flags]) {
      assert.doesNotMatch(flag, /safe|unsafe|risk|cleared/i);
    }
  });
});

describe("URGENT_SYMPTOM_VALUES", () => {
  it("includes exactly the ten required values", () => {
    assert.equal(URGENT_SYMPTOM_VALUES.length, 10);
    assert.ok(URGENT_SYMPTOM_VALUES.includes("no_new_urgent_symptoms"));
  });
});
