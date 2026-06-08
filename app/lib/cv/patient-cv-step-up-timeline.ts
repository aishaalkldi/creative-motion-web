/**
 * SUM-1 — PatientCvCapture step up motion timeline lifecycle (in-memory only).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { isStepUpMotionPilotEnabled } from "@/app/lib/cv/cv-patient-config";
import {
  createStepUpPhaseClassifierState,
  resetStepUpPhaseClassifierState,
  type StepUpPhaseClassifierState,
} from "@/app/lib/cv/step-up-phase-classifier";
import {
  buildStepUpTimelineTickFromCaptureState,
  finalizeStepUpMotionTimelineSummary,
  StepUpMotionTimelineAccumulator,
  type StepUpSessionMotionSummary,
} from "@/app/lib/cv/step-up-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

export type RefBox<T> = { current: T };

export type StepUpTimelineCaptureRefs = {
  acc: RefBox<StepUpMotionTimelineAccumulator | null>;
  summary: RefBox<StepUpSessionMotionSummary | null>;
  finalized: RefBox<boolean>;
  lastFinalizeSnapshotCount: RefBox<number | null>;
  phaseClassifier: RefBox<StepUpPhaseClassifierState>;
};

export function createStepUpTimelineCaptureRefs(): StepUpTimelineCaptureRefs {
  return {
    acc: { current: null },
    summary: { current: null },
    finalized: { current: false },
    lastFinalizeSnapshotCount: { current: null },
    phaseClassifier: { current: createStepUpPhaseClassifierState() },
  };
}

function getOrCreateAccumulator(
  refs: StepUpTimelineCaptureRefs,
): StepUpMotionTimelineAccumulator {
  if (!refs.acc.current) {
    refs.acc.current = new StepUpMotionTimelineAccumulator();
  }
  return refs.acc.current;
}

export function beginStepUpMotionTimeline(
  exerciseId: CvY1ExerciseId,
  refs: StepUpTimelineCaptureRefs,
): void {
  if (!isStepUpMotionPilotEnabled(exerciseId)) return;
  refs.finalized.current = false;
  refs.summary.current = null;
  refs.lastFinalizeSnapshotCount.current = null;
  resetStepUpPhaseClassifierState(refs.phaseClassifier.current);
  getOrCreateAccumulator(refs).start();
}

export function recordStepUpMotionTimelineTick(
  exerciseId: CvY1ExerciseId,
  refs: StepUpTimelineCaptureRefs,
  snapshot: SitToStandDetectorSnapshot,
): void {
  if (!isStepUpMotionPilotEnabled(exerciseId)) return;
  const acc = refs.acc.current;
  if (!acc?.isActive()) return;
  acc.recordTick(
    buildStepUpTimelineTickFromCaptureState(snapshot, {
      phaseClassifier: refs.phaseClassifier.current,
    }),
  );
}

export type StepUpTimelineMetricsSource = {
  getDerivedMetrics(): PatientCvDerivedMetrics;
};

export function tryFinalizeStepUpTimelineBeforePilotSave(
  exerciseId: CvY1ExerciseId,
  refs: StepUpTimelineCaptureRefs,
  metricsSource: StepUpTimelineMetricsSource | null,
): StepUpSessionMotionSummary | null {
  if (exerciseId !== "step-up" || !metricsSource) return null;
  return finalizeStepUpMotionTimelineCapture(exerciseId, refs, metricsSource);
}

export function finalizeStepUpMotionTimelineCapture(
  exerciseId: CvY1ExerciseId,
  refs: StepUpTimelineCaptureRefs,
  metricsSource: StepUpTimelineMetricsSource,
): StepUpSessionMotionSummary | null {
  if (!isStepUpMotionPilotEnabled(exerciseId)) return null;
  if (refs.finalized.current) return refs.summary.current;

  const acc = refs.acc.current;
  if (!acc) return null;

  const snapshotCount = acc.getSnapshotCount();
  const { summary } = finalizeStepUpMotionTimelineSummary({
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

export function disposeStepUpMotionTimelineRefs(
  refs: StepUpTimelineCaptureRefs,
): void {
  refs.acc.current?.reset();
  refs.acc.current = null;
  refs.summary.current = null;
  refs.finalized.current = false;
  resetStepUpPhaseClassifierState(refs.phaseClassifier.current);
}

export function stepUpMotionTimelineFinalizeSkipReason(
  exerciseId: CvY1ExerciseId,
  refs: StepUpTimelineCaptureRefs,
): string {
  if (exerciseId !== "step-up") return "not_step_up_exercise";
  if (!isStepUpMotionPilotEnabled(exerciseId)) return "timeline_disabled";
  if (refs.finalized.current && refs.summary.current) return "already_finalized";
  if (!refs.acc.current && refs.finalized.current) return "already_finalized_no_summary";
  if (!refs.acc.current) return "accumulator_never_started";
  return "unknown";
}

export function logStepUpMotionTimelineSummaryDebug(
  summary: StepUpSessionMotionSummary | null,
  refs?: StepUpTimelineCaptureRefs,
): void {
  if (!summary || typeof console === "undefined") return;
  const forbiddenKeys = findForbiddenKeysInSummaryPayload(summary);
  console.info("[sum-1] step up session motion summary", {
    schemaVersion: summary.schemaVersion,
    sessionDurationS: summary.sessionDurationS,
    legacyRepCount: summary.legacyRepCount,
    completeRepCount: summary.completeRepCount,
    snapshotCount: refs?.lastFinalizeSnapshotCount.current ?? null,
    forbiddenKeyCount: forbiddenKeys.length,
  });
}
