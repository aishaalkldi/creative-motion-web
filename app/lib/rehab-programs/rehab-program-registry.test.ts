/**
 * Run: npx tsx --test app/lib/rehab-programs/rehab-program-registry.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getConditionById,
  getRehabPathwaysForCondition,
  getTreatmentProgramById,
} from "./rehab-program-registry";
import {
  NEURO_STROKE_CONDITION,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1,
} from "./stroke-upper-limb-recovery-foundation";

describe("rehab-program-registry", () => {
  it("condition -> pathway -> program relationships resolve consistently end to end", () => {
    const condition = getConditionById(NEURO_STROKE_CONDITION.id);
    assert.ok(condition);
    assert.equal(condition, NEURO_STROKE_CONDITION);

    const pathways = getRehabPathwaysForCondition(condition!.id);
    assert.equal(pathways.length, 1);
    assert.equal(pathways[0], STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY);
    assert.equal(pathways[0].conditionId, condition!.id);

    const program = getTreatmentProgramById(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1.id);
    assert.ok(program);
    assert.equal(program, STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1);
    assert.equal(program!.pathwayId, pathways[0].id);
  });

  it("getConditionById: found and not-found", () => {
    assert.equal(getConditionById("neuro-stroke"), NEURO_STROKE_CONDITION);
    assert.equal(getConditionById("does-not-exist"), null);
  });

  it("getRehabPathwaysForCondition: found and not-found", () => {
    assert.deepEqual(
      getRehabPathwaysForCondition("neuro-stroke"),
      [STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY],
    );
    assert.deepEqual(getRehabPathwaysForCondition("does-not-exist"), []);
  });

  it("getTreatmentProgramById: found and not-found", () => {
    assert.equal(
      getTreatmentProgramById("stroke-upper-limb-recovery-foundation-v1"),
      STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1,
    );
    assert.equal(getTreatmentProgramById("does-not-exist"), null);
  });
});
