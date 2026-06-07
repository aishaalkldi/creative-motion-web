/**
 * Derive assistive STS rep timing records from 1 Hz motion timeline snapshots.
 * No landmarks, video, or clinical scoring.
 */

import type { MotionSnapshot, StsRepTimingRecord } from "@/app/lib/cv/motion-summary-types";

const ACTIVE_CYCLE_PHASES = new Set<MotionSnapshot["movementPhase"]>([
  "rising",
  "standing",
  "returning",
]);

function sortedSnapshots(snapshots: readonly MotionSnapshot[]): MotionSnapshot[] {
  return [...snapshots].sort((a, b) => a.tSec - b.tSec);
}

function hasRepCompletedEvent(snap: MotionSnapshot): boolean {
  return snap.events.includes("rep_completed");
}

/**
 * Build rep timing records from rep_completed events and observed phase cycles.
 */
export function deriveStsRepTimingRecordsFromSnapshots(
  snapshots: readonly MotionSnapshot[],
): StsRepTimingRecord[] {
  const sorted = sortedSnapshots(snapshots);
  if (sorted.length === 0) return [];

  const records: StsRepTimingRecord[] = [];
  let cycleStartSec = sorted[0]!.tSec;
  let prevRepCount = 0;

  for (const snap of sorted) {
    const repIncreased = snap.repCount > prevRepCount;
    const repEvent = hasRepCompletedEvent(snap);

    if (repIncreased || repEvent) {
      const durationMs = Math.max(1000, (snap.tSec - cycleStartSec) * 1000);
      const captureFlags = ["complete_rep"];
      if (!snap.posePresent) captureFlags.push("unclear_visibility");

      records.push({
        repIndex: Math.max(snap.repCount, records.length + 1),
        completed: true,
        durationMs,
        captureFlags,
      });

      cycleStartSec = snap.tSec;
      prevRepCount = Math.max(prevRepCount, snap.repCount);
    }
  }

  const lastSnap = sorted[sorted.length - 1]!;
  const openCycleSnaps = sorted.filter((s) => s.tSec > cycleStartSec);
  const openCycleActive = openCycleSnaps.some((s) => ACTIVE_CYCLE_PHASES.has(s.movementPhase));

  if (openCycleActive && lastSnap.repCount === prevRepCount) {
    records.push({
      repIndex: records.length + 1,
      completed: false,
      durationMs: null,
      captureFlags: ["incomplete_cycle", "unclear_phase_detection"],
    });
  }

  return records;
}
