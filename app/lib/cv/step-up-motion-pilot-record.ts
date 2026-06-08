/**
 * SUM pilot — safe Motion Evidence Record for motion_quality.suPilot (Step Up only).
 * No video, images, landmarks, diagnosis, or treatment advice.
 */

import type { CvTrackingQuality, StepUpDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { StepUpSessionMotionSummary } from "@/app/lib/cv/step-up-motion-timeline";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";

export const STEP_UP_MOTION_PILOT_VERSION = "sum-1" as const;

export type SuPilotEvidenceMode = "persisted" | "synthesized";

export const STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL = "Limited motion evidence";

export const STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE =
  "Cycle timing estimated from session duration and detected reps.";

export type StepUpMotionPilotPhaseRatios = Partial<
  Record<
    "standing" | "step_ascent" | "top_position" | "step_descent" | "rest" | "unknown",
    number
  >
>;

export type StepUpMotionPilotRepTimings = {
  avgS: number | null;
  fastestS: number | null;
  slowestS: number | null;
};

export type StepUpMotionPilotVisibilityRatios = {
  hip: number;
  knee: number;
  ankle: number;
};

export type StepUpMotionPilotRecord = {
  pilotVersion: typeof STEP_UP_MOTION_PILOT_VERSION;
  isPilot: true;
  exerciseId: "step-up";
  snapshotCount: number;
  durationS: number;
  repCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  movementDetected: boolean;
  phaseRatios: StepUpMotionPilotPhaseRatios;
  repTimings: StepUpMotionPilotRepTimings;
  visibilityRatios: StepUpMotionPilotVisibilityRatios;
  clinicianFlags: string[];
  reviewRequired: true;
  reviewReason: string;
  disclaimer: string;
};

export const STEP_UP_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS = [
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
] as const satisfies readonly (keyof StepUpMotionPilotRecord)[];

export type BuildStepUpMotionPilotRecordInput = {
  metrics: StepUpDerivedMetrics;
  snapshotCount?: number;
  completeReps?: number;
  unclearReps?: number;
  phaseRatios?: StepUpMotionPilotPhaseRatios;
  repTimings?: StepUpMotionPilotRepTimings;
  visibilityRatios?: StepUpMotionPilotVisibilityRatios;
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

const MOTION_PHASE_KEYS = ["step_ascent", "top_position", "step_descent"] as const;

function buildPhaseDetectionFlags(
  phaseRatios: StepUpMotionPilotPhaseRatios,
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
    (phaseRatios.step_ascent ?? 0) === 0 &&
    (phaseRatios.step_descent ?? 0) === 0
  ) {
    flags.push("partial_phase_cycle");
  }

  return flags;
}

function buildClinicianFlags(
  input: BuildStepUpMotionPilotRecordInput,
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

export function buildStepUpMotionPilotRecord(
  input: BuildStepUpMotionPilotRecordInput,
): StepUpMotionPilotRecord {
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
    pilotVersion: STEP_UP_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "step-up",
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
    reviewReason: "derived_step_up_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}

export function findForbiddenKeysInStepUpPilotRecord(
  record: StepUpMotionPilotRecord,
): string[] {
  return findForbiddenKeysInSummaryPayload(record);
}

export type CvMotionQualityPayloadWithSuPilot = CvMotionQualityPayload & {
  suPilot?: StepUpMotionPilotRecord;
};

export function buildMotionQualityWithSuPilot(
  record: StepUpMotionPilotRecord,
  existing?: CvMotionQualityPayload | null,
): CvMotionQualityPayloadWithSuPilot {
  return {
    ...(existing ?? {}),
    suPilot: record,
  };
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function dominantTrackingSignal(
  distribution: StepUpSessionMotionSummary["trackingQualityDistribution"],
): CvTrackingQuality | "lost" | "mixed" {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return "unknown";
  if (entries.length > 1) return "mixed";
  return entries[0]![0] as CvTrackingQuality | "lost";
}

function buildClinicianFlagsFromSummary(summary: StepUpSessionMotionSummary): string[] {
  const flags = new Set<string>(summary.captureFlags);
  if (summary.unclearRepCount > 0) flags.add("unclear_reps_recorded");
  if (summary.interruptions.poseLossEventCount > 0) flags.add("pose_tracking_interrupted");
  for (const flag of buildPhaseDetectionFlags(summary.phaseRatios, summary.completeRepCount)) {
    flags.add(flag);
  }
  return [...flags].sort();
}

export type BuildStepUpMotionPilotRecordFromSummaryInput = {
  summary: StepUpSessionMotionSummary;
  metrics: StepUpDerivedMetrics;
  snapshotCount: number;
};

export function buildStepUpMotionPilotRecordFromSummary(
  input: BuildStepUpMotionPilotRecordFromSummaryInput,
): StepUpMotionPilotRecord {
  const { summary, metrics, snapshotCount } = input;
  return {
    pilotVersion: STEP_UP_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "step-up",
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
    reviewReason: "derived_step_up_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}
