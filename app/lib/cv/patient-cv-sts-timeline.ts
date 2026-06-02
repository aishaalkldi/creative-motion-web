/**
 * SMT-1 — PatientCvCapture STS motion timeline lifecycle (in-memory only).
 */

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { isStsMotionTimelineEnabled } from "@/app/lib/cv/is-sts-motion-timeline-enabled";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";
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
};

export function createStsTimelineCaptureRefs(): StsTimelineCaptureRefs {
  return {
    acc: { current: null },
    summary: { current: null },
    finalized: { current: false },
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

export function finalizeStsMotionTimelineCapture(
  exerciseId: CvY1ExerciseId,
  refs: StsTimelineCaptureRefs,
  metricsSource: StsTimelineMetricsSource,
): SessionMotionSummary | null {
  if (!isStsMotionTimelineEnabled(exerciseId)) return null;
  if (refs.finalized.current) return refs.summary.current;

  const acc = refs.acc.current;
  if (!acc) return null;

  const { summary } = finalizeStsMotionTimelineSummary({
    accumulator: acc,
    legacyRepCount: legacyRepCountFromDerivedMetrics(metricsSource.getDerivedMetrics()),
  });

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

/** Developer-only — never patient-facing. */
export function logStsMotionTimelineSummaryDebug(summary: SessionMotionSummary | null): void {
  if (!summary || typeof console === "undefined") return;
  console.debug("[smt-1] session motion summary", {
    schemaVersion: summary.schemaVersion,
    sessionDurationS: summary.sessionDurationS,
    legacyRepCount: summary.legacyRepCount,
    completeRepCount: summary.completeRepCount,
    snapshotDerived: true,
  });
}
