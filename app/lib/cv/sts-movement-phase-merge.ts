/**
 * Merge STS movement phases within a 1 Hz timeline bucket.
 * Preserves brief rising/returning edges when later frames in the same second settle seated/standing.
 */

import type { MotionSnapshot } from "@/app/lib/cv/motion-summary-types";

const EDGE_PHASES = new Set<MotionSnapshot["movementPhase"]>(["rising", "returning"]);

export function mergeStsMovementPhaseForBucket(
  existing: MotionSnapshot["movementPhase"] | undefined,
  incoming: MotionSnapshot["movementPhase"],
): MotionSnapshot["movementPhase"] {
  if (!existing) return incoming;
  if (EDGE_PHASES.has(existing)) return existing;
  if (EDGE_PHASES.has(incoming)) return incoming;
  return incoming;
}
