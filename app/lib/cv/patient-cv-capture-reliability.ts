/**
 * Patient CV capture reliability — debug signals, warnings, and report flags.
 * No raw landmarks. No detector threshold changes.
 */

import type { PatientCvExerciseId } from "@/app/lib/cv/bio-0-contracts";
import type { CaptureReadinessCheck } from "@/app/lib/cv/patient-cv-capture-readiness";
import type { SitToStandTrackingStatus } from "@/app/lib/cv/sit-to-stand-detector";

export const NO_TIMELINE_SNAPSHOTS_FLAG = "no_timeline_snapshots";

export const NO_TIMELINE_SNAPSHOTS_CLINICIAN_NOTE =
  "Camera session completed, but no motion timeline snapshots were recorded.";

export const CAPTURE_RELIABILITY_WARNING_DELAY_MS = 5_000;

export type PatientCvCaptureReliabilityState = {
  cameraActive: boolean;
  poseDetected: boolean;
  trackingConfirmed: boolean;
  timelineRecording: boolean;
  snapshotCount: number;
  detectorPhase: string;
  requiredJointsVisiblePct: number;
  repOrCycleCount: number;
  lastMovementEvent: string;
};

export type TimelineAccumulatorProbe = {
  getSnapshotCount(): number;
  isActive(): boolean;
} | null;

export function computeRequiredJointsVisiblePct(
  checks: CaptureReadinessCheck[],
): number {
  const required = checks.filter((c) => c.required && c.id !== "tracking_stable");
  if (required.length === 0) return 0;
  const met = required.filter((c) => c.met).length;
  return Math.round((met / required.length) * 100);
}

export function isPoseDetected(trackingStatus: SitToStandTrackingStatus): boolean {
  return trackingStatus === "pose-found";
}

export function readLiveTimelineSnapshotCount(acc: TimelineAccumulatorProbe): number {
  if (!acc?.isActive()) return 0;
  return Math.max(0, acc.getSnapshotCount());
}

export function isTimelineRecording(
  trackingConfirmed: boolean,
  acc: TimelineAccumulatorProbe,
): boolean {
  return trackingConfirmed && Boolean(acc?.isActive());
}

export function buildPatientCvCaptureReliabilityState(input: {
  cameraActive: boolean;
  trackingStatus: SitToStandTrackingStatus;
  trackingConfirmed: boolean;
  timelineAcc: TimelineAccumulatorProbe;
  detectorPhase: string | undefined;
  readinessChecks: CaptureReadinessCheck[];
  repOrCycleCount: number;
  lastMovementEvent: string;
}): PatientCvCaptureReliabilityState {
  return {
    cameraActive: input.cameraActive,
    poseDetected: isPoseDetected(input.trackingStatus),
    trackingConfirmed: input.trackingConfirmed,
    timelineRecording: isTimelineRecording(input.trackingConfirmed, input.timelineAcc),
    snapshotCount: readLiveTimelineSnapshotCount(input.timelineAcc),
    detectorPhase: input.detectorPhase ?? "—",
    requiredJointsVisiblePct: computeRequiredJointsVisiblePct(input.readinessChecks),
    repOrCycleCount: input.repOrCycleCount,
    lastMovementEvent: input.lastMovementEvent || "—",
  };
}

export function shouldShowNoSnapshotCaptureWarning(input: {
  trackingConfirmed: boolean;
  trackingConfirmedAtMs: number | null;
  snapshotCount: number;
  nowMs: number;
}): boolean {
  if (!input.trackingConfirmed) return false;
  if (input.trackingConfirmedAtMs == null) return false;
  if (input.snapshotCount > 0) return false;
  return input.nowMs - input.trackingConfirmedAtMs >= CAPTURE_RELIABILITY_WARNING_DELAY_MS;
}

export function appendNoTimelineSnapshotsFlag(
  flags: string[],
  snapshotCount: number,
): string[] {
  if (snapshotCount > 0) return flags;
  const next = new Set(flags);
  next.add(NO_TIMELINE_SNAPSHOTS_FLAG);
  return [...next].sort();
}

export function resolveLastMovementEvent(input: {
  previousRepCount: number;
  previousMovementDetected: boolean;
  previousPhase: string | undefined;
  previousTrackingStatus: SitToStandTrackingStatus;
  repCount: number;
  movementDetected: boolean;
  phase: string | undefined;
  trackingStatus: SitToStandTrackingStatus;
  exerciseId: PatientCvExerciseId;
}): string | null {
  if (input.repCount > input.previousRepCount) {
    return input.exerciseId === "single-leg-stance"
      ? `Hold updated (${input.repCount}s)`
      : `Rep counted (${input.repCount})`;
  }
  if (input.movementDetected && !input.previousMovementDetected) {
    return "Movement detected";
  }
  if (input.phase && input.phase !== input.previousPhase) {
    return `Phase: ${input.phase}`;
  }
  if (
    input.trackingStatus === "pose-found" &&
    input.previousTrackingStatus !== "pose-found"
  ) {
    return "Pose found";
  }
  if (
    input.trackingStatus === "pose-lost" &&
    input.previousTrackingStatus === "pose-found"
  ) {
    return "Pose lost";
  }
  return null;
}
