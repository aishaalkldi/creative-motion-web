/**
 * MSM pilot — safe Motion Evidence Record for motion_quality.msPilot (Mini Squat only).
 * No video, images, landmarks, diagnosis, or treatment advice.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { MiniSquatDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";

export const MINI_SQUAT_MOTION_PILOT_VERSION = "msm-1" as const;

export type MsPilotEvidenceMode = "persisted" | "synthesized";

export const MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL = "Limited motion evidence";

export const MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE =
  "Cycle timing estimated from session duration and detected reps.";

export type MiniSquatMotionPilotPhaseRatios = Partial<
  Record<"standing" | "lowering" | "bottom" | "rising" | "rest" | "unknown", number>
>;

export type MiniSquatMotionPilotRepTimings = {
  avgS: number | null;
  fastestS: number | null;
  slowestS: number | null;
};

export type MiniSquatMotionPilotVisibilityRatios = {
  hip: number;
  knee: number;
  ankle: number;
};

export type MiniSquatMotionPilotRecord = {
  pilotVersion: typeof MINI_SQUAT_MOTION_PILOT_VERSION;
  isPilot: true;
  exerciseId: "mini-squat";
  snapshotCount: number;
  durationS: number;
  repCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  movementDetected: boolean;
  phaseRatios: MiniSquatMotionPilotPhaseRatios;
  repTimings: MiniSquatMotionPilotRepTimings;
  visibilityRatios: MiniSquatMotionPilotVisibilityRatios;
  clinicianFlags: string[];
  reviewRequired: true;
  reviewReason: string;
  disclaimer: string;
};

export const MINI_SQUAT_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS = [
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
] as const satisfies readonly (keyof MiniSquatMotionPilotRecord)[];

export type BuildMiniSquatMotionPilotRecordInput = {
  metrics: MiniSquatDerivedMetrics;
  snapshotCount?: number;
  completeReps?: number;
  unclearReps?: number;
  phaseRatios?: MiniSquatMotionPilotPhaseRatios;
  repTimings?: MiniSquatMotionPilotRepTimings;
  visibilityRatios?: MiniSquatMotionPilotVisibilityRatios;
  clinicianFlags?: string[];
};

function clampPct(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

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

const MOTION_PHASE_KEYS = ["lowering", "bottom", "rising"] as const;

function buildPhaseDetectionFlags(
  phaseRatios: MiniSquatMotionPilotPhaseRatios,
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
    (phaseRatios.lowering ?? 0) === 0 &&
    (phaseRatios.rising ?? 0) === 0
  ) {
    flags.push("partial_phase_cycle");
  }

  return flags;
}

function buildClinicianFlags(
  input: BuildMiniSquatMotionPilotRecordInput,
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

/**
 * Build a session-level mini squat motion pilot record from derived metrics.
 * Used when enriched timeline evidence is not yet persisted.
 */
export function buildMiniSquatMotionPilotRecord(
  input: BuildMiniSquatMotionPilotRecordInput,
): MiniSquatMotionPilotRecord {
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
    pilotVersion: MINI_SQUAT_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "mini-squat",
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
    reviewReason: "derived_mini_squat_motion_evidence",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
  };
}

export function findForbiddenKeysInMiniSquatPilotRecord(
  record: MiniSquatMotionPilotRecord,
): string[] {
  return findForbiddenKeysInSummaryPayload(record);
}

export type CvMotionQualityPayloadWithMsPilot = CvMotionQualityPayload & {
  msPilot?: MiniSquatMotionPilotRecord;
};

export function buildMotionQualityWithMsPilot(
  record: MiniSquatMotionPilotRecord,
  existing?: CvMotionQualityPayload | null,
): CvMotionQualityPayloadWithMsPilot {
  return {
    ...(existing ?? {}),
    msPilot: record,
  };
}
