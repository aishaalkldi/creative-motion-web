/**
 * HRM-1 — PatientCvCapture heel raise motion timeline lifecycle (in-memory only).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { isHeelRaiseMotionPilotEnabled } from "@/app/lib/cv/cv-patient-config";
import {
  createHeelRaisePhaseClassifierState,
  resetHeelRaisePhaseClassifierState,
  type HeelRaisePhaseClassifierState,
} from "@/app/lib/cv/heel-raise-phase-classifier";
import {
  buildHeelRaiseTimelineTickFromCaptureState,
  finalizeHeelRaiseMotionTimelineSummary,
  HeelRaiseMotionTimelineAccumulator,
  type HeelRaiseSessionMotionSummary,
} from "@/app/lib/cv/heel-raise-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type RefBox<T> = { current: T };

export type HeelRaiseTimelineCaptureRefs = {
  acc: RefBox<HeelRaiseMotionTimelineAccumulator | null>;
  summary: RefBox<HeelRaiseSessionMotionSummary | null>;
  finalized: RefBox<boolean>;
  lastFinalizeSnapshotCount: RefBox<number | null>;
  phaseClassifier: RefBox<HeelRaisePhaseClassifierState>;
};

export function createHeelRaiseTimelineCaptureRefs(): HeelRaiseTimelineCaptureRefs {
  return {
    acc: { current: null },
    summary: { current: null },
    finalized: { current: false },
    lastFinalizeSnapshotCount: { current: null },
    phaseClassifier: { current: createHeelRaisePhaseClassifierState() },
  };
}

function getOrCreateAccumulator(
  refs: HeelRaiseTimelineCaptureRefs,
): HeelRaiseMotionTimelineAccumulator {
  if (!refs.acc.current) {
    refs.acc.current = new HeelRaiseMotionTimelineAccumulator();
  }
  return refs.acc.current;
}

export function beginHeelRaiseMotionTimeline(
  exerciseId: CvY1ExerciseId,
  refs: HeelRaiseTimelineCaptureRefs,
): void {
  if (!isHeelRaiseMotionPilotEnabled(exerciseId)) return;
  refs.finalized.current = false;
  refs.summary.current = null;
  refs.lastFinalizeSnapshotCount.current = null;
  resetHeelRaisePhaseClassifierState(refs.phaseClassifier.current);
  getOrCreateAccumulator(refs).start();
}

export function recordHeelRaiseMotionTimelineTick(
  exerciseId: CvY1ExerciseId,
  refs: HeelRaiseTimelineCaptureRefs,
  snapshot: SitToStandDetectorSnapshot,
): void {
  if (!isHeelRaiseMotionPilotEnabled(exerciseId)) return;
  const acc = refs.acc.current;
  if (!acc?.isActive()) return;
  acc.recordTick(
    buildHeelRaiseTimelineTickFromCaptureState(snapshot, {
      phaseClassifier: refs.phaseClassifier.current,
    }),
  );
}

export type HeelRaiseTimelineMetricsSource = {
  getDerivedMetrics(): PatientCvDerivedMetrics;
};

export function tryFinalizeHeelRaiseTimelineBeforePilotSave(
  exerciseId: CvY1ExerciseId,
  refs: HeelRaiseTimelineCaptureRefs,
  metricsSource: HeelRaiseTimelineMetricsSource | null,
): HeelRaiseSessionMotionSummary | null {
  if (exerciseId !== "heel-raise" || !metricsSource) return null;
  return finalizeHeelRaiseMotionTimelineCapture(exerciseId, refs, metricsSource);
}

export function finalizeHeelRaiseMotionTimelineCapture(
  exerciseId: CvY1ExerciseId,
  refs: HeelRaiseTimelineCaptureRefs,
  metricsSource: HeelRaiseTimelineMetricsSource,
): HeelRaiseSessionMotionSummary | null {
  if (!isHeelRaiseMotionPilotEnabled(exerciseId)) return null;
  if (refs.finalized.current) return refs.summary.current;

  const acc = refs.acc.current;
  if (!acc) return null;

  const snapshotCount = acc.getSnapshotCount();
  const { summary } = finalizeHeelRaiseMotionTimelineSummary({
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

export function disposeHeelRaiseMotionTimelineRefs(
  refs: HeelRaiseTimelineCaptureRefs,
): void {
  refs.acc.current?.reset();
  refs.acc.current = null;
  refs.summary.current = null;
  refs.finalized.current = false;
  resetHeelRaisePhaseClassifierState(refs.phaseClassifier.current);
}

export function heelRaiseMotionTimelineFinalizeSkipReason(
  exerciseId: CvY1ExerciseId,
  refs: HeelRaiseTimelineCaptureRefs,
): string {
  if (exerciseId !== "heel-raise") return "not_heel_raise_exercise";
  if (!isHeelRaiseMotionPilotEnabled(exerciseId)) return "timeline_disabled";
  if (refs.finalized.current && refs.summary.current) return "already_finalized";
  if (!refs.acc.current && refs.finalized.current) return "already_finalized_no_summary";
  if (!refs.acc.current) return "accumulator_never_started";
  return "unknown";
}

export function logHeelRaiseMotionTimelineSummaryDebug(
  summary: HeelRaiseSessionMotionSummary | null,
  refs?: HeelRaiseTimelineCaptureRefs,
): void {
  if (!summary || typeof console === "undefined") return;
  const forbiddenKeys = findForbiddenKeysInSummaryPayload(summary);
  console.info("[hrm-1] heel raise session motion summary", {
    schemaVersion: summary.schemaVersion,
    sessionDurationS: summary.sessionDurationS,
    legacyRepCount: summary.legacyRepCount,
    completeRepCount: summary.completeRepCount,
    snapshotCount: refs?.lastFinalizeSnapshotCount.current ?? null,
    forbiddenKeyCount: forbiddenKeys.length,
  });
}
