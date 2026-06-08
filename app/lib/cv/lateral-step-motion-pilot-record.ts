/**
 * LSM pilot — safe Motion Evidence Record for motion_quality.lsPilot (Lateral Step only).
 * No video, images, landmarks, diagnosis, or treatment advice.
 */

import type { CvTrackingQuality, LateralStepDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { LateralStepSessionMotionSummary } from "@/app/lib/cv/lateral-step-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";

export const LATERAL_STEP_MOTION_PILOT_VERSION = "lsm-1" as const;

export type LsPilotEvidenceMode = "persisted" | "synthesized";

export const LATERAL_STEP_LIMITED_MOTION_EVIDENCE_LABEL = "Limited motion evidence";

export const LATERAL_STEP_CYCLE_TIMING_ESTIMATED_NOTE =
  "Cycle timing estimated from session duration and detected reps.";

export type LateralStepMotionPilotPhaseRatios = Partial<
  Record<
    "standing" | "lateral_shift" | "step_out" | "return_to_center" | "rest" | "unknown",
    number
  >
>;

export type LateralStepMotionPilotRepTimings = {
  avgS: number | null;
  fastestS: number | null;
  slowestS: number | null;
};

export type LateralStepMotionPilotVisibilityRatios = {
  hip: number;
  knee: number;
  ankle: number;
};

export type LateralStepMotionPilotRecord = {
  pilotVersion: typeof LATERAL_STEP_MOTION_PILOT_VERSION;
  isPilot: true;
  exerciseId: "lateral-step";
  snapshotCount: number;
  durationS: number;
  repCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  movementDetected: boolean;
  phaseRatios: LateralStepMotionPilotPhaseRatios;
  repTimings: LateralStepMotionPilotRepTimings;
  visibilityRatios: LateralStepMotionPilotVisibilityRatios;
  clinicianFlags: string[];
  reviewRequired: true;
  reviewReason: string;
  disclaimer: string;
};

export const LATERAL_STEP_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS = [
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
] as const satisfies readonly (keyof LateralStepMotionPilotRecord)[];

export type BuildLateralStepMotionPilotRecordInput = {
  metrics: LateralStepDerivedMetrics;
  snapshotCount?: number;
  completeReps?: number;
  unclearReps?: number;
  phaseRatios?: LateralStepMotionPilotPhaseRatios;
  repTimings?: LateralStepMotionPilotRepTimings;
  visibilityRatios?: LateralStepMotionPilotVisibilityRatios;
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

const MOTION_PHASE_KEYS = ["lateral_shift", "step_out", "return_to_center"] as const;

function buildPhaseDetectionFlags(
  phaseRatios: LateralStepMotionPilotPhaseRatios,
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
    (phaseRatios.lateral_shift ?? 0) === 0 &&
    (phaseRatios.return_to_center ?? 0) === 0
  ) {
    flags.push("partial_phase_cycle");
  }

  return flags;
}

function buildClinicianFlags(
  input: BuildLateralStepMotionPilotRecordInput,
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

export function buildLateralStepMotionPilotRecord(
  input: BuildLateralStepMotionPilotRecordInput,
): LateralStepMotionPilotRecord {
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
    pilotVersion: LATERAL_STEP_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "lateral-step",
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
    reviewReason: "derived_lateral_step_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}

export function findForbiddenKeysInLateralStepPilotRecord(
  record: LateralStepMotionPilotRecord,
): string[] {
  return findForbiddenKeysInSummaryPayload(record);
}

export type CvMotionQualityPayloadWithLsPilot = CvMotionQualityPayload & {
  lsPilot?: LateralStepMotionPilotRecord;
};

export function buildMotionQualityWithLsPilot(
  record: LateralStepMotionPilotRecord,
  existing?: CvMotionQualityPayload | null,
): CvMotionQualityPayloadWithLsPilot {
  return {
    ...(existing ?? {}),
    lsPilot: record,
  };
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function dominantTrackingSignal(
  distribution: LateralStepSessionMotionSummary["trackingQualityDistribution"],
): CvTrackingQuality | "lost" | "mixed" {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return "unknown";
  if (entries.length > 1) return "mixed";
  return entries[0]![0] as CvTrackingQuality | "lost";
}

function buildClinicianFlagsFromSummary(
  summary: LateralStepSessionMotionSummary,
  extraClinicianFlags?: string[],
): string[] {
  const flags = new Set<string>(summary.captureFlags);
  if (summary.unclearRepCount > 0) flags.add("unclear_reps_recorded");
  if (summary.interruptions.poseLossEventCount > 0) flags.add("pose_tracking_interrupted");
  for (const flag of buildPhaseDetectionFlags(summary.phaseRatios, summary.completeRepCount)) {
    flags.add(flag);
  }
  for (const flag of extraClinicianFlags ?? []) {
    flags.add(flag);
  }
  return [...flags].sort();
}

export type BuildLateralStepMotionPilotRecordFromSummaryInput = {
  summary: LateralStepSessionMotionSummary;
  metrics: LateralStepDerivedMetrics;
  snapshotCount: number;
  extraClinicianFlags?: string[];
};

export function buildLateralStepMotionPilotRecordFromSummary(
  input: BuildLateralStepMotionPilotRecordFromSummaryInput,
): LateralStepMotionPilotRecord {
  const { summary, metrics, snapshotCount } = input;
  return {
    pilotVersion: LATERAL_STEP_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "lateral-step",
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
    clinicianFlags: buildClinicianFlagsFromSummary(summary, input.extraClinicianFlags),
    reviewRequired: true,
    reviewReason: "derived_lateral_step_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}
