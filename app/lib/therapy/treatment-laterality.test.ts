/**
 * Run: npx tsx --test app/lib/therapy/treatment-laterality.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import {
  ALL_SESSION_BLOCK_TYPES,
  isProductionBilateralSupported,
  planBlockLateralityExecution,
  planBlockLateralityExecutionWithResolver,
  type BlockLateralityPolicy,
  type LateralityExecutionPlan,
  type TreatmentLaterality,
} from "./treatment-laterality";

const BLOCK_TYPE: SessionBlockType = "movement-target";

function plan(
  blockPolicy: BlockLateralityPolicy,
  prescribedLaterality: TreatmentLaterality | null,
  blockType: SessionBlockType = BLOCK_TYPE,
) {
  return planBlockLateralityExecution({
    blockType,
    blockPolicy,
    prescribedLaterality,
  });
}

function bilateralSupportedResolver(): (blockType: SessionBlockType) => boolean {
  return () => true;
}

describe("planBlockLateralityExecution decision table", () => {
  it("1. not_applicable policy ignores any prescription", () => {
    for (const prescribedLaterality of [
      null,
      "left",
      "right",
      "bilateral",
      "not_applicable",
    ] as const) {
      const result = plan("not_applicable", prescribedLaterality);
      assert.deepEqual(result, {
        ok: true,
        mode: "not_applicable",
        executableSides: [],
      });
    }
  });

  it("2. bilateral policy + unsupported runtime -> unsupported_bilateral_execution", () => {
    const result = plan("bilateral", null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unsupported_bilateral_execution");
    }
  });

  it("3. bilateral policy + supported runtime -> bilateral [left, right] from catalog_block_policy", () => {
    const result = planBlockLateralityExecutionWithResolver(
      {
        blockType: BLOCK_TYPE,
        blockPolicy: "bilateral",
        prescribedLaterality: null,
      },
      bilateralSupportedResolver(),
    );
    assert.deepEqual(result, {
      ok: true,
      mode: "bilateral",
      executableSides: ["left", "right"],
      source: "catalog_block_policy",
    });
  });

  it("4. use_prescription + null -> missing_prescription", () => {
    const result = plan("use_prescription", null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "missing_prescription");
    }
  });

  it("5. use_prescription + left -> unilateral [left] from clinician_prescription", () => {
    const result = plan("use_prescription", "left");
    assert.deepEqual(result, {
      ok: true,
      mode: "unilateral",
      executableSides: ["left"],
      source: "clinician_prescription",
    });
  });

  it("6. use_prescription + right -> unilateral [right] from clinician_prescription", () => {
    const result = plan("use_prescription", "right");
    assert.deepEqual(result, {
      ok: true,
      mode: "unilateral",
      executableSides: ["right"],
      source: "clinician_prescription",
    });
  });

  it("7. use_prescription + bilateral + unsupported runtime -> unsupported_bilateral_execution", () => {
    const result = plan("use_prescription", "bilateral");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unsupported_bilateral_execution");
    }
  });

  it("8. use_prescription + bilateral + supported runtime -> bilateral [left, right] from clinician_prescription", () => {
    const result = planBlockLateralityExecutionWithResolver(
      {
        blockType: BLOCK_TYPE,
        blockPolicy: "use_prescription",
        prescribedLaterality: "bilateral",
      },
      bilateralSupportedResolver(),
    );
    assert.deepEqual(result, {
      ok: true,
      mode: "bilateral",
      executableSides: ["left", "right"],
      source: "clinician_prescription",
    });
  });

  it("9. use_prescription + not_applicable prescription -> laterality_conflict", () => {
    const result = plan("use_prescription", "not_applicable");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "laterality_conflict");
    }
  });
});

describe("production capability table", () => {
  it("marks every current block type as bilateral-unsupported", () => {
    assert.deepEqual(ALL_SESSION_BLOCK_TYPES, [
      "instructional",
      "movement-target",
      "movement-pattern",
    ]);
    for (const blockType of ALL_SESSION_BLOCK_TYPES) {
      assert.equal(isProductionBilateralSupported(blockType), false);
    }
  });

  it("applies unsupported bilateral for every production block type under bilateral policy", () => {
    for (const blockType of ALL_SESSION_BLOCK_TYPES) {
      const result = planBlockLateralityExecution({
        blockType,
        blockPolicy: "bilateral",
        prescribedLaterality: null,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.reason, "unsupported_bilateral_execution");
      }
    }
  });
});

describe("tuple ordering and safety invariants", () => {
  it("preserves left/right tuple ordering for bilateral success", () => {
    const result = planBlockLateralityExecutionWithResolver(
      {
        blockType: BLOCK_TYPE,
        blockPolicy: "bilateral",
        prescribedLaterality: null,
      },
      bilateralSupportedResolver(),
    ) as Extract<LateralityExecutionPlan, { ok: true; mode: "bilateral" }>;
    assert.deepEqual(result.executableSides, ["left", "right"]);
    assert.notDeepEqual(result.executableSides, ["right", "left"]);
  });

  it("never silently defaults missing prescription to right", () => {
    const result = plan("use_prescription", null);
    assert.notDeepEqual(result, {
      ok: true,
      mode: "unilateral",
      executableSides: ["right"],
      source: "clinician_prescription",
    });
  });

  it("does not normalize bilateral prescription to missing_prescription", () => {
    const result = plan("use_prescription", "bilateral");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.notEqual(result.reason, "missing_prescription");
    }
  });

  it("public planner cannot override production bilateral capability", () => {
    const attempts: Array<{ blockType: SessionBlockType; bilateralSupported?: boolean }> = [
      { blockType: "movement-target" },
      { blockType: "movement-pattern" },
      { blockType: "instructional" },
    ];
    for (const attempt of attempts) {
      assert.equal(
        "bilateralSupported" in attempt,
        false,
        "production input must not accept bilateralSupported overrides",
      );
      const result = planBlockLateralityExecution({
        blockType: attempt.blockType,
        blockPolicy: "bilateral",
        prescribedLaterality: null,
      });
      assert.equal(result.ok, false);
    }
  });
});

describe("exhaustive block-type coverage", () => {
  it("handles every SessionBlockType under use_prescription left without falling through", () => {
    for (const blockType of ALL_SESSION_BLOCK_TYPES) {
      const result = planBlockLateralityExecution({
        blockType,
        blockPolicy: "use_prescription",
        prescribedLaterality: "left",
      });
      assert.deepEqual(result, {
        ok: true,
        mode: "unilateral",
        executableSides: ["left"],
        source: "clinician_prescription",
      });
    }
  });
});
