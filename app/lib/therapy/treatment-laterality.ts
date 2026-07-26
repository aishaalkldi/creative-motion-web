import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";

export type TreatmentLaterality =
  | "left"
  | "right"
  | "bilateral"
  | "not_applicable";

export type ExecutableSide = "left" | "right";

export type BlockLateralityPolicy =
  | "use_prescription"
  | "bilateral"
  | "not_applicable";

export type LateralityExecutionSource =
  | "clinician_prescription"
  | "catalog_block_policy"
  | "legacy_fixed_adapter";

export type LateralityExecutionFailureReason =
  | "missing_prescription"
  | "unsupported_bilateral_execution"
  | "laterality_conflict";

export type LateralityExecutionPlan =
  | {
      ok: true;
      mode: "unilateral";
      executableSides: readonly [ExecutableSide];
      source: LateralityExecutionSource;
    }
  | {
      ok: true;
      mode: "bilateral";
      executableSides: readonly [ExecutableSide, ExecutableSide];
      source: LateralityExecutionSource;
    }
  | {
      ok: true;
      mode: "not_applicable";
      executableSides: readonly [];
    }
  | {
      ok: false;
      reason: LateralityExecutionFailureReason;
    };

export type PlanBlockLateralityExecutionInput = {
  blockType: SessionBlockType;
  blockPolicy: BlockLateralityPolicy;
  prescribedLaterality: TreatmentLaterality | null;
};

export type BlockBilateralCapabilityResolver = (
  blockType: SessionBlockType,
) => boolean;

/**
 * Production capability table — every current catalog block type is
 * unilateral-only at runtime. Exhaustive over SessionBlockType so new
 * block types force an explicit capability decision here.
 */
const PRODUCTION_BILATERAL_CAPABILITY_BY_BLOCK_TYPE: Record<
  SessionBlockType,
  boolean
> = {
  instructional: false,
  "movement-target": false,
  "movement-pattern": false,
};

/** Every SessionBlockType key in the production capability table. */
export const ALL_SESSION_BLOCK_TYPES = Object.keys(
  PRODUCTION_BILATERAL_CAPABILITY_BY_BLOCK_TYPE,
) as SessionBlockType[];

function resolveProductionBilateralSupported(
  blockType: SessionBlockType,
): boolean {
  return PRODUCTION_BILATERAL_CAPABILITY_BY_BLOCK_TYPE[blockType];
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

const LEFT_RIGHT_BILATERAL_SIDES = ["left", "right"] as const satisfies readonly [
  ExecutableSide,
  ExecutableSide,
];

/**
 * Capability-aware laterality execution planner for a single catalog block.
 * Pure and unwired — no persistence, UI, or orchestrator integration.
 */
export function planBlockLateralityExecution(
  input: PlanBlockLateralityExecutionInput,
): LateralityExecutionPlan {
  return planBlockLateralityExecutionWithResolver(
    input,
    resolveProductionBilateralSupported,
  );
}

/**
 * @internal Unit-test hook only — inject a capability resolver to exercise
 * future bilateral-capable block types without weakening the production table.
 * Application code must call planBlockLateralityExecution instead.
 */
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

    default:
      return assertNever(blockPolicy);
  }
}

/** Read-only view of production bilateral support for a block type. */
export function isProductionBilateralSupported(
  blockType: SessionBlockType,
): boolean {
  return resolveProductionBilateralSupported(blockType);
}
