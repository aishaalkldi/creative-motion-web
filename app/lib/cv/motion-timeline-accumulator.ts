/**
 * Phase 1 — in-memory 1 Hz motion snapshot collector (browser only).
 * Never persisted. Destroy after summary generation.
 */

import type { MotionSnapshot, MotionSnapshotEvent } from "@/app/lib/cv/motion-evidence.types";

export type MotionTimelineTickInput = {
  nowMs: number;
  posePresent: boolean;
  trackingQuality: MotionSnapshot["trackingQuality"];
  repCountConfirmed: number;
  visibility: MotionSnapshot["visibility"];
  movementPhase: MotionSnapshot["movement"]["phase"];
  events?: MotionSnapshotEvent[];
};

export class MotionTimelineAccumulator {
  private snapshots: MotionSnapshot[] = [];
  private lastSampleAtMs = -1000;
  private pendingTick: MotionTimelineTickInput | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly sampleIntervalMs = 1000;
  private wasPosePresent = true;

  startSession(): void {
    this.destroy();
    this.snapshots = [];
    this.lastSampleAtMs = -this.sampleIntervalMs;
    this.pendingTick = null;
    this.wasPosePresent = true;
  }

  updatePending(input: MotionTimelineTickInput): void {
    const events = [...(input.events ?? [])];
    if (!input.posePresent && this.wasPosePresent) {
      events.push("pose_lost");
    } else if (input.posePresent && !this.wasPosePresent) {
      events.push("pose_recovered");
    }
    this.wasPosePresent = input.posePresent;
    this.pendingTick = { ...input, events };
  }

  startSampling(onSample?: (snapshot: MotionSnapshot) => void): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      const snapshot = this.sampleSecond();
      if (snapshot) onSample?.(snapshot);
    }, this.sampleIntervalMs);
  }

  sampleSecond(): MotionSnapshot | null {
    if (!this.pendingTick) return null;
    const { nowMs } = this.pendingTick;
    if (nowMs - this.lastSampleAtMs < this.sampleIntervalMs) return null;

    const snapshot: MotionSnapshot = {
      t: nowMs,
      posePresent: this.pendingTick.posePresent,
      trackingQuality: this.pendingTick.posePresent
        ? this.pendingTick.trackingQuality
        : "lost",
      repCountConfirmed: this.pendingTick.repCountConfirmed,
      visibility: { ...this.pendingTick.visibility },
      movement: { phase: this.pendingTick.movementPhase },
      events: [...(this.pendingTick.events ?? [])],
    };

    this.snapshots.push(snapshot);
    this.lastSampleAtMs = nowMs;
    this.pendingTick = { ...this.pendingTick, events: [] };
    return snapshot;
  }

  getSnapshots(): readonly MotionSnapshot[] {
    return this.snapshots;
  }

  endSession(): MotionSnapshot[] {
    this.sampleSecond();
    return [...this.snapshots];
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.snapshots = [];
    this.pendingTick = null;
    this.lastSampleAtMs = -this.sampleIntervalMs;
    this.wasPosePresent = true;
  }
}
