/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/forward-reach-assignment-request.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildForwardReachAssignmentRequest,
  EMPTY_FORWARD_REACH_SETUP_FORM,
  FORWARD_REACH_SCREEN_DEFINITION_ID,
  type ForwardReachSetupFormState,
} from "./forward-reach-assignment-request";

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";

function validForm(overrides: Partial<ForwardReachSetupFormState> = {}): ForwardReachSetupFormState {
  return {
    affectedSide: "right",
    testedSide: "right",
    startingSittingPosition: "chair_with_armrests",
    backTrunkSupport: "full_back_support",
    affectedArmSupport: "armrest",
    baselinePainScore: 2,
    permittedMovementRange: { kind: "not_applicable" },
    caregiverSupervisionRequirement: "not_required",
    patientSpecificStopCriteria: [],
    targetDirection: "forward",
    targetHeight: "shoulder height",
    targetDistance: "arm's length",
    ...overrides,
  };
}

describe("buildForwardReachAssignmentRequest — valid form", () => {
  it("builds the exact fixed-constant request shape for this slice", () => {
    const result = buildForwardReachAssignmentRequest(PATIENT_ID, validForm());
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.body.patientId, PATIENT_ID);
    assert.equal(result.body.screenDefinitionId, FORWARD_REACH_SCREEN_DEFINITION_ID);
    assert.equal(result.body.configuration.deliveryMode, "in_clinic");
    assert.deepEqual(result.body.taskAssignmentGroups, [
      {
        taskId: "forwardReach",
        testedSide: "right",
        eligible: true,
        attempts: 1,
        restPeriodSeconds: 0,
        targetPlacement: { direction: "forward", height: "shoulder height", distance: "arm's length" },
      },
    ]);
  });

  it("keeps affectedSide and testedSide independent", () => {
    const result = buildForwardReachAssignmentRequest(
      PATIENT_ID,
      validForm({ affectedSide: "left", testedSide: "right" }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.body.affectedSide, "left");
    assert.equal(result.body.taskAssignmentGroups[0].testedSide, "right");
  });

  it("accepts an explicit empty patientSpecificStopCriteria array", () => {
    const result = buildForwardReachAssignmentRequest(
      PATIENT_ID,
      validForm({ patientSpecificStopCriteria: [] }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.body.configuration.patientSpecificStopCriteria, []);
  });

  it("accepts configured permittedMovementRange with a clinician description", () => {
    const result = buildForwardReachAssignmentRequest(
      PATIENT_ID,
      validForm({
        permittedMovementRange: { kind: "configured", clinicianDescription: "limited to 45 degrees" },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.body.configuration.permittedMovementRange, {
      kind: "configured",
      clinicianDescription: "limited to 45 degrees",
    });
  });
});

describe("buildForwardReachAssignmentRequest — never fabricates missing values", () => {
  it("rejects an entirely empty form, listing every missing field", () => {
    const result = buildForwardReachAssignmentRequest(PATIENT_ID, EMPTY_FORWARD_REACH_SETUP_FORM);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(
      new Set(result.missing),
      new Set([
        "affectedSide",
        "testedSide",
        "startingSittingPosition",
        "backTrunkSupport",
        "affectedArmSupport",
        "baselinePainScore",
        "permittedMovementRange",
        "caregiverSupervisionRequirement",
        "targetDirection",
        "targetHeight",
        "targetDistance",
      ]),
    );
  });

  it("rejects a blank patientId", () => {
    const result = buildForwardReachAssignmentRequest("   ", validForm());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.missing.includes("patientId"));
  });

  const singleFieldCases: [string, Partial<ForwardReachSetupFormState>][] = [
    ["affectedSide", { affectedSide: null }],
    ["testedSide", { testedSide: null }],
    ["startingSittingPosition", { startingSittingPosition: null }],
    ["backTrunkSupport", { backTrunkSupport: null }],
    ["affectedArmSupport", { affectedArmSupport: null }],
    ["baselinePainScore", { baselinePainScore: null }],
    ["permittedMovementRange", { permittedMovementRange: null }],
    ["caregiverSupervisionRequirement", { caregiverSupervisionRequirement: null }],
    ["targetDirection", { targetDirection: "" }],
    ["targetHeight", { targetHeight: "" }],
    ["targetDistance", { targetDistance: "" }],
  ];

  for (const [field, override] of singleFieldCases) {
    it(`rejects a missing ${field} without fabricating a default`, () => {
      const result = buildForwardReachAssignmentRequest(PATIENT_ID, validForm(override));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.ok(result.missing.includes(field as never));
    });
  }

  it("baselinePainScore of 0 is a valid explicit value, not treated as missing", () => {
    const result = buildForwardReachAssignmentRequest(PATIENT_ID, validForm({ baselinePainScore: 0 }));
    assert.equal(result.ok, true);
  });
});
