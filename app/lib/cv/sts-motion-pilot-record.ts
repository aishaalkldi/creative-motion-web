/**
 * SMT pilot — safe Motion Evidence Record for motion_quality.smtPilot (STS only).
 * No video, images, landmarks, diagnosis, or treatment advice.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { SitToStandDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { HeelRaiseMotionPilotRecord } from "@/app/lib/cv/heel-raise-motion-pilot-record";
import type { FunctionalReachMotionPilotRecord } from "@/app/lib/cv/functional-reach-motion-pilot-record";
import type { LateralStepMotionPilotRecord } from "@/app/lib/cv/lateral-step-motion-pilot-record";
import type { StepUpMotionPilotRecord } from "@/app/lib/cv/step-up-motion-pilot-record";
import type { MiniSquatMotionPilotRecord } from "@/app/lib/cv/mini-squat-motion-pilot-record";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";
import type { StsAttemptSummary } from "@/app/lib/cv/sts-biomechanical-capture-fsm";

export const STS_MOTION_PILOT_VERSION = "smt-1" as const;

export type StsMotionPilotPhaseRatios = Partial<
  Record<"seated" | "rising" | "standing" | "returning" | "rest" | "unknown", number>
>;

export type StsMotionPilotRepTimings = {
  avgS: number | null;
  fastestS: number | null;
  slowestS: number | null;
};

export type StsMotionPilotVisibilityRatios = {
  hip: number;
  knee: number;
  ankle: number;
};

export type StsMotionPilotAttemptSummary = {
  attemptIndex: number;
  attemptType: "complete" | "partial" | "unclear";
  risingDetected: boolean;
  standingReached: boolean;
  returningDetected: boolean;
  seatedReturnReached: boolean;
  phaseDurationsMs: StsAttemptSummary["phaseDurationsMs"];
  hipVerticalDisplacement: number | null;
  confidence: StsAttemptSummary["confidence"];
  reason: string | null;
};

export type StsMotionPilotRecord = {
  pilotVersion: typeof STS_MOTION_PILOT_VERSION;
  isPilot: true;
  exerciseId: "sit-to-stand";
  snapshotCount: number;
  durationS: number;
  repCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  movementDetected: boolean;
  phaseRatios: StsMotionPilotPhaseRatios;
  repTimings: StsMotionPilotRepTimings;
  visibilityRatios: StsMotionPilotVisibilityRatios;
  clinicianFlags: string[];
  reviewRequired: true;
  reviewReason: string;
  disclaimer: string;
  attemptSummaries?: StsMotionPilotAttemptSummary[];
};

export const STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS = [
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
  "attemptSummaries",
] as const satisfies readonly (keyof StsMotionPilotRecord)[];

export type BuildStsMotionPilotRecordInput = {
  summary: SessionMotionSummary;
  metrics: SitToStandDerivedMetrics;
  snapshotCount: number;
  extraClinicianFlags?: string[];
  attemptSummaries?: readonly StsAttemptSummary[];
};

function toPilotAttemptSummary(
  attempt: StsAttemptSummary,
): StsMotionPilotAttemptSummary {
  return {
    attemptIndex: attempt.attemptIndex,
    attemptType: attempt.attemptType,
    risingDetected: attempt.risingDetected,
    standingReached: attempt.standingReached,
    returningDetected: attempt.returningDetected,
    seatedReturnReached: attempt.seatedReturnReached,
    phaseDurationsMs: attempt.phaseDurationsMs,
    hipVerticalDisplacement: attempt.hipVerticalDisplacement,
    confidence: attempt.confidence,
    reason: attempt.reason,
  };
}

function buildAttemptClinicianFlags(
  attempts: readonly StsAttemptSummary[],
): string[] {
  const flags: string[] = [];
  const partial = attempts.filter((a) => a.attemptType === "partial").length;
  const unclear = attempts.filter((a) => a.attemptType === "unclear").length;
  if (partial > 0) flags.push("partial_movement_attempts_recorded");
  if (unclear > 0) flags.push("unclear_movement_attempts_recorded");
  return flags;
}

function dominantTrackingSignal(
  distribution: SessionMotionSummary["trackingQualityDistribution"],
): CvTrackingQuality | "lost" | "mixed" {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return "unknown";

  entries.sort((a, b) => b[1] - a[1]);
  const topCount = entries[0][1];
  const tied = entries.filter(([, count]) => count === topCount);
  if (tied.length > 1) return "mixed";

  const key = entries[0][0];
  if (key === "lost") return "lost";
  if (key === "good" || key === "fair" || key === "poor" || key === "unknown") {
    return key;
  }
  return "unknown";
}

function clampPct(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

const MOTION_PHASE_KEYS = ["rising", "standing", "returning"] as const;

function buildPhaseDetectionFlags(
  phaseRatios: SessionMotionSummary["phaseRatios"],
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
    (phaseRatios.rising ?? 0) === 0 &&
    (phaseRatios.returning ?? 0) === 0
  ) {
    flags.push("partial_phase_cycle");
  }

  return flags;
}

function buildClinicianFlags(
  summary: SessionMotionSummary,
  extraClinicianFlags?: string[],
): string[] {
  const flags = new Set<string>(summary.captureFlags);
  if (summary.unclearRepCount > 0) {
    flags.add("unclear_reps_recorded");
  }
  if (summary.interruptions.poseLossEventCount > 0) {
    flags.add("pose_tracking_interrupted");
  }
  for (const flag of buildPhaseDetectionFlags(summary.phaseRatios, summary.completeRepCount)) {
    flags.add(flag);
  }
  for (const flag of extraClinicianFlags ?? []) {
    flags.add(flag);
  }
  return [...flags].sort();
}

export function buildStsMotionPilotRecord(
  input: BuildStsMotionPilotRecordInput,
): StsMotionPilotRecord {
  const { summary, metrics, snapshotCount } = input;

  const attemptSummaries = input.attemptSummaries ?? [];
  const pilotAttempts = attemptSummaries.map(toPilotAttemptSummary);

  return {
    pilotVersion: STS_MOTION_PILOT_VERSION,
    isPilot: true,
    exerciseId: "sit-to-stand",
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
    clinicianFlags: buildClinicianFlags(summary, [
      ...(input.extraClinicianFlags ?? []),
      ...buildAttemptClinicianFlags(attemptSummaries),
    ]),
    reviewRequired: true,
    reviewReason: "derived_motion_timeline_pilot",
    disclaimer:
      "Assistive motion capture for clinician review only. Not a clinical score or diagnosis.",
    attemptSummaries: pilotAttempts.length > 0 ? pilotAttempts : [],
  };
}

export function findForbiddenKeysInStsPilotRecord(record: StsMotionPilotRecord): string[] {
  return findForbiddenKeysInSummaryPayload(record);
}

/** Payload shape stored on cv_session_metrics.motion_quality */
export type CvMotionQualityPayload = {
  smtPilot?: StsMotionPilotRecord;
  msPilot?: MiniSquatMotionPilotRecord;
  hrPilot?: HeelRaiseMotionPilotRecord;
  suPilot?: StepUpMotionPilotRecord;
  lsPilot?: LateralStepMotionPilotRecord;
  frPilot?: FunctionalReachMotionPilotRecord;
  [key: string]: unknown;
};

export function buildMotionQualityWithStsPilot(
  record: StsMotionPilotRecord,
  existing?: CvMotionQualityPayload | null,
): CvMotionQualityPayload {
  return {
    ...(existing ?? {}),
    smtPilot: record,
  };
}
