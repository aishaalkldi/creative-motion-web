/**
 * SMT-1 — Build in-memory SessionMotionSummary from timeline accumulator (never persisted in PR3b).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import {
  findForbiddenKeysInSummaryPayload,
  type SessionMotionSummary,
} from "@/app/lib/cv/motion-summary-types";
import { buildStsSessionMotionSummary } from "@/app/lib/cv/sts-motion-summary-builder";
import { deriveStsRepTimingRecordsFromSnapshots } from "@/app/lib/cv/sts-rep-records-from-snapshots";

export type StsMotionSummaryFinalizeInput = {
  accumulator: MotionTimelineAccumulator;
  legacyRepCount: number;
  capturedAt?: string;
};

export type StsMotionSummaryFinalizeResult = {
  summary: SessionMotionSummary;
  forbiddenKeys: string[];
};

export function finalizeStsMotionTimelineSummary(
  input: StsMotionSummaryFinalizeInput,
): StsMotionSummaryFinalizeResult {
  const snapshots = input.accumulator.getSnapshots();
  const repRecords = deriveStsRepTimingRecordsFromSnapshots(snapshots);

  const summary = buildStsSessionMotionSummary({
    snapshots,
    legacyRepCount: input.legacyRepCount,
    repRecords,
    capturedAt: input.capturedAt,
  });

  return {
    summary,
    forbiddenKeys: findForbiddenKeysInSummaryPayload(summary),
  };
}

export function legacyRepCountFromDerivedMetrics(
  metrics: PatientCvDerivedMetrics,
): number {
  return metrics.repCount;
}
