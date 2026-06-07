/**
 * Run: npx tsx --test app/lib/cv/sts-movement-phase-merge.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import { mergeStsMovementPhaseForBucket } from "@/app/lib/cv/sts-movement-phase-merge";

describe("mergeStsMovementPhaseForBucket", () => {
  it("preserves rising when later same-second tick settles standing", () => {
    assert.equal(
      mergeStsMovementPhaseForBucket("rising", "standing"),
      "rising",
    );
  });

  it("preserves returning when later same-second tick settles seated", () => {
    assert.equal(
      mergeStsMovementPhaseForBucket("returning", "seated"),
      "returning",
    );
  });

  it("allows later edge phase to replace sustained seated", () => {
    assert.equal(
      mergeStsMovementPhaseForBucket("seated", "rising"),
      "rising",
    );
  });
});

describe("MotionTimelineAccumulator edge preservation", () => {
  it("keeps rising/returning visible when transitions happen inside one second", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();

    acc.recordTick({
      sessionSeconds: 5.1,
      posePresent: true,
      trackingQuality: "good",
      repCount: 0,
      movementDetected: true,
      movementPhase: "seated",
      visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    });
    acc.recordTick({
      sessionSeconds: 5.4,
      posePresent: true,
      trackingQuality: "good",
      repCount: 0,
      movementDetected: true,
      movementPhase: "rising",
      visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    });
    acc.recordTick({
      sessionSeconds: 5.9,
      posePresent: true,
      trackingQuality: "good",
      repCount: 1,
      movementDetected: true,
      movementPhase: "standing",
      visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    });

    acc.recordTick({
      sessionSeconds: 6.2,
      posePresent: true,
      trackingQuality: "good",
      repCount: 1,
      movementDetected: true,
      movementPhase: "returning",
      visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    });
    acc.recordTick({
      sessionSeconds: 6.8,
      posePresent: true,
      trackingQuality: "good",
      repCount: 1,
      movementDetected: true,
      movementPhase: "seated",
      visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    });

    const snaps = acc.getSnapshots();
    assert.equal(snaps.find((s) => s.tSec === 5)?.movementPhase, "rising");
    assert.equal(snaps.find((s) => s.tSec === 6)?.movementPhase, "returning");
  });
});
