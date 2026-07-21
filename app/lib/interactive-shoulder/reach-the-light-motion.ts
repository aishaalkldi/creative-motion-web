/** Default exit transition before the next therapeutic light spawns. */
export const REACH_THE_LIGHT_HIT_EXIT_MS = 480;

/** Reduced-motion exit is instant — metrics still register once. */
export const REACH_THE_LIGHT_HIT_EXIT_REDUCED_MS = 0;

export function resolveHitExitTransitionMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? REACH_THE_LIGHT_HIT_EXIT_REDUCED_MS : REACH_THE_LIGHT_HIT_EXIT_MS;
}

export function isTargetSpawnLocked(
  spawnLockedUntilMs: number | null,
  nowMs: number,
): boolean {
  return spawnLockedUntilMs !== null && nowMs < spawnLockedUntilMs;
}
