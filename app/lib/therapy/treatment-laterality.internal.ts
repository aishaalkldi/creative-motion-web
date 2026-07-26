/**
 * Internal laterality planner core — not part of the public application API.
 * Imported only by treatment-laterality.ts and treatment-laterality.test.ts.
 */
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import type {
  ExecutableSide,
  LateralityExecutionPlan,
  PlanBlockLateralityExecutionInput,
  TreatmentLaterality,
} from "./treatment-laterality";

export type BlockBilateralCapabilityResolver = (
  blockType: SessionBlockType,
) => boolean;

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

const LEFT_RIGHT_BILATERAL_SIDES = ["left", "right"] as const satisfies readonly [
  ExecutableSide,
  ExecutableSide,
];

export function planBlockLateralityExecutionWithResolver(
  input: PlanBlockLateralityExecutionInput,
  resolveBilateralSupported: BlockBilateralCapabilityResolver,
): LateralityExecutionPlan {
  const { blockType, blockPolicy, prescribedLaterality } = input;
  const bilateralSupported = resolveBilateralSupported(blockType);

  switch (blockPolicy) {
    case "not_applicable":
      return {
        ok: true,
        mode: "not_applicable",
        executableSides: [],
      };

    case "bilateral":
      if (!bilateralSupported) {
        return { ok: false, reason: "unsupported_bilateral_execution" };
      }
      return {
        ok: true,
        mode: "bilateral",
        executableSides: LEFT_RIGHT_BILATERAL_SIDES,
        source: "catalog_block_policy",
      };

    case "use_prescription":
      if (prescribedLaterality === null) {
        return { ok: false, reason: "missing_prescription" };
      }
      return planUsePrescriptionLaterality(
        prescribedLaterality,
        bilateralSupported,
      );

    default:
      return assertNever(blockPolicy);
  }
}

function planUsePrescriptionLaterality(
  prescribedLaterality: TreatmentLaterality,
  bilateralSupported: boolean,
): LateralityExecutionPlan {
  switch (prescribedLaterality) {
    case "left":
      return {
        ok: true,
        mode: "unilateral",
        executableSides: ["left"],
        source: "clinician_prescription",
      };
    case "right":
      return {
        ok: true,
        mode: "unilateral",
        executableSides: ["right"],
        source: "clinician_prescription",
      };
    case "bilateral":
      if (!bilateralSupported) {
        return { ok: false, reason: "unsupported_bilateral_execution" };
      }
      return {
        ok: true,
        mode: "bilateral",
        executableSides: LEFT_RIGHT_BILATERAL_SIDES,
        source: "clinician_prescription",
      };
    case "not_applicable":
      return { ok: false, reason: "laterality_conflict" };
    default:
      return assertNever(prescribedLaterality);
  }
}
