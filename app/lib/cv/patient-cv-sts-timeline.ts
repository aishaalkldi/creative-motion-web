/**
 * SMT-1 — PatientCvCapture STS motion timeline lifecycle (in-memory only).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import {
  isStsMotionTimelineEnabled,
  isStsMotionTimelinePilotEnabled,
} from "@/app/lib/cv/is-sts-motion-timeline-enabled";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import {
  findForbiddenKeysInSummaryPayload,
  type SessionMotionSummary,
} from "@/app/lib/cv/motion-summary-types";
import {
  finalizeStsMotionTimelineSummary,
  legacyRepCountFromDerivedMetrics,
} from "@/app/lib/cv/sts-motion-summary-finalize";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import { buildStsTimelineTickFromCaptureState } from "@/app/lib/cv/sts-timeline-tick-builder";

export type RefBox<T> = { current: T };

export type StsTimelineCaptureRefs = {
  acc: RefBox<MotionTimelineAccumulator | null>;
  summary: RefBox<SessionMotionSummary | null>;
  finalized: RefBox<boolean>;
  /** Dev-only: snapshot count at last finalize (for console debug). */
  lastFinalizeSnapshotCount: RefBox<number | null>;
};

export function createStsTimelineCaptureRefs(): StsTimelineCaptureRefs {
  return {
    acc: { current: null },
    summary: { current: null },
    finalized: { current: false },
    lastFinalizeSnapshotCount: { current: null },
  };
}

function getOrCreateAccumulator(refs: StsTimelineCaptureRefs): MotionTimelineAccumulator {
  if (!refs.acc.current) {
    refs.acc.current = new MotionTimelineAccumulator();
  }
  return refs.acc.current;
}

export function beginStsMotionTimeline(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
): void {
  if (!isStsMotionTimelineEnabled(exerciseId)) return;
  refs.finalized.current = false;
  refs.summary.current = null;
  refs.lastFinalizeSnapshotCount.current = null;
  getOrCreateAccumulator(refs).start();
}

export function recordStsMotionTimelineTick(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
  snapshot: SitToStandDetectorSnapshot,
): void {
  if (!isStsMotionTimelineEnabled(exerciseId)) return;
  const acc = refs.acc.current;
  if (!acc?.isActive()) return;
  acc.recordTick(buildStsTimelineTickFromCaptureState(snapshot));
}

export type StsTimelineMetricsSource = {
  getDerivedMetrics(): PatientCvDerivedMetrics;
};

/**
 * Pilot save path — finalize in-memory STS timeline before cv-session-metrics POST
 * when Complete exercise runs without Stop tracking (PR43).
 */
export function tryFinalizeStsTimelineBeforePilotSave(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
  metricsSource: StsTimelineMetricsSource | null,
  isPilotEnabled: boolean,
): SessionMotionSummary | null {
  if (exerciseId !== "sit-to-stand" || !isPilotEnabled || !metricsSource) {
    return null;
  }
  return finalizeStsMotionTimelineCapture(exerciseId, refs, metricsSource);
}

export function finalizeStsMotionTimelineCapture(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
  metricsSource: StsTimelineMetricsSource,
): SessionMotionSummary | null {
  if (!isStsMotionTimelineEnabled(exerciseId)) return null;
  if (refs.finalized.current) return refs.summary.current;

  const acc = refs.acc.current;
  if (!acc) return null;

  const snapshotCount = acc.getSnapshotCount();
  const { summary } = finalizeStsMotionTimelineSummary({
    accumulator: acc,
    legacyRepCount: legacyRepCountFromDerivedMetrics(metricsSource.getDerivedMetrics()),
  });

  refs.lastFinalizeSnapshotCount.current = snapshotCount;
  refs.summary.current = summary;
  refs.finalized.current = true;
  acc.stop();
  refs.acc.current = null;

  return summary;
}

export function disposeStsMotionTimelineRefs(refs: StsTimelineCaptureRefs): void {
  refs.acc.current?.reset();
  refs.acc.current = null;
  refs.summary.current = null;
  refs.finalized.current = false;
}

/** Pilot-only skip reason when finalize returns null (browser pilot sessions). */
export function stsMotionTimelineFinalizeSkipReason(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
): string {
  if (exerciseId !== "sit-to-stand") return "not_sts_exercise";
  if (!isStsMotionTimelineEnabled(exerciseId)) return "timeline_disabled";
  if (refs.finalized.current && refs.summary.current) return "already_finalized";
  if (!refs.acc.current && refs.finalized.current) return "already_finalized_no_summary";
  if (!refs.acc.current) return "accumulator_never_started";
  return "unknown";
}

/** Developer-only — never patient-facing. */
export function logStsMotionTimelineSummaryDebug(
  summary: SessionMotionSummary | null,
  refs?: StsTimelineCaptureRefs,
): void {
  if (!summary || typeof console === "undefined") return;
  const forbiddenKeys = findForbiddenKeysInSummaryPayload(summary);
  console.info("[smt-1] session motion summary", {
    schemaVersion: summary.schemaVersion,
    sessionDurationS: summary.sessionDurationS,
    legacyRepCount: summary.legacyRepCount,
    completeRepCount: summary.completeRepCount,
    unclearRepCount: summary.unclearRepCount,
    observationCount: summary.observations.length,
    snapshotCount: refs?.lastFinalizeSnapshotCount.current ?? null,
    poseLossEventCount: summary.interruptions.poseLossEventCount,
    forbiddenKeyCount: forbiddenKeys.length,
    snapshotDerived: true,
  });
}

/** Pilot-only diagnostic when finalize produced no summary (?cvDebug=1&smtTimeline=1). */
export function logStsMotionTimelineFinalizeSkipped(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
  summary: SessionMotionSummary | null,
): void {
  if (summary || typeof console === "undefined") return;
  if (!isStsMotionTimelinePilotEnabled()) return;
  console.info("[smt-1] finalize skipped", {
    reason: stsMotionTimelineFinalizeSkipReason(exerciseId, refs),
    exerciseId,
  });
}
