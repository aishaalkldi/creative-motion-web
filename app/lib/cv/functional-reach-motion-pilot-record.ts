/**
 * LSM pilot - safe Motion Evidence Record for motion_quality.frPilot (Functional Reach only).
 * No video, images, landmarks, diagnosis, or treatment advice.
 */

import type { CvTrackingQuality, FunctionalReachDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { FunctionalReachSessionMotionSummary } from "@/app/lib/cv/functional-reach-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";

export const FUNCTIONAL_REACH_MOTION_PILOT_VERSION = "frm-1" as const;

export type FrPilotEvidenceMode = "persisted" | "synthesized";

export const FUNCTIONAL_REACH_LIMITED_MOTION_EVIDENCE_LABEL = "Limited motion evidence";

export const FUNCTIONAL_REACH_CYCLE_TIMING_ESTIMATED_NOTE =
  "Cycle timing estimated from session duration and detected reps.";

export type FunctionalReachMotionPilotPhaseRatios = Partial<
  Record<
    "standing" | "reaching_forward" | "peak_reach" | "returning" | "rest" | "unknown",
    number
  >
>;

export type FunctionalReachMotionPilotRepTimings = {
  avgS: number | null;
  fastestS: number | null;
  slowestS: number | null;
};

export type FunctionalReachMotionPilotVisibilityRatios = {
  hip: number;
  knee: number;
  ankle: number;
};

export type FunctionalReachMotionPilotRecord = {
  pilotVersion: typeof FUNCTIONAL_REACH_MOTION_PILOT_VERSION;
  isPilot: true;
  exerciseId: "functional-reach";
  snapshotCount: number;
  durationS: number;
  repCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  movementDetected: boolean;
  phaseRatios: FunctionalReachMotionPilotPhaseRatios;
  repTimings: FunctionalReachMotionPilotRepTimings;
  visibilityRatios: FunctionalReachMotionPilotVisibilityRatios;
  clinicianFlags: string[];
  reviewRequired: true;
  reviewReason: string;
  disclaimer: string;
};

export const FUNCTIONAL_REACH_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS = [
  "pilotVersion",
  "isPilot",
  "exerciseId",
  "snapshotCount",
  "durationS",
  "repCount",
  "completeReps",
  "unclearReps",
  "trackingSignal",
  "movementDetected",
  "phaseRatios",
  "repTimings",
  "visibilityRatios",
  "clinicianFlags",
  "reviewRequired",
  "reviewReason",
  "disclaimer",
] as const satisfies readonly (keyof FunctionalReachMotionPilotRecord)[];

export type BuildFunctionalReachMotionPilotRecordInput = {
  metrics: FunctionalReachDerivedMetrics;
  snapshotCount?: number;
  completeReps?: number;
  unclearReps?: number;
  phaseRatios?: FunctionalReachMotionPilotPhaseRatios;
  repTimings?: FunctionalReachMotionPilotRepTimings;
  visibilityRatios?: FunctionalReachMotionPilotVisibilityRatios;
  clinicianFlags?: string[];
};

function roundTiming(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeTrackingSignal(
  quality: CvTrackingQuality | string | null | undefined,
): CvTrackingQuality | "lost" | "mixed" {
  const normalized = quality?.trim().toLowerCase();
  if (normalized === "good" || normalized === "fair" || normalized === "poor") {
    return normalized;
  }
  if (normalized === "lost") return "lost";
  if (normalized === "mixed") return "mixed";
  return "unknown";
}

const MOTION_PHASE_KEYS = ["reaching_forward", "peak_reach", "returning"] as const;

function buildPhaseDetectionFlags(
  phaseRatios: FunctionalReachMotionPilotPhaseRatios,
  completeRepCount: number,
): string[] {
  const flags: string[] = [];
  const motionPhasePct = MOTION_PHASE_KEYS.reduce(
    (sum, phase) => sum + (phaseRatios[phase] ?? 0),
    0,
  );
  const unknownPct = phaseRatios.unknown ?? 0;
  const restPct = phaseRatios.rest ?? 0;

  if (completeRepCount > 0 && motionPhasePct === 0) {
    flags.push("unclear_phase_detection");
  }
  if (unknownPct + restPct >= 60) {
    flags.push("limited_observed_phases");
  }
  if (
    completeRepCount > 0 &&
    (phaseRatios.reaching_forward ?? 0) === 0 &&
    (phaseRatios.returning ?? 0) === 0
  ) {
    flags.push("partial_phase_cycle");
  }

  return flags;
}

function buildClinicianFlags(
  input: BuildFunctionalReachMotionPilotRecordInput,
  completeReps: number,
): string[] {
  const flags = new Set<string>(input.clinicianFlags ?? []);
  const unclearReps = input.unclearReps ?? 0;
  if (unclearReps > 0) flags.add("unclear_reps_recorded");
  for (const flag of buildPhaseDetectionFlags(input.phaseRatios ?? {}, completeReps)) {
    flags.add(flag);
  }
  return [...flags].sort();
}

export function buildFunctionalReachMotionPilotRecord(
  input: BuildFunctionalReachMotionPilotRecordInput,
): FunctionalReachMotionPilotRecord {
  const { metrics } = input;
  const completeReps = Math.max(0, Math.floor(input.completeReps ?? metrics.repCount));
  const unclearReps = Math.max(0, Math.floor(input.unclearReps ?? 0));
  const durationS = Math.max(0, Math.floor(metrics.sessionDurationS));
  const snapshotCount = Math.max(0, Math.floor(input.snapshotCount ?? 0));

  const estimatedAvgS =
    completeReps > 0 && durationS > 0
      ? roundTiming(durationS / completeReps)
      : null;

  const repTimings = input.repTimings ?? {
    avgS: estimatedAvgS,
    fastestS: null,
    slowestS: null,
  };

  const phaseRatios = input.phaseRatios ?? {};
  const visibilityRatios = input.visibilityRatios ?? {
    hip: 0,
    knee: 0,
    ankle: 0,
  };

  return {
    pilotVersion: FUNCTIONAL_REACH_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "functional-reach",
    snapshotCount,
    durationS,
    repCount: completeReps + unclearReps,
    completeReps,
    unclearReps,
    trackingSignal: normalizeTrackingSignal(metrics.trackingQuality),
    movementDetected: metrics.movementDetected,
    phaseRatios,
    repTimings,
    visibilityRatios,
    clinicianFlags: buildClinicianFlags(input, completeReps),
    reviewRequired: true,
    reviewReason: "derived_functional_reach_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}

export function findForbiddenKeysInFunctionalReachPilotRecord(
  record: FunctionalReachMotionPilotRecord,
): string[] {
  return findForbiddenKeysInSummaryPayload(record);
}

export type CvMotionQualityPayloadWithFrPilot = CvMotionQualityPayload & {
  frPilot?: FunctionalReachMotionPilotRecord;
};

export function buildMotionQualityWithFrPilot(
  record: FunctionalReachMotionPilotRecord,
  existing?: CvMotionQualityPayload | null,
): CvMotionQualityPayloadWithFrPilot {
  return {
    ...(existing ?? {}),
    frPilot: record,
  };
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function dominantTrackingSignal(
  distribution: FunctionalReachSessionMotionSummary["trackingQualityDistribution"],
): CvTrackingQuality | "lost" | "mixed" {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return "unknown";
  if (entries.length > 1) return "mixed";
  return entries[0]![0] as CvTrackingQuality | "lost";
}

function buildClinicianFlagsFromSummary(summary: FunctionalReachSessionMotionSummary): string[] {
  const flags = new Set<string>(summary.captureFlags);
  if (summary.unclearRepCount > 0) flags.add("unclear_reps_recorded");
  if (summary.interruptions.poseLossEventCount > 0) flags.add("pose_tracking_interrupted");
  for (const flag of buildPhaseDetectionFlags(summary.phaseRatios, summary.completeRepCount)) {
    flags.add(flag);
  }
  return [...flags].sort();
}

export type BuildFunctionalReachMotionPilotRecordFromSummaryInput = {
  summary: FunctionalReachSessionMotionSummary;
  metrics: FunctionalReachDerivedMetrics;
  snapshotCount: number;
};

export function buildFunctionalReachMotionPilotRecordFromSummary(
  input: BuildFunctionalReachMotionPilotRecordFromSummaryInput,
): FunctionalReachMotionPilotRecord {
  const { summary, metrics, snapshotCount } = input;
  return {
    pilotVersion: FUNCTIONAL_REACH_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "functional-reach",
    snapshotCount: Math.max(0, Math.floor(snapshotCount)),
    durationS: summary.sessionDurationS,
    repCount: summary.legacyRepCount,
    completeReps: summary.completeRepCount,
    unclearReps: summary.unclearRepCount,
    trackingSignal: dominantTrackingSignal(summary.trackingQualityDistribution),
    movementDetected: metrics.movementDetected,
    phaseRatios: { ...summary.phaseRatios },
    repTimings: {
      avgS: summary.repDurationSummary.avgDurationS,
      fastestS: summary.repDurationSummary.fastestDurationS,
      slowestS: summary.repDurationSummary.slowestDurationS,
    },
    visibilityRatios: {
      hip: clampPct(summary.visibilityAssist.hipVisiblePct),
      knee: clampPct(summary.visibilityAssist.kneeVisiblePct),
      ankle: clampPct(summary.visibilityAssist.ankleVisiblePct),
    },
    clinicianFlags: buildClinicianFlagsFromSummary(summary),
    reviewRequired: true,
    reviewReason: "derived_functional_reach_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}
