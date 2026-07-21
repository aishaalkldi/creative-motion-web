import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import type { MovementBlockSide } from "@/app/lib/session-orchestrator/types";

/**
 * Temporary product fallback when neither a prescribed exercise side nor a
 * movement-block side is available. Bilateral block configuration also falls
 * back here until bilateral target layouts are supported.
 */
export const INTERACTIVE_SHOULDER_DEFAULT_SIDE: ShoulderAbductionReachSide = "right";

export type InteractiveShoulderSideSource = "prescribed" | "block" | "fallback";

export type ResolvedInteractiveShoulderSide = {
  side: ShoulderAbductionReachSide;
  source: InteractiveShoulderSideSource;
  /** True when the named default constant was used (block/prescribed unavailable or non-unilateral). */
  usedFallback: boolean;
};

function normalizeUnilateralSide(
  value: string | MovementBlockSide | null | undefined,
): ShoulderAbductionReachSide | null {
  if (value === "left" || value === "right") return value;
  return null;
}

/**
 * Resolves the therapeutic reach side for interactive shoulder sessions.
 *
 * Priority:
 * 1. `prescribedSide` when it is a supported left/right value (future-safe —
 *    callers may pass an existing session field when one becomes available).
 * 2. `blockSide` from the interactive SessionDefinition movement block.
 * 3. `INTERACTIVE_SHOULDER_DEFAULT_SIDE` (documented temporary limitation).
 */
export function resolveInteractiveShoulderSide(input: {
  prescribedSide?: string | null;
  blockSide?: MovementBlockSide | null;
}): ResolvedInteractiveShoulderSide {
  const fromPrescribed = normalizeUnilateralSide(input.prescribedSide);
  if (fromPrescribed) {
    return { side: fromPrescribed, source: "prescribed", usedFallback: false };
  }

  const fromBlock = normalizeUnilateralSide(input.blockSide ?? undefined);
  if (fromBlock) {
    return { side: fromBlock, source: "block", usedFallback: false };
  }

  return {
    side: INTERACTIVE_SHOULDER_DEFAULT_SIDE,
    source: "fallback",
    usedFallback: true,
  };
}
