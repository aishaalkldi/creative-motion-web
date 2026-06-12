/**
 * Convert STS biomechanical attempt summaries into assistive rep timing records.
 */

import type { StsRepTimingRecord } from "@/app/lib/cv/motion-summary-types";
import type { StsAttemptSummary } from "@/app/lib/cv/sts-biomechanical-capture-fsm";

export function deriveStsRepTimingRecordsFromAttempts(
  attempts: readonly StsAttemptSummary[],
): StsRepTimingRecord[] {
  return attempts.map((attempt) => {
    const captureFlags: string[] = [];

    if (attempt.attemptType === "complete") {
      captureFlags.push("complete_rep");
    }
    if (attempt.attemptType === "partial") {
      captureFlags.push("partial_attempt");
      if (!attempt.standingReached) captureFlags.push("incomplete_stand");
      if (attempt.standingReached && !attempt.seatedReturnReached) {
        captureFlags.push("incomplete_return");
      }
    }
    if (attempt.attemptType === "unclear") {
      captureFlags.push("unclear_attempt");
      captureFlags.push("unclear_phase_detection");
    }
    if (attempt.confidence === "low") {
      captureFlags.push("limited_camera_evidence");
    }

    return {
      repIndex: attempt.attemptIndex,
      completed: attempt.attemptType === "complete",
      durationMs: attempt.phaseDurationsMs.cycle,
      captureFlags: [...new Set(captureFlags)].sort(),
    };
  });
}

export function countStsAttemptTypes(attempts: readonly StsAttemptSummary[]): {
  complete: number;
  partial: number;
  unclear: number;
} {
  let complete = 0;
  let partial = 0;
  let unclear = 0;
  for (const attempt of attempts) {
    if (attempt.attemptType === "complete") complete += 1;
    else if (attempt.attemptType === "partial") partial += 1;
    else unclear += 1;
  }
  return { complete, partial, unclear };
}
