/**
 * Maps existing STS motion pilot facts into the 5×STS result contract.
 * Read-only adapter — does not run or modify detector mathematics.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { StsMotionPilotRecord } from "@/app/lib/cv/sts-motion-pilot-record";
import { classifyCompletionStateFromRepetitions } from "@/app/lib/post-stroke-objective/five-times-sts-result";
import {
  FIVE_TIMES_STS_TARGET_REPETITIONS,
  type FiveTimesStsProtocol,
  type FiveTimesStsResult,
  type FiveTimesStsTrackingQuality,
} from "@/app/lib/post-stroke-objective/types";

export type StsPilotToFiveTimesStsInput = {
  protocol: FiveTimesStsProtocol;
  pilot: StsMotionPilotRecord;
  startedAt?: string;
  completedAt?: string;
  sourceCvMetricId?: string;
};

const TRACKING_SIGNAL_MAP: Record<string, FiveTimesStsTrackingQuality> = {
  good: "high",
  fair: "medium",
  poor: "low",
  unknown: "insufficient",
  lost: "insufficient",
  mixed: "medium",
};

export function mapCvTrackingQualityToFiveTimesSts(
  trackingSignal: CvTrackingQuality | "lost" | "mixed",
): FiveTimesStsTrackingQuality {
  return TRACKING_SIGNAL_MAP[trackingSignal] ?? "insufficient";
}

export function countPilotInterruptions(pilot: StsMotionPilotRecord): number {
  const flagCount = pilot.clinicianFlags.filter((flag) =>
    flag.includes("pose_tracking_interrupted"),
  ).length;
  return flagCount;
}

export function mapStsMotionPilotToFiveTimesStsResult(
  input: StsPilotToFiveTimesStsInput,
): FiveTimesStsResult {
  const repetitionsCompleted = Math.max(0, Math.floor(input.pilot.repCount));
  const interrupted = countPilotInterruptions(input.pilot) > 0;
  const completionState = classifyCompletionStateFromRepetitions({
    protocol: input.protocol,
    repetitionsCompleted,
    interrupted,
  });

  const trunkCompensationObserved = input.pilot.clinicianFlags.some(
    (flag) =>
      flag === "possible_forward_trunk_flexion" || flag === "possible_lateral_trunk_shift",
  );

  const factualNotes = input.pilot.clinicianFlags.length
    ? [...input.pilot.clinicianFlags]
    : undefined;

  const result: FiveTimesStsResult = {
    completionState,
    repetitionsCompleted,
    targetRepetitions: FIVE_TIMES_STS_TARGET_REPETITIONS,
    timing: {
      ...(input.startedAt ? { startedAt: input.startedAt } : {}),
      ...(input.completedAt ? { completedAt: input.completedAt } : {}),
      totalDurationMs: Math.max(0, Math.round(input.pilot.durationS * 1000)),
    },
    tracking: {
      quality: mapCvTrackingQualityToFiveTimesSts(input.pilot.trackingSignal),
      interruptions: countPilotInterruptions(input.pilot),
      ...(input.pilot.clinicianFlags.includes("pose_tracking_interrupted")
        ? { interruptionReasons: ["pose_tracking_interrupted"] }
        : {}),
    },
    observations: {
      ...(trunkCompensationObserved ? { trunkCompensationObserved: true } : {}),
      ...(factualNotes ? { factualNotes } : {}),
    },
    ...(input.sourceCvMetricId ? { sourceCvMetricId: input.sourceCvMetricId } : {}),
  };

  return result;
}
