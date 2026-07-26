import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import { planBlockLateralityExecutionWithResolver } from "./treatment-laterality.internal";

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

export const ALL_SESSION_BLOCK_TYPES = [
  "instructional",
  "movement-target",
  "movement-pattern",
] as const satisfies readonly SessionBlockType[];

type MissingSessionBlockTypes = Exclude<
  SessionBlockType,
  (typeof ALL_SESSION_BLOCK_TYPES)[number]
>;

const _assertAllSessionBlockTypesListed: MissingSessionBlockTypes extends never
  ? true
  : never = true;

/**
 * Production capability table — every current catalog block type is
 * unilateral-only at runtime. Exhaustive over SessionBlockType so new
 * block types force an explicit capability decision here.
 */
const PRODUCTION_BILATERAL_CAPABILITY_BY_BLOCK_TYPE = {
  instructional: false,
  "movement-target": false,
  "movement-pattern": false,
} satisfies Record<SessionBlockType, boolean>;

function resolveProductionBilateralSupported(
  blockType: SessionBlockType,
): boolean {
  return PRODUCTION_BILATERAL_CAPABILITY_BY_BLOCK_TYPE[blockType];
}

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

/** Read-only view of production bilateral support for a block type. */
export function isProductionBilateralSupported(
  blockType: SessionBlockType,
): boolean {
  return resolveProductionBilateralSupported(blockType);
}
