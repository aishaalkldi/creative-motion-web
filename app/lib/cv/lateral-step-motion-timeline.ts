/**
 * LSM-1 — In-memory lateral step motion timeline (browser only).
 * Derived snapshots at 1 Hz; feeds lsPilot on patient save. No video or landmarks.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { LateralStepMovementPhase } from "@/app/lib/cv/lateral-step-phase-classifier";
import {
  classifyLateralStepMovementPhase,
  type LateralStepPhaseClassifierState,
} from "@/app/lib/cv/lateral-step-phase-classifier";
import type { LateralStepMotionPilotPhaseRatios } from "@/app/lib/cv/lateral-step-motion-pilot-record";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import { PATIENT_LATERAL_STEP_REP_CONFIG } from "@/app/lib/cv/cv-patient-config";

export type LateralStepMotionSnapshotEvent =
  | "rep_completed"
  | "pose_lost"
  | "pose_recovered"
  | "movement_detected";

export type LateralStepMotionSnapshot = {
  tSec: number;
  exerciseId: "lateral-step";
  posePresent: boolean;
  trackingQuality: CvTrackingQuality | "lost";
  bodyFraming?: BodyFramingProfileId;
  repCount: number;
  movementPhase: LateralStepMovementPhase;
  visibility: { hip: number; knee: number; ankle: number };
  events: LateralStepMotionSnapshotEvent[];
};

export type LateralStepRepTimingRecord = {
  repIndex: number;
  completed: boolean;
  durationMs: number | null;
  captureFlags: string[];
};

export type LateralStepSessionMotionSummary = {
  schemaVersion: "lsm-1";
  exerciseId: "lateral-step";
  sessionDurationS: number;
  legacyRepCount: number;
  completeRepCount: number;
  unclearRepCount: number;
  phaseRatios: LateralStepMotionPilotPhaseRatios;
  repDurationSummary: {
    avgDurationS: number | null;
    fastestDurationS: number | null;
    slowestDurationS: number | null;
    completedRepCount: number;
  };
  visibilityAssist: {
    hipVisiblePct: number;
    kneeVisiblePct: number;
    ankleVisiblePct: number;
  };
  trackingQualityDistribution: Record<CvTrackingQuality | "lost", number>;
  captureFlags: string[];
  interruptions: { poseLossEventCount: number };
};

export type LateralStepMotionTimelineTickInput = {
  sessionSeconds: number;
  posePresent: boolean;
  trackingQuality: CvTrackingQuality | "lost";
  repCount: number;
  movementDetected: boolean;
  movementPhase: LateralStepMovementPhase;
  visibility: LateralStepMotionSnapshot["visibility"];
  bodyFraming?: BodyFramingProfileId;
  events?: readonly LateralStepMotionSnapshotEvent[];
};

const TRACKING_VISIBILITY_SCALAR: Record<CvTrackingQuality | "lost", number> = {
  good: 0.8,
  fair: 0.55,
  poor: 0.3,
  unknown: 0.35,
  lost: 0,
};

const ACTIVE_CYCLE_PHASES = new Set<LateralStepMovementPhase>([
  "lateral_shift",
  "step_out",
  "return_to_center",
  "standing",
]);

function resolveTrackingQualityForVisibility(
  snap: SitToStandDetectorSnapshot,
): CvTrackingQuality | "lost" {
  if (snap.trackingStatus === "pose-lost") return "lost";
  return snap.trackingQuality ?? "unknown";
}

export function lateralStepVisibilityFromCaptureSnapshot(
  snap: SitToStandDetectorSnapshot,
): LateralStepMotionSnapshot["visibility"] {
  let scalar = TRACKING_VISIBILITY_SCALAR[resolveTrackingQualityForVisibility(snap)];
  if (snap.bodyFramingState === "low_visibility") {
    scalar = Math.min(scalar, 0.35);
  }
  return { hip: scalar, knee: scalar, ankle: scalar };
}

export function buildLateralStepTimelineTickFromCaptureState(
  snap: SitToStandDetectorSnapshot,
  context: {
    phaseClassifier: LateralStepPhaseClassifierState;
    bodyFraming?: BodyFramingProfileId;
    events?: readonly LateralStepMotionSnapshotEvent[];
  },
): LateralStepMotionTimelineTickInput {
  const standPhase = snap.standPhase ?? "up";
  const snapWithPhase: SitToStandDetectorSnapshot = { ...snap, standPhase };
  const movementPhase = classifyLateralStepMovementPhase(
    snapWithPhase,
    context.phaseClassifier,
  );

  return {
    sessionSeconds: snap.sessionSeconds,
    posePresent: snap.trackingStatus === "pose-found",
    trackingQuality: resolveTrackingQualityForVisibility(snap),
    bodyFraming: context.bodyFraming ?? "standing-sagittal-rep",
    repCount: snap.repCount,
    movementDetected: snap.movementDetected,
    movementPhase,
    visibility: lateralStepVisibilityFromCaptureSnapshot(snap),
    events: context.events,
  };
}

function deriveTransitionEvents(
  prev: LateralStepMotionTimelineTickInput | null,
  curr: LateralStepMotionTimelineTickInput,
): LateralStepMotionSnapshotEvent[] {
  const events = new Set<LateralStepMotionSnapshotEvent>(curr.events ?? []);
  if (prev) {
    if (curr.repCount > prev.repCount) events.add("rep_completed");
    if (!curr.posePresent && prev.posePresent) events.add("pose_lost");
    if (curr.posePresent && !prev.posePresent) events.add("pose_recovered");
    if (curr.movementDetected && !prev.movementDetected) events.add("movement_detected");
  }
  return [...events];
}

function mergePhaseForBucket(
  existing: LateralStepMovementPhase,
  next: LateralStepMovementPhase,
): LateralStepMovementPhase {
  if (existing === next) return existing;
  const priority: LateralStepMovementPhase[] = [
    "lateral_shift",
    "step_out",
    "return_to_center",
    "standing",
    "rest",
    "unknown",
  ];
  const existingIdx = priority.indexOf(existing);
  const nextIdx = priority.indexOf(next);
  if (existingIdx === -1) return next;
  if (nextIdx === -1) return existing;
  return existingIdx <= nextIdx ? existing : next;
}

function mergeEvents(
  existing: readonly LateralStepMotionSnapshotEvent[],
  next: readonly LateralStepMotionSnapshotEvent[],
): LateralStepMotionSnapshotEvent[] {
  return [...new Set([...existing, ...next])];
}

function buildMotionSnapshot(
  input: LateralStepMotionTimelineTickInput,
  events: LateralStepMotionSnapshotEvent[],
): LateralStepMotionSnapshot {
  return {
    tSec: Math.max(0, Math.floor(input.sessionSeconds)),
    exerciseId: "lateral-step",
    posePresent: input.posePresent,
    trackingQuality: input.trackingQuality,
    bodyFraming: input.bodyFraming,
    repCount: input.repCount,
    movementPhase: input.movementPhase,
    visibility: input.visibility,
    events,
  };
}

export class LateralStepMotionTimelineAccumulator {
  private snapshotsBySec = new Map<number, LateralStepMotionSnapshot>();
  private prevTick: LateralStepMotionTimelineTickInput | null = null;
  private active = false;

  start(): void {
    this.clear();
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.clear();
  }

  reset(): void {
    this.stop();
  }

  clear(): void {
    this.snapshotsBySec.clear();
    this.prevTick = null;
  }

  isActive(): boolean {
    return this.active;
  }

  recordTick(input: LateralStepMotionTimelineTickInput): void {
    if (!this.active) return;
    const events = deriveTransitionEvents(this.prevTick, input);
    const tSec = Math.max(0, Math.floor(input.sessionSeconds));
    const next = buildMotionSnapshot(input, events);
    const existing = this.snapshotsBySec.get(tSec);
    if (existing) {
      this.snapshotsBySec.set(tSec, {
        ...next,
        movementPhase: mergePhaseForBucket(existing.movementPhase, next.movementPhase),
        events: mergeEvents(existing.events, next.events),
      });
    } else {
      this.snapshotsBySec.set(tSec, next);
    }
    this.prevTick = input;
  }

  getSnapshotCount(): number {
    return this.snapshotsBySec.size;
  }

  getSnapshots(): readonly LateralStepMotionSnapshot[] {
    return [...this.snapshotsBySec.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, snap]) => snap);
  }
}

function sortedSnapshots(
  snapshots: readonly LateralStepMotionSnapshot[],
): LateralStepMotionSnapshot[] {
  return [...snapshots].sort((a, b) => a.tSec - b.tSec);
}

export function deriveLateralStepRepTimingRecordsFromSnapshots(
  snapshots: readonly LateralStepMotionSnapshot[],
): LateralStepRepTimingRecord[] {
  const sorted = sortedSnapshots(snapshots);
  if (sorted.length === 0) return [];

  const records: LateralStepRepTimingRecord[] = [];
  let cycleStartSec = sorted[0]!.tSec;
  let prevRepCount = 0;

  for (const snap of sorted) {
    const repIncreased = snap.repCount > prevRepCount;
    const repEvent = snap.events.includes("rep_completed");

    if (repIncreased || repEvent) {
      const durationMs = Math.max(1000, (snap.tSec - cycleStartSec) * 1000);
      const captureFlags = ["complete_rep"];
      if (!snap.posePresent) captureFlags.push("unclear_visibility");

      records.push({
        repIndex: Math.max(snap.repCount, records.length + 1),
        completed: true,
        durationMs,
        captureFlags,
      });

      cycleStartSec = snap.tSec;
      prevRepCount = Math.max(prevRepCount, snap.repCount);
    }
  }

  const lastSnap = sorted[sorted.length - 1]!;
  const openCycleSnaps = sorted.filter((s) => s.tSec > cycleStartSec);
  const openCycleActive = openCycleSnaps.some((s) => ACTIVE_CYCLE_PHASES.has(s.movementPhase));

  if (openCycleActive && lastSnap.repCount === prevRepCount) {
    records.push({
      repIndex: records.length + 1,
      completed: false,
      durationMs: Math.max(1000, (lastSnap.tSec - cycleStartSec + 1) * 1000),
      captureFlags: ["incomplete_cycle"],
    });
  }

  return records;
}

const EMPTY_TRACKING_DISTRIBUTION = (): Record<CvTrackingQuality | "lost", number> => ({
  good: 0,
  fair: 0,
  poor: 0,
  unknown: 0,
  lost: 0,
});

export function buildLateralStepSessionMotionSummary(input: {
  snapshots: readonly LateralStepMotionSnapshot[];
  legacyRepCount: number;
  repRecords: readonly LateralStepRepTimingRecord[];
}): LateralStepSessionMotionSummary {
  const sorted = sortedSnapshots(input.snapshots);
  const sessionDurationS =
    sorted.length > 0 ? sorted[sorted.length - 1]!.tSec + 1 : 0;

  const phaseCounts: Partial<Record<LateralStepMovementPhase, number>> = {};
  const trackingDist = EMPTY_TRACKING_DISTRIBUTION();
  let poseLossEvents = 0;

  for (const snap of sorted) {
    phaseCounts[snap.movementPhase] = (phaseCounts[snap.movementPhase] ?? 0) + 1;
    trackingDist[snap.trackingQuality] += 1;
    if (snap.events.includes("pose_lost")) poseLossEvents += 1;
  }

  const phaseRatios: LateralStepMotionPilotPhaseRatios = {};
  if (sorted.length > 0) {
    for (const [phase, count] of Object.entries(phaseCounts)) {
      phaseRatios[phase as LateralStepMovementPhase] = Math.round(
        ((count as number) / sorted.length) * 100,
      );
    }
  }

  const completedRecords = input.repRecords.filter((r) => r.completed);
  const unclearRecords = input.repRecords.filter((r) => !r.completed);
  const durations = completedRecords
    .map((r) => (r.durationMs ?? 0) / 1000)
    .filter((d) => d > 0);

  const repDurationSummary = {
    avgDurationS:
      durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : null,
    fastestDurationS:
      durations.length > 0 ? Math.round(Math.min(...durations) * 10) / 10 : null,
    slowestDurationS:
      durations.length > 0 ? Math.round(Math.max(...durations) * 10) / 10 : null,
    completedRepCount: durations.length,
  };

  const visibilityThreshold = PATIENT_LATERAL_STEP_REP_CONFIG.visibilityFair ?? 0.6;
  const visibilityPct = (joint: "hip" | "knee" | "ankle") => {
    if (sorted.length === 0) return 0;
    const visible = sorted.filter(
      (s) => s.posePresent && s.visibility[joint] >= visibilityThreshold * 0.65,
    ).length;
    return Math.round((visible / sorted.length) * 100);
  };

  const captureFlags = new Set<string>();
  for (const rep of input.repRecords) {
    for (const flag of rep.captureFlags) captureFlags.add(flag);
    if (!rep.completed) captureFlags.add("incomplete_cycle");
  }

  return {
    schemaVersion: "lsm-1",
    exerciseId: "lateral-step",
    sessionDurationS,
    legacyRepCount: input.legacyRepCount,
    completeRepCount: completedRecords.length,
    unclearRepCount: unclearRecords.length,
    phaseRatios,
    repDurationSummary,
    visibilityAssist: {
      hipVisiblePct: visibilityPct("hip"),
      kneeVisiblePct: visibilityPct("knee"),
      ankleVisiblePct: visibilityPct("ankle"),
    },
    trackingQualityDistribution: trackingDist,
    captureFlags: [...captureFlags].sort(),
    interruptions: { poseLossEventCount: poseLossEvents },
  };
}

export function finalizeLateralStepMotionTimelineSummary(input: {
  accumulator: LateralStepMotionTimelineAccumulator;
  legacyRepCount: number;
}): { summary: LateralStepSessionMotionSummary; forbiddenKeys: string[] } {
  const snapshots = input.accumulator.getSnapshots();
  const repRecords = deriveLateralStepRepTimingRecordsFromSnapshots(snapshots);
  const summary = buildLateralStepSessionMotionSummary({
    snapshots,
    legacyRepCount: input.legacyRepCount,
    repRecords,
  });
  return {
    summary,
    forbiddenKeys: findForbiddenKeysInSummaryPayload(summary),
  };
}
