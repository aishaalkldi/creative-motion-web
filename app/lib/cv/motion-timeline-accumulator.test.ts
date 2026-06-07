/**
 * Run: npx tsx --test app/lib/cv/motion-timeline-accumulator.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import {
  findForbiddenKeysInTimelinePayload,
  MotionTimelineAccumulator,
  stsMovementPhaseFromStandPhase,
  stsTimelineTickFromDetectorSnapshot,
  type StsMotionTimelineTickInput,
} from "@/app/lib/cv/motion-timeline-accumulator";
import { buildStsSessionMotionSummary } from "@/app/lib/cv/sts-motion-summary-builder";

const VIS = { hip: 0.8, knee: 0.7, ankle: 0.65 };

function tick(
  sessionSeconds: number,
  overrides: Partial<StsMotionTimelineTickInput> = {},
): StsMotionTimelineTickInput {
  return {
    sessionSeconds,
    posePresent: true,
    trackingQuality: "good",
    repCount: 0,
    movementDetected: false,
    movementPhase: "rest",
    visibility: VIS,
    bodyFraming: "seated-rise",
    ...overrides,
  };
}

const IDLE_STS_SNAPSHOT: SitToStandDetectorSnapshot = {
  trackingStatus: "idle",
  trackingQuality: null,
  poseReadiness: "ready",
  bodyFramingState: "good_distance",
  repCount: 0,
  sessionSeconds: 0,
  movementDetected: false,
  framesWithPose: 0,
  framesTotal: 0,
  initPhase: null,
  previewActive: false,
  trackingError: null,
  isBaselineCalibrating: false,
  standPhase: "down",
};

describe("MotionTimelineAccumulator", () => {
  it("does not record before start", () => {
    const acc = new MotionTimelineAccumulator();
    acc.recordTick(tick(0));
    assert.equal(acc.getSnapshotCount(), 0);
  });

  it("reset and stop clear in-memory timeline", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
    acc.recordTick(tick(0));
    acc.recordTick(tick(1));
    assert.equal(acc.getSnapshotCount(), 2);

    acc.stop();
    assert.equal(acc.getSnapshotCount(), 0);
    assert.equal(acc.isActive(), false);

    acc.start();
    acc.recordTick(tick(0));
    acc.reset();
    assert.equal(acc.getSnapshotCount(), 0);
    assert.equal(acc.isActive(), false);
  });

  it("collects one MotionSnapshot per second (last tick wins within second)", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
    acc.recordTick(tick(0.2, { repCount: 0, movementPhase: "rest" }));
    acc.recordTick(tick(0.8, { repCount: 0, movementPhase: "seated" }));
    acc.recordTick(tick(1.1, { repCount: 1, movementPhase: "standing" }));
    acc.recordTick(tick(2.0, { repCount: 1, movementPhase: "standing" }));

    const snaps = acc.getSnapshots();
    assert.equal(snaps.length, 3);
    assert.equal(snaps[0]!.tSec, 0);
    assert.equal(snaps[0]!.movementPhase, "seated");
    assert.equal(snaps[1]!.tSec, 1);
    assert.equal(snaps[1]!.repCount, 1);
    assert.equal(snaps[2]!.tSec, 2);
    assert.deepEqual(
      snaps.map((s) => s.exerciseId),
      ["sit-to-stand", "sit-to-stand", "sit-to-stand"],
    );
  });

  it("derives rep_completed, pose_lost, pose_recovered, and movement_detected events", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
    acc.recordTick(tick(0, { posePresent: true, movementDetected: false }));
    acc.recordTick(tick(1, { posePresent: false, movementDetected: false }));
    acc.recordTick(tick(2, { posePresent: true, movementDetected: true, repCount: 1 }));

    const events = acc.getSnapshots().flatMap((s) => s.events);
    assert.ok(events.includes("pose_lost"));
    assert.ok(events.includes("pose_recovered"));
    assert.ok(events.includes("movement_detected"));
    assert.ok(events.includes("rep_completed"));
  });

  it("merges explicit events within the same second bucket", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
    acc.recordTick(tick(0.2, { events: ["rep_unclear"] }));
    acc.recordTick(tick(0.7, { repCount: 1 }));

    const snap = acc.getSnapshots()[0]!;
    assert.ok(snap.events.includes("rep_unclear"));
    assert.ok(snap.events.includes("rep_completed"));
  });

  it("feeds buildStsSessionMotionSummary deterministically", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
    for (let sec = 0; sec <= 5; sec += 1) {
      acc.recordTick(
        tick(sec, {
          repCount: sec >= 3 ? 1 : 0,
          movementDetected: sec >= 1,
          visibility: { hip: 0.5, knee: 0.5, ankle: 0.5 },
        }),
      );
    }

    const summary = buildStsSessionMotionSummary({
      snapshots: acc.getSnapshots(),
      legacyRepCount: 1,
      repRecords: [
        { repIndex: 1, completed: true, durationMs: 2500, captureFlags: ["complete_rep"] },
      ],
      capturedAt: "2026-06-02T12:00:00.000Z",
    });

    assert.equal(summary.exerciseId, "sit-to-stand");
    assert.equal(summary.sessionDurationS, 5);
    assert.equal(summary.patientVisible, false);
    assert.equal(summary.clinicianReviewRequired, true);
    assert.equal(summary.interruptions.poseLossEventCount, 0);
  });

  it("rejects forbidden keys in serialized timeline payload", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
    acc.recordTick(tick(0));
    const forbidden = findForbiddenKeysInTimelinePayload(acc.getSnapshots());
    assert.deepEqual(forbidden, []);
  });
});

describe("stsTimelineTickFromDetectorSnapshot", () => {
  it("maps detector snapshot without landmarks or video fields", () => {
    const snap: SitToStandDetectorSnapshot = {
      ...IDLE_STS_SNAPSHOT,
      trackingStatus: "pose-found",
      trackingQuality: "good",
      sessionSeconds: 4,
      repCount: 2,
      movementDetected: true,
    };

    const input = stsTimelineTickFromDetectorSnapshot(snap, {
      movementPhase: stsMovementPhaseFromStandPhase("up"),
      visibility: VIS,
      bodyFraming: "seated-rise",
    });

    assert.equal(input.sessionSeconds, 4);
    assert.equal(input.posePresent, true);
    assert.equal(input.trackingQuality, "good");
    assert.equal(input.repCount, 2);
    assert.equal(input.movementDetected, true);
    assert.equal(input.movementPhase, "standing");
    assert.deepEqual(input.visibility, VIS);

    const serialized = JSON.stringify(input);
    assert.equal(serialized.includes("landmark"), false);
    assert.equal(serialized.includes("video"), false);
  });

  it("maps pose-lost to tracking quality lost", () => {
    const input = stsTimelineTickFromDetectorSnapshot(
      {
        ...IDLE_STS_SNAPSHOT,
        trackingStatus: "pose-lost",
        trackingQuality: "poor",
        sessionSeconds: 2,
      },
      {
        movementPhase: "unknown",
        visibility: { hip: 0, knee: 0, ankle: 0 },
      },
    );
    assert.equal(input.posePresent, false);
    assert.equal(input.trackingQuality, "lost");
  });
});

describe("stsMovementPhaseFromStandPhase", () => {
  it("maps down to seated and up to standing", () => {
    assert.equal(stsMovementPhaseFromStandPhase("down"), "seated");
    assert.equal(stsMovementPhaseFromStandPhase("up"), "standing");
  });
});
