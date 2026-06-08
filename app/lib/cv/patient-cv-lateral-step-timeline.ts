/**
 * SUM-1 — PatientCvCapture lateral step motion timeline lifecycle (in-memory only).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { isLateralStepMotionPilotEnabled } from "@/app/lib/cv/cv-patient-config";
import {
  createLateralStepPhaseClassifierState,
  resetLateralStepPhaseClassifierState,
  type LateralStepPhaseClassifierState,
} from "@/app/lib/cv/lateral-step-phase-classifier";
import {
  buildLateralStepTimelineTickFromCaptureState,
  finalizeLateralStepMotionTimelineSummary,
  LateralStepMotionTimelineAccumulator,
  type LateralStepSessionMotionSummary,
} from "@/app/lib/cv/lateral-step-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type RefBox<T> = { current: T };

export type LateralStepTimelineCaptureRefs = {
  acc: RefBox<LateralStepMotionTimelineAccumulator | null>;
  summary: RefBox<LateralStepSessionMotionSummary | null>;
  finalized: RefBox<boolean>;
  lastFinalizeSnapshotCount: RefBox<number | null>;
  phaseClassifier: RefBox<LateralStepPhaseClassifierState>;
};

export function createLateralStepTimelineCaptureRefs(): LateralStepTimelineCaptureRefs {
  return {
    acc: { current: null },
    summary: { current: null },
    finalized: { current: false },
    lastFinalizeSnapshotCount: { current: null },
    phaseClassifier: { current: createLateralStepPhaseClassifierState() },
  };
}

function getOrCreateAccumulator(
  refs: LateralStepTimelineCaptureRefs,
): LateralStepMotionTimelineAccumulator {
  if (!refs.acc.current) {
    refs.acc.current = new LateralStepMotionTimelineAccumulator();
  }
  return refs.acc.current;
}

export function beginLateralStepMotionTimeline(
  exerciseId: CvY1ExerciseId,
  refs: LateralStepTimelineCaptureRefs,
): void {
  if (!isLateralStepMotionPilotEnabled(exerciseId)) return;
  refs.finalized.current = false;
  refs.summary.current = null;
  refs.lastFinalizeSnapshotCount.current = null;
  resetLateralStepPhaseClassifierState(refs.phaseClassifier.current);
  getOrCreateAccumulator(refs).start();
}

export function recordLateralStepMotionTimelineTick(
  exerciseId: CvY1ExerciseId,
  refs: LateralStepTimelineCaptureRefs,
  snapshot: SitToStandDetectorSnapshot,
): void {
  if (!isLateralStepMotionPilotEnabled(exerciseId)) return;
  const acc = refs.acc.current;
  if (!acc?.isActive()) return;
  acc.recordTick(
    buildLateralStepTimelineTickFromCaptureState(snapshot, {
      phaseClassifier: refs.phaseClassifier.current,
    }),
  );
}

export type LateralStepTimelineMetricsSource = {
  getDerivedMetrics(): PatientCvDerivedMetrics;
};

export function tryFinalizeLateralStepTimelineBeforePilotSave(
  exerciseId: CvY1ExerciseId,
  refs: LateralStepTimelineCaptureRefs,
  metricsSource: LateralStepTimelineMetricsSource | null,
): LateralStepSessionMotionSummary | null {
  if (exerciseId !== "lateral-step" || !metricsSource) return null;
  return finalizeLateralStepMotionTimelineCapture(exerciseId, refs, metricsSource);
}

export function finalizeLateralStepMotionTimelineCapture(
  exerciseId: CvY1ExerciseId,
  refs: LateralStepTimelineCaptureRefs,
  metricsSource: LateralStepTimelineMetricsSource,
): LateralStepSessionMotionSummary | null {
  if (!isLateralStepMotionPilotEnabled(exerciseId)) return null;
  if (refs.finalized.current) return refs.summary.current;

  const acc = refs.acc.current;
  if (!acc) return null;

  const snapshotCount = acc.getSnapshotCount();
  const { summary } = finalizeLateralStepMotionTimelineSummary({
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

export function disposeLateralStepMotionTimelineRefs(
  refs: LateralStepTimelineCaptureRefs,
): void {
  refs.acc.current?.reset();
  refs.acc.current = null;
  refs.summary.current = null;
  refs.finalized.current = false;
  resetLateralStepPhaseClassifierState(refs.phaseClassifier.current);
}

export function lateralStepMotionTimelineFinalizeSkipReason(
  exerciseId: CvY1ExerciseId,
  refs: LateralStepTimelineCaptureRefs,
): string {
  if (exerciseId !== "lateral-step") return "not_lateral_step_exercise";
  if (!isLateralStepMotionPilotEnabled(exerciseId)) return "timeline_disabled";
  if (refs.finalized.current && refs.summary.current) return "already_finalized";
  if (!refs.acc.current && refs.finalized.current) return "already_finalized_no_summary";
  if (!refs.acc.current) return "accumulator_never_started";
  return "unknown";
}

export function logLateralStepMotionTimelineSummaryDebug(
  summary: LateralStepSessionMotionSummary | null,
  refs?: LateralStepTimelineCaptureRefs,
): void {
  if (!summary || typeof console === "undefined") return;
  const forbiddenKeys = findForbiddenKeysInSummaryPayload(summary);
  console.info("[lsm-1] lateral step session motion summary", {
    schemaVersion: summary.schemaVersion,
    sessionDurationS: summary.sessionDurationS,
    legacyRepCount: summary.legacyRepCount,
    completeRepCount: summary.completeRepCount,
    snapshotCount: refs?.lastFinalizeSnapshotCount.current ?? null,
    forbiddenKeyCount: forbiddenKeys.length,
  });
}
