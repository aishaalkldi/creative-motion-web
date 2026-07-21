import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import type { NormalizedPoint, SafeTargetBounds, TherapeuticTarget } from "./types";

export const DEFAULT_SAFE_TARGET_BOUNDS: SafeTargetBounds = {
  minX: 0.18,
  maxX: 0.82,
  minY: 0.12,
  maxY: 0.72,
};

const EDGE_MARGIN = 0.06;
const MIN_TARGET_SEPARATION = 0.12;

export function clampToSafeBounds(point: NormalizedPoint, bounds: SafeTargetBounds): NormalizedPoint {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  };
}

export function isPointInsideSafeBounds(point: NormalizedPoint, bounds: SafeTargetBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/** Clinically relevant side bias — targets appear on the patient's active reach side. */
export function resolveSideBiasedBounds(
  bounds: SafeTargetBounds,
  side: ShoulderAbductionReachSide,
): SafeTargetBounds {
  if (side === "left") {
    return { ...bounds, minX: bounds.minX, maxX: bounds.minX + (bounds.maxX - bounds.minX) * 0.55 };
  }
  return { ...bounds, minX: bounds.minX + (bounds.maxX - bounds.minX) * 0.45, maxX: bounds.maxX };
}

export type TargetGeneratorInput = {
  bounds: SafeTargetBounds;
  side: ShoulderAbductionReachSide;
  nowMs: number;
  sequence: number;
  previousTarget?: NormalizedPoint | null;
  random?: () => number;
};

export function generateTherapeuticTarget(input: TargetGeneratorInput): TherapeuticTarget {
  const biased = resolveSideBiasedBounds(input.bounds, input.side);
  const rand = input.random ?? Math.random;
  let attempt = 0;
  let point: NormalizedPoint = {
    x: biased.minX + (biased.maxX - biased.minX) * rand(),
    y: biased.minY + (biased.maxY - biased.minY) * rand(),
  };

  while (attempt < 8) {
    point = clampToSafeBounds(point, biased);
    const awayFromEdges =
      point.x >= biased.minX + EDGE_MARGIN &&
      point.x <= biased.maxX - EDGE_MARGIN &&
      point.y >= biased.minY + EDGE_MARGIN &&
      point.y <= biased.maxY - EDGE_MARGIN;
    const awayFromPrevious =
      !input.previousTarget ||
      Math.hypot(point.x - input.previousTarget.x, point.y - input.previousTarget.y) >=
        MIN_TARGET_SEPARATION;
    if (awayFromEdges && awayFromPrevious) break;
    point = {
      x: biased.minX + (biased.maxX - biased.minX) * rand(),
      y: biased.minY + (biased.maxY - biased.minY) * rand(),
    };
    attempt += 1;
  }

  return {
    id: `target-${input.sequence}-${input.nowMs}`,
    spawnedAtMs: input.nowMs,
    ...clampToSafeBounds(point, biased),
  };
}
