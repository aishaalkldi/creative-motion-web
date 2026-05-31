/**
 * Deterministic rollup: MotionSnapshot[] → SessionMotionEvidenceSummary.
 * No AI. No clinical interpretation.
 */

import type {
  MotionSnapshot,
  MotionSnapshotEvent,
  RepTimingEvent,
  SessionMotionEvidenceSummary,
} from "@/app/lib/cv/motion-evidence.types";
import { SESSION_MOTION_EVIDENCE_SCHEMA } from "@/app/lib/cv/motion-evidence.types";

export type BuildSessionMotionEvidenceSummaryInput = {
  exerciseId: "sit-to-stand";
  snapshots: readonly MotionSnapshot[];
  repsDetected: number;
  repEvents: readonly RepTimingEvent[];
  visibilityFairThreshold?: number;
  capturedAt?: string;
};

const DEFAULT_VISIBILITY_FAIR = 0.4;

function sortedSnapshots(snapshots: readonly MotionSnapshot[]): MotionSnapshot[] {
  return [...snapshots].sort((a, b) => a.t - b.t);
}

function countTrackingDistribution(snapshots: readonly MotionSnapshot[]) {
  const counts = { good: 0, fair: 0, poor: 0, lost: 0 };
  for (const snap of snapshots) {
    counts[snap.trackingQuality] += 1;
  }
  return counts;
}

function visibilityPct(
  snapshots: readonly MotionSnapshot[],
  joint: "hip" | "knee" | "ankle",
  threshold: number,
): number {
  if (snapshots.length === 0) return 0;
  const visible = snapshots.filter((s) => s.posePresent && s.visibility[joint] >= threshold).length;
  return Math.round((visible / snapshots.length) * 100);
}

function countEvent(snapshots: readonly MotionSnapshot[], event: MotionSnapshotEvent): number {
  let count = 0;
  for (const snap of snapshots) {
    for (const e of snap.events) {
      if (e === event) count += 1;
    }
  }
  return count;
}

function longestPoseLossGapMs(snapshots: readonly MotionSnapshot[]): number {
  let longest = 0;
  let runStart: number | null = null;
  for (const snap of snapshots) {
    if (!snap.posePresent) {
      if (runStart === null) runStart = snap.t;
    } else if (runStart !== null) {
      longest = Math.max(longest, snap.t - runStart);
      runStart = null;
    }
  }
  if (runStart !== null && snapshots.length > 0) {
    const last = snapshots[snapshots.length - 1]!;
    longest = Math.max(longest, last.t - runStart + 1000);
  }
  return longest;
}

function tempoFromRepEvents(repEvents: readonly RepTimingEvent[]) {
  const durations = repEvents
    .filter((r) => r.completed && r.durationMs !== null && r.durationMs > 0)
    .map((r) => r.durationMs! / 1000);

  if (durations.length === 0) {
    return { avgRepDurationS: null, fastestRepS: null, slowestRepS: null };
  }

  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / durations.length) * 10) / 10;
  const fastest = Math.round(Math.min(...durations) * 10) / 10;
  const slowest = Math.round(Math.max(...durations) * 10) / 10;
  return { avgRepDurationS: avg, fastestRepS: fastest, slowestRepS: slowest };
}

function movementFlagsFromRepEvents(repEvents: readonly RepTimingEvent[]): string[] {
  const flags = new Set<string>();
  for (const rep of repEvents) {
    for (const flag of rep.flags) {
      flags.add(flag);
    }
    if (!rep.completed) {
      flags.add("incomplete_cycle");
    }
  }
  return [...flags].sort();
}

export function buildSessionMotionEvidenceSummary(
  input: BuildSessionMotionEvidenceSummaryInput,
): SessionMotionEvidenceSummary {
  const snapshots = sortedSnapshots(input.snapshots);
  const fairThreshold = input.visibilityFairThreshold ?? DEFAULT_VISIBILITY_FAIR;

  const completeReps = input.repEvents.filter((r) => r.completed).length;
  const unclearReps = input.repEvents.filter((r) => !r.completed).length;

  const durationS =
    snapshots.length === 0
      ? 0
      : Math.max(0, Math.round(snapshots[snapshots.length - 1]!.t / 1000));

  return {
    schemaVersion: SESSION_MOTION_EVIDENCE_SCHEMA,
    exerciseId: input.exerciseId,
    durationS,
    repsDetected: input.repsDetected,
    completeReps,
    unclearReps,
    trackingDistribution: countTrackingDistribution(snapshots),
    visibility: {
      hipPct: visibilityPct(snapshots, "hip", fairThreshold),
      kneePct: visibilityPct(snapshots, "knee", fairThreshold),
      anklePct: visibilityPct(snapshots, "ankle", fairThreshold),
    },
    interruptions: {
      poseLossCount: countEvent(snapshots, "pose_lost"),
      longestGapMs: longestPoseLossGapMs(snapshots),
    },
    tempoProfile: tempoFromRepEvents(input.repEvents),
    movementFlags: movementFlagsFromRepEvents(input.repEvents),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    therapistReviewHint: "motion_evidence_only",
  };
}
