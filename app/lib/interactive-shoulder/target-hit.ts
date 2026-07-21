import type { NormalizedPoint, TargetHitConfig } from "./types";

export function distanceNormalized(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isWristInsideTarget(
  wrist: NormalizedPoint,
  target: NormalizedPoint,
  config: TargetHitConfig,
): boolean {
  return distanceNormalized(wrist, target) <= config.collisionRadius;
}

/**
 * Registers a hit only on wrist entry (false → true) and when the target
 * has not already been counted for this spawn.
 */
export function shouldRegisterTargetHit(
  wasInside: boolean,
  isInside: boolean,
  targetAlreadyHit: boolean,
): boolean {
  return !targetAlreadyHit && !wasInside && isInside;
}

export const DEFAULT_TARGET_HIT_CONFIG: TargetHitConfig = {
  collisionRadius: 0.08,
};
