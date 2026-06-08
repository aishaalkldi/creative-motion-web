/**
 * FRM-1 - PatientCvCapture functional reach motion timeline lifecycle (in-memory only).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { isFunctionalReachMotionPilotEnabled } from "@/app/lib/cv/cv-patient-config";
import {
  createFunctionalReachPhaseClassifierState,
  resetFunctionalReachPhaseClassifierState,
  type FunctionalReachPhaseClassifierState,
} from "@/app/lib/cv/functional-reach-phase-classifier";
import {
  buildFunctionalReachTimelineTickFromCaptureState,
  finalizeFunctionalReachMotionTimelineSummary,
  FunctionalReachMotionTimelineAccumulator,
  type FunctionalReachSessionMotionSummary,
} from "@/app/lib/cv/functional-reach-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type RefBox<T> = { current: T };

export type FunctionalReachTimelineCaptureRefs = {
  acc: RefBox<FunctionalReachMotionTimelineAccumulator | null>;
  summary: RefBox<FunctionalReachSessionMotionSummary | null>;
  finalized: RefBox<boolean>;
  lastFinalizeSnapshotCount: RefBox<number | null>;
  phaseClassifier: RefBox<FunctionalReachPhaseClassifierState>;
};

export function createFunctionalReachTimelineCaptureRefs(): FunctionalReachTimelineCaptureRefs {
  return {
    acc: { current: null },
    summary: { current: null },
    finalized: { current: false },
    lastFinalizeSnapshotCount: { current: null },
    phaseClassifier: { current: createFunctionalReachPhaseClassifierState() },
  };
}

function getOrCreateAccumulator(
  refs: FunctionalReachTimelineCaptureRefs,
): FunctionalReachMotionTimelineAccumulator {
  if (!refs.acc.current) {
    refs.acc.current = new FunctionalReachMotionTimelineAccumulator();
  }
  return refs.acc.current;
}

export function beginFunctionalReachMotionTimeline(
  exerciseId: CvY1ExerciseId,
  refs: FunctionalReachTimelineCaptureRefs,
): void {
  if (!isFunctionalReachMotionPilotEnabled(exerciseId)) return;
  refs.finalized.current = false;
  refs.summary.current = null;
  refs.lastFinalizeSnapshotCount.current = null;
  resetFunctionalReachPhaseClassifierState(refs.phaseClassifier.current);
  getOrCreateAccumulator(refs).start();
}

export function recordFunctionalReachMotionTimelineTick(
  exerciseId: CvY1ExerciseId,
  refs: FunctionalReachTimelineCaptureRefs,
  snapshot: SitToStandDetectorSnapshot,
): void {
  if (!isFunctionalReachMotionPilotEnabled(exerciseId)) return;
  const acc = refs.acc.current;
  if (!acc?.isActive()) return;
  acc.recordTick(
    buildFunctionalReachTimelineTickFromCaptureState(snapshot, {
      phaseClassifier: refs.phaseClassifier.current,
    }),
  );
}

export type FunctionalReachTimelineMetricsSource = {
  getDerivedMetrics(): PatientCvDerivedMetrics;
};

export function tryFinalizeFunctionalReachTimelineBeforePilotSave(
  exerciseId: CvY1ExerciseId,
  refs: FunctionalReachTimelineCaptureRefs,
  metricsSource: FunctionalReachTimelineMetricsSource | null,
): FunctionalReachSessionMotionSummary | null {
  if (exerciseId !== "functional-reach" || !metricsSource) return null;
  return finalizeFunctionalReachMotionTimelineCapture(exerciseId, refs, metricsSource);
}

export function finalizeFunctionalReachMotionTimelineCapture(
  exerciseId: CvY1ExerciseId,
  refs: FunctionalReachTimelineCaptureRefs,
  metricsSource: FunctionalReachTimelineMetricsSource,
): FunctionalReachSessionMotionSummary | null {
  if (!isFunctionalReachMotionPilotEnabled(exerciseId)) return null;
  if (refs.finalized.current) return refs.summary.current;

  const acc = refs.acc.current;
  if (!acc) return null;

  const snapshotCount = acc.getSnapshotCount();
  const { summary } = finalizeFunctionalReachMotionTimelineSummary({
    accumulator: acc,
    legacyRepCount: Math.max(0, metricsSource.getDerivedMetrics().repCount ?? 0),
  });

  refs.lastFinalizeSnapshotCount.current = snapshotCount;
  refs.summary.current = summary;
  refs.finalized.current = true;
  acc.stop();
  refs.acc.current = null;

  return summary;
}

export function disposeFunctionalReachMotionTimelineRefs(
  refs: FunctionalReachTimelineCaptureRefs,
): void {
  refs.acc.current?.reset();
  refs.acc.current = null;
  refs.summary.current = null;
  refs.finalized.current = false;
  resetFunctionalReachPhaseClassifierState(refs.phaseClassifier.current);
}

export function functionalReachMotionTimelineFinalizeSkipReason(
  exerciseId: CvY1ExerciseId,
  refs: FunctionalReachTimelineCaptureRefs,
): string {
  if (exerciseId !== "functional-reach") return "not_functional_reach_exercise";
  if (!isFunctionalReachMotionPilotEnabled(exerciseId)) return "timeline_disabled";
  if (refs.finalized.current && refs.summary.current) return "already_finalized";
  if (!refs.acc.current && refs.finalized.current) return "already_finalized_no_summary";
  if (!refs.acc.current) return "accumulator_never_started";
  return "unknown";
}

export function logFunctionalReachMotionTimelineSummaryDebug(
  summary: FunctionalReachSessionMotionSummary | null,
  refs?: FunctionalReachTimelineCaptureRefs,
): void {
  if (!summary || typeof console === "undefined") return;
  const forbiddenKeys = findForbiddenKeysInSummaryPayload(summary);
  console.info("[frm-1] functional reach session motion summary", {
    schemaVersion: summary.schemaVersion,
    sessionDurationS: summary.sessionDurationS,
    legacyRepCount: summary.legacyRepCount,
    completeRepCount: summary.completeRepCount,
    snapshotCount: refs?.lastFinalizeSnapshotCount.current ?? null,
    forbiddenKeyCount: forbiddenKeys.length,
  });
}
