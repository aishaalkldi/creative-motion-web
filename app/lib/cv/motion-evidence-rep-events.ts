/**
 * Map RepQualityFsm capture records to summary builder rep events.
 */

import type { RepCaptureRecord } from "@/app/lib/cv/rep-quality-fsm";
import type { RepTimingEvent } from "@/app/lib/cv/motion-evidence.types";

export function repTimingEventsFromCaptureRecords(
  reps: readonly RepCaptureRecord[],
): RepTimingEvent[] {
  return reps.map((rep) => ({
    repIndex: rep.repIndex,
    completed: rep.completedCycle,
    durationMs: rep.durationMs,
    flags: [...rep.captureFlags],
  }));
}
