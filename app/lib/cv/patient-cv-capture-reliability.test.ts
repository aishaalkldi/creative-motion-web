/**
 * Run: npx tsx --test app/lib/cv/patient-cv-capture-reliability.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendNoTimelineSnapshotsFlag,
  buildPatientCvCaptureReliabilityState,
  CAPTURE_RELIABILITY_WARNING_DELAY_MS,
  computeRequiredJointsVisiblePct,
  NO_TIMELINE_SNAPSHOTS_FLAG,
  readLiveTimelineSnapshotCount,
  resolveLastMovementEvent,
  shouldShowNoSnapshotCaptureWarning,
} from "./patient-cv-capture-reliability";
import type { CaptureReadinessCheck } from "./patient-cv-capture-readiness";

const CHECKS: CaptureReadinessCheck[] = [
  { id: "body_visible", met: true, required: true },
  { id: "lower_joints_visible", met: true, required: true },
  { id: "tracking_stable", met: false, required: true },
];

describe("computeRequiredJointsVisiblePct", () => {
  it("excludes tracking_stable from joint visibility percent", () => {
    assert.equal(computeRequiredJointsVisiblePct(CHECKS), 100);
  });
});

describe("readLiveTimelineSnapshotCount", () => {
  it("returns 0 when timeline is not active", () => {
    assert.equal(
      readLiveTimelineSnapshotCount({
        getSnapshotCount: () => 4,
        isActive: () => false,
      }),
      0,
    );
  });

  it("returns live count when timeline is active", () => {
    assert.equal(
      readLiveTimelineSnapshotCount({
        getSnapshotCount: () => 4,
        isActive: () => true,
      }),
      4,
    );
  });
});

describe("shouldShowNoSnapshotCaptureWarning", () => {
  it("warns after 5 seconds with zero snapshots", () => {
    const t0 = 10_000;
    assert.equal(
      shouldShowNoSnapshotCaptureWarning({
        trackingConfirmed: true,
        trackingConfirmedAtMs: t0,
        snapshotCount: 0,
        nowMs: t0 + CAPTURE_RELIABILITY_WARNING_DELAY_MS,
      }),
      true,
    );
  });

  it("does not warn before 5 seconds", () => {
    const t0 = 10_000;
    assert.equal(
      shouldShowNoSnapshotCaptureWarning({
        trackingConfirmed: true,
        trackingConfirmedAtMs: t0,
        snapshotCount: 0,
        nowMs: t0 + CAPTURE_RELIABILITY_WARNING_DELAY_MS - 1,
      }),
      false,
    );
  });

  it("does not warn when snapshots are recording", () => {
    assert.equal(
      shouldShowNoSnapshotCaptureWarning({
        trackingConfirmed: true,
        trackingConfirmedAtMs: 0,
        snapshotCount: 2,
        nowMs: 20_000,
      }),
      false,
    );
  });
});

describe("appendNoTimelineSnapshotsFlag", () => {
  it("adds no_timeline_snapshots when snapshot count is zero", () => {
    const flags = appendNoTimelineSnapshotsFlag(["capture_setup_limited"], 0);
    assert.ok(flags.includes(NO_TIMELINE_SNAPSHOTS_FLAG));
    assert.ok(flags.includes("capture_setup_limited"));
  });

  it("skips flag when snapshots exist", () => {
    const flags = appendNoTimelineSnapshotsFlag([], 3);
    assert.deepEqual(flags, []);
  });
});

describe("resolveLastMovementEvent", () => {
  it("reports rep counted events", () => {
    const event = resolveLastMovementEvent({
      previousRepCount: 1,
      previousMovementDetected: true,
      previousPhase: "down",
      previousTrackingStatus: "pose-found",
      repCount: 2,
      movementDetected: true,
      phase: "up",
      trackingStatus: "pose-found",
      exerciseId: "heel-raise",
    });
    assert.equal(event, "Rep counted (2)");
  });
});

describe("buildPatientCvCaptureReliabilityState", () => {
  it("marks timeline recording only after tracking is confirmed", () => {
    const setup = buildPatientCvCaptureReliabilityState({
      cameraActive: true,
      trackingStatus: "pose-found",
      trackingConfirmed: false,
      timelineAcc: { getSnapshotCount: () => 0, isActive: () => true },
      detectorPhase: "down",
      readinessChecks: CHECKS,
      repOrCycleCount: 0,
      lastMovementEvent: "—",
    });
    assert.equal(setup.timelineRecording, false);

    const active = buildPatientCvCaptureReliabilityState({
      cameraActive: true,
      trackingStatus: "pose-found",
      trackingConfirmed: true,
      timelineAcc: { getSnapshotCount: () => 2, isActive: () => true },
      detectorPhase: "up",
      readinessChecks: CHECKS,
      repOrCycleCount: 1,
      lastMovementEvent: "Rep counted (1)",
    });
    assert.equal(active.timelineRecording, true);
    assert.equal(active.snapshotCount, 2);
  });
});
