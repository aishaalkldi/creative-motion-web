/**
 * Run: npx tsx --test app/lib/cv/motion-timeline-accumulator.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";

describe("MotionTimelineAccumulator", () => {
  it("collects snapshots at 1 Hz not every update", () => {
    const acc = new MotionTimelineAccumulator();
    acc.startSession();

    acc.updatePending({
      nowMs: 0,
      posePresent: true,
      trackingQuality: "good",
      repCountConfirmed: 0,
      visibility: { hip: 0.8, knee: 0.7, ankle: 0.6 },
      movementPhase: "rest",
    });
    acc.sampleSecond();

    acc.updatePending({
      nowMs: 500,
      posePresent: true,
      trackingQuality: "good",
      repCountConfirmed: 0,
      visibility: { hip: 0.8, knee: 0.7, ankle: 0.6 },
      movementPhase: "rest",
    });
    assert.equal(acc.sampleSecond(), null);

    acc.updatePending({
      nowMs: 1000,
      posePresent: true,
      trackingQuality: "fair",
      repCountConfirmed: 1,
      visibility: { hip: 0.8, knee: 0.7, ankle: 0.6 },
      movementPhase: "peak",
      events: ["rep_completed"],
    });
    acc.sampleSecond();

    const snapshots = acc.endSession();
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[0]!.t, 0);
    assert.equal(snapshots[1]!.repCountConfirmed, 1);
    assert.deepEqual(snapshots[1]!.events, ["rep_completed"]);

    acc.destroy();
    assert.equal(acc.getSnapshots().length, 0);
  });

  it("emits pose_lost and pose_recovered events", () => {
    const acc = new MotionTimelineAccumulator();
    acc.startSession();

    acc.updatePending({
      nowMs: 0,
      posePresent: true,
      trackingQuality: "good",
      repCountConfirmed: 0,
      visibility: { hip: 0.8, knee: 0.7, ankle: 0.6 },
      movementPhase: "rest",
    });
    acc.sampleSecond();

    acc.updatePending({
      nowMs: 1000,
      posePresent: false,
      trackingQuality: "lost",
      repCountConfirmed: 0,
      visibility: { hip: 0, knee: 0, ankle: 0 },
      movementPhase: "rest",
    });
    const lost = acc.sampleSecond();
    assert.ok(lost?.events.includes("pose_lost"));

    acc.updatePending({
      nowMs: 2000,
      posePresent: true,
      trackingQuality: "good",
      repCountConfirmed: 0,
      visibility: { hip: 0.8, knee: 0.7, ankle: 0.6 },
      movementPhase: "rest",
    });
    const recovered = acc.sampleSecond();
    assert.ok(recovered?.events.includes("pose_recovered"));

    acc.destroy();
  });

  it("clears memory on destroy", () => {
    const acc = new MotionTimelineAccumulator();
    acc.startSession();
    acc.updatePending({
      nowMs: 0,
      posePresent: true,
      trackingQuality: "good",
      repCountConfirmed: 0,
      visibility: { hip: 0.8, knee: 0.7, ankle: 0.6 },
      movementPhase: "rest",
    });
    acc.sampleSecond();
    acc.destroy();
    assert.equal(acc.getSnapshots().length, 0);
    assert.equal(acc.endSession().length, 0);
  });
});
