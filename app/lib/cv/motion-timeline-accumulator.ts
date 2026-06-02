/**
 * SMT-1 / PR2 — In-memory 1 Hz STS motion timeline (browser only).
 * Derived MotionSnapshot per second; never persisted. No video, images, or landmarks.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import type {
  MotionSnapshot,
  StsMotionSnapshotEvent,
} from "@/app/lib/cv/motion-summary-types";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

/** Derived tick passed each frame; maps to one per-second MotionSnapshot bucket. */
export type StsMotionTimelineTickInput = {
  /** Session elapsed seconds (wall-clock from detector `sessionSeconds`). */
  sessionSeconds: number;
  posePresent: boolean;
  trackingQuality: CvTrackingQuality | "lost";
  repCount: number;
  movementDetected: boolean;
  movementPhase: MotionSnapshot["movementPhase"];
  visibility: MotionSnapshot["visibility"];
  bodyFraming?: BodyFramingProfileId;
  /** Extra events for this tick (merged with derived transition events). */
  events?: readonly StsMotionSnapshotEvent[];
};

function mapStsDetectorTrackingQuality(
  snap: SitToStandDetectorSnapshot,
): CvTrackingQuality | "lost" {
  if (snap.trackingStatus === "pose-lost") return "lost";
  return snap.trackingQuality ?? "unknown";
}

/** Build tick input from existing STS detector snapshot + per-frame derived fields (no detector edits). */
export function stsTimelineTickFromDetectorSnapshot(
  snap: SitToStandDetectorSnapshot,
  derived: {
    movementPhase: MotionSnapshot["movementPhase"];
    visibility: MotionSnapshot["visibility"];
    bodyFraming?: BodyFramingProfileId;
    events?: readonly StsMotionSnapshotEvent[];
  },
): StsMotionTimelineTickInput {
  return {
    sessionSeconds: snap.sessionSeconds,
    posePresent: snap.trackingStatus === "pose-found",
    trackingQuality: mapStsDetectorTrackingQuality(snap),
    bodyFraming: derived.bodyFraming,
    repCount: snap.repCount,
    movementDetected: snap.movementDetected,
    movementPhase: derived.movementPhase,
    visibility: derived.visibility,
    events: derived.events,
  };
}

/** Map STS stand phase to timeline movement phase (caller supplies stand phase at tick time). */
export function stsMovementPhaseFromStandPhase(
  standPhase: "up" | "down",
): MotionSnapshot["movementPhase"] {
  return standPhase === "up" ? "standing" : "seated";
}

function deriveTransitionEvents(
  prev: StsMotionTimelineTickInput | null,
  curr: StsMotionTimelineTickInput,
): StsMotionSnapshotEvent[] {
  const events = new Set<StsMotionSnapshotEvent>(curr.events ?? []);
  if (prev) {
    if (curr.repCount > prev.repCount) events.add("rep_completed");
    if (!curr.posePresent && prev.posePresent) events.add("pose_lost");
    if (curr.posePresent && !prev.posePresent) events.add("pose_recovered");
    if (curr.movementDetected && !prev.movementDetected) events.add("movement_detected");
  }
  return [...events];
}

function mergeEvents(
  existing: readonly StsMotionSnapshotEvent[],
  next: readonly StsMotionSnapshotEvent[],
): StsMotionSnapshotEvent[] {
  return [...new Set([...existing, ...next])];
}

function buildMotionSnapshot(
  input: StsMotionTimelineTickInput,
  events: StsMotionSnapshotEvent[],
): MotionSnapshot {
  return {
    tSec: Math.max(0, Math.floor(input.sessionSeconds)),
    exerciseId: "sit-to-stand",
    posePresent: input.posePresent,
    trackingQuality: input.trackingQuality,
    bodyFraming: input.bodyFraming,
    repCount: input.repCount,
    movementPhase: input.movementPhase,
    visibility: {
      hip: input.visibility.hip,
      knee: input.visibility.knee,
      ankle: input.visibility.ankle,
    },
    events,
  };
}

/**
 * Sit-to-Stand only — collects derived MotionSnapshot at 1 Hz in memory.
 * Call `clear` / `reset` / `stop` to discard; never persists timeline data.
 */
export class MotionTimelineAccumulator {
  private snapshotsBySec = new Map<number, MotionSnapshot>();
  private prevTick: StsMotionTimelineTickInput | null = null;
  private active = false;

  /** Begin sampling; clears any prior timeline. */
  start(): void {
    this.clear();
    this.active = true;
  }

  /** Discard timeline and stop sampling. */
  stop(): void {
    this.active = false;
    this.clear();
  }

  /** Discard timeline and stop sampling (alias for session reset). */
  reset(): void {
    this.stop();
  }

  /** Discard all in-memory snapshots. */
  clear(): void {
    this.snapshotsBySec.clear();
    this.prevTick = null;
  }

  isActive(): boolean {
    return this.active;
  }

  /** Record a derived tick; at most one snapshot per integer second (last tick wins). */
  recordTick(input: StsMotionTimelineTickInput): void {
    if (!this.active) return;

    const events = deriveTransitionEvents(this.prevTick, input);
    const tSec = Math.max(0, Math.floor(input.sessionSeconds));
    const next = buildMotionSnapshot(input, events);

    const existing = this.snapshotsBySec.get(tSec);
    if (existing) {
      this.snapshotsBySec.set(tSec, {
        ...next,
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

  /** Chronological derived snapshots (in-memory only). */
  getSnapshots(): readonly MotionSnapshot[] {
    return [...this.snapshotsBySec.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, snap]) => snap);
  }
}

/** Privacy guard — timeline payloads must not contain raw capture artifacts. */
export function findForbiddenKeysInTimelinePayload(value: unknown): string[] {
  return findForbiddenKeysInSummaryPayload(value);
}
