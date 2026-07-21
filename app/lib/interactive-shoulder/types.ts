/** Normalized screen coordinates in [0, 1] — same space as MediaPipe landmark x/y. */
export type NormalizedPoint = {
  x: number;
  y: number;
};

export type TherapeuticTarget = NormalizedPoint & {
  id: string;
  spawnedAtMs: number;
};

export type SafeTargetBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type TargetHitConfig = {
  collisionRadius: number;
};

export type TargetHitEvent = {
  targetId: string;
  capturedAtMs: number;
  reactionTimeMs: number;
};

/** Interaction performance — separate from measured CV reps/angles. */
export type ShoulderInteractionMetrics = {
  targetsShown: number;
  targetsReached: number;
  targetHitTimestampsMs: number[];
  reactionTimesMs: number[];
};

export function createEmptyShoulderInteractionMetrics(): ShoulderInteractionMetrics {
  return {
    targetsShown: 0,
    targetsReached: 0,
    targetHitTimestampsMs: [],
    reactionTimesMs: [],
  };
}
