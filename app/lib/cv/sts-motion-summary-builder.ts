/**
 * SMT-1 — Deterministic STS rollup: MotionSnapshot[] → SessionMotionSummary.
 * No AI, diagnosis, clinical scores, or treatment recommendations.
 */

import type {
  BiomechanicalObservation,
  MotionSnapshot,
  SessionMotionSummary,
  StsRepTimingRecord,
} from "@/app/lib/cv/motion-summary-types";
import { SESSION_MOTION_SUMMARY_SCHEMA } from "@/app/lib/cv/motion-summary-types";
import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";

export type BuildStsSessionMotionSummaryInput = {
  snapshots: readonly MotionSnapshot[];
  legacyRepCount: number;
  repRecords: readonly StsRepTimingRecord[];
  visibilityFairThreshold?: number;
  capturedAt?: string;
};

const DEFAULT_VISIBILITY_FAIR = 0.4;

const EMPTY_TRACKING_DISTRIBUTION = (): Record<CvTrackingQuality | "lost", number> => ({
  good: 0,
  fair: 0,
  poor: 0,
  unknown: 0,
  lost: 0,
});

function sortedSnapshots(snapshots: readonly MotionSnapshot[]): MotionSnapshot[] {
  return [...snapshots].sort((a, b) => a.tSec - b.tSec);
}

function countTrackingDistribution(
  snapshots: readonly MotionSnapshot[],
): Record<CvTrackingQuality | "lost", number> {
  const counts = EMPTY_TRACKING_DISTRIBUTION();
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
  const visible = snapshots.filter(
    (s) => s.posePresent && s.visibility[joint] >= threshold,
  ).length;
  return Math.round((visible / snapshots.length) * 100);
}

function countSnapshotEvents(
  snapshots: readonly MotionSnapshot[],
  event: MotionSnapshot["events"][number],
): number {
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
  let runStartSec: number | null = null;
  for (const snap of snapshots) {
    if (!snap.posePresent) {
      if (runStartSec === null) runStartSec = snap.tSec;
    } else if (runStartSec !== null) {
      longest = Math.max(longest, (snap.tSec - runStartSec) * 1000);
      runStartSec = null;
    }
  }
  if (runStartSec !== null && snapshots.length > 0) {
    const last = snapshots[snapshots.length - 1]!;
    longest = Math.max(longest, (last.tSec - runStartSec + 1) * 1000);
  }
  return longest;
}

function repDurationSummaryFromRecords(repRecords: readonly StsRepTimingRecord[]) {
  const durations = repRecords
    .filter((r) => r.completed && r.durationMs !== null && r.durationMs > 0)
    .map((r) => r.durationMs! / 1000);

  if (durations.length === 0) {
    return {
      avgDurationS: null,
      fastestDurationS: null,
      slowestDurationS: null,
      completedRepCount: 0,
    };
  }

  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    avgDurationS: Math.round((sum / durations.length) * 10) / 10,
    fastestDurationS: Math.round(Math.min(...durations) * 10) / 10,
    slowestDurationS: Math.round(Math.max(...durations) * 10) / 10,
    completedRepCount: durations.length,
  };
}

function collectCaptureFlags(repRecords: readonly StsRepTimingRecord[]): string[] {
  const flags = new Set<string>();
  for (const rep of repRecords) {
    for (const flag of rep.captureFlags) {
      flags.add(flag);
    }
    if (!rep.completed) {
      flags.add("incomplete_cycle");
    }
  }
  return [...flags].sort();
}

function buildObservations(
  summary: Omit<SessionMotionSummary, "observations">,
): BiomechanicalObservation[] {
  const observations: BiomechanicalObservation[] = [];

  observations.push({
    id: "session_duration",
    category: "session_capture",
    label: "Session tracking duration (assistive)",
    value: summary.sessionDurationS,
    unit: "s",
    patientVisible: false,
    clinicianReviewRequired: true,
  });

  observations.push({
    id: "legacy_rep_count",
    category: "session_capture",
    label: "Assistive rep count at session end",
    value: summary.legacyRepCount,
    patientVisible: false,
    clinicianReviewRequired: true,
  });

  observations.push({
    id: "complete_reps",
    category: "rep_completion",
    label: "Complete movement cycles captured",
    value: summary.completeRepCount,
    patientVisible: false,
    clinicianReviewRequired: true,
  });

  observations.push({
    id: "unclear_reps",
    category: "rep_completion",
    label: "Unclear movement cycles captured",
    value: summary.unclearRepCount,
    patientVisible: false,
    clinicianReviewRequired: true,
  });

  if (summary.repDurationSummary.avgDurationS !== null) {
    observations.push({
      id: "avg_rep_duration",
      category: "rep_timing",
      label: "Average rep duration (assistive estimate)",
      value: summary.repDurationSummary.avgDurationS,
      unit: "s",
      patientVisible: false,
      clinicianReviewRequired: true,
    });
  }

  const { trackingQualityDistribution: dist } = summary;
  observations.push({
    id: "tracking_distribution",
    category: "tracking_visibility",
    label: "Tracking signal distribution (camera visibility — not movement quality)",
    value: `good:${dist.good} fair:${dist.fair} poor:${dist.poor} lost:${dist.lost} unknown:${dist.unknown}`,
    patientVisible: false,
    clinicianReviewRequired: true,
  });

  if (summary.interruptions.poseLossEventCount > 0) {
    observations.push({
      id: "pose_interruptions",
      category: "tracking_visibility",
      label: "Pose tracking interruptions during session",
      value: summary.interruptions.poseLossEventCount,
      patientVisible: false,
      clinicianReviewRequired: true,
    });
  }

  return observations;
}

export function buildStsSessionMotionSummary(
  input: BuildStsSessionMotionSummaryInput,
): SessionMotionSummary {
  const snapshots = sortedSnapshots(input.snapshots);
  const fairThreshold = input.visibilityFairThreshold ?? DEFAULT_VISIBILITY_FAIR;

  const completeRepCount = input.repRecords.filter((r) => r.completed).length;
  const unclearRepCount = input.repRecords.filter((r) => !r.completed).length;

  const sessionDurationS =
    snapshots.length === 0
      ? 0
      : Math.max(0, Math.round(snapshots[snapshots.length - 1]!.tSec));

  const base = {
    schemaVersion: SESSION_MOTION_SUMMARY_SCHEMA,
    exerciseId: "sit-to-stand" as const,
    sessionDurationS,
    legacyRepCount: input.legacyRepCount,
    completeRepCount,
    unclearRepCount,
    trackingQualityDistribution: countTrackingDistribution(snapshots),
    visibilityAssist: {
      hipVisiblePct: visibilityPct(snapshots, "hip", fairThreshold),
      kneeVisiblePct: visibilityPct(snapshots, "knee", fairThreshold),
      ankleVisiblePct: visibilityPct(snapshots, "ankle", fairThreshold),
    },
    interruptions: {
      poseLossEventCount: countSnapshotEvents(snapshots, "pose_lost"),
      longestPoseLossGapMs: longestPoseLossGapMs(snapshots),
    },
    repDurationSummary: repDurationSummaryFromRecords(input.repRecords),
    captureFlags: collectCaptureFlags(input.repRecords),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    patientVisible: false as const,
    clinicianReviewRequired: true as const,
    therapistReviewHint: "derived_motion_summary_only" as const,
  };

  return {
    ...base,
    observations: buildObservations(base),
  };
}
