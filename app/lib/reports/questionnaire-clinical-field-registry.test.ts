/**
 * Run: npx tsx --test app/lib/reports/questionnaire-clinical-field-registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getQuestionnaireFieldSpec } from "./questionnaire-clinical-field-registry";

describe("questionnaire clinical field registry", () => {
  it("maps painLocation to anatomical region", () => {
    const spec = getQuestionnaireFieldSpec("painLocation");
    assert.ok(spec);
    assert.equal(spec.clinicalConcept, "anatomical_region");
    assert.equal(spec.valueType, "anatomical");
  });

  it("maps dailyImpact to functional impact not anatomical region", () => {
    const spec = getQuestionnaireFieldSpec("dailyImpact");
    assert.ok(spec);
    assert.equal(spec.clinicalConcept, "functional_daily_impact");
    assert.notEqual(spec.clinicalConcept, "anatomical_region");
  });

  it("maps standingDuration to temporal tolerance", () => {
    const spec = getQuestionnaireFieldSpec("standingDuration");
    assert.ok(spec);
    assert.equal(spec.clinicalConcept, "standing_tolerance");
    assert.equal(spec.valueType, "temporal");
  });
});
