/**
 * Run: npx tsx --test app/lib/cv/sts-timeline-tick-builder.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import {
  buildStsTimelineTickFromCaptureState,
  findForbiddenKeysInStsTimelineTick,
  stsMovementPhaseFromCaptureSnapshot,
  stsMovementPhaseFromStandPhase,
  stsVisibilityFromCaptureSnapshot,
} from "@/app/lib/cv/sts-timeline-tick-builder";

const BASE_SNAPSHOT: SitToStandDetectorSnapshot = {
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
};

describe("stsMovementPhaseFromStandPhase", () => {
  it("maps down to seated and up to standing", () => {
    assert.equal(stsMovementPhaseFromStandPhase("down"), "seated");
    assert.equal(stsMovementPhaseFromStandPhase("up"), "standing");
  });
});

describe("stsVisibilityFromCaptureSnapshot", () => {
  it("maps tracking quality to assistive visibility scalars", () => {
    assert.deepEqual(
      stsVisibilityFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        trackingStatus: "pose-found",
        trackingQuality: "good",
      }),
      { hip: 0.8, knee: 0.8, ankle: 0.8 },
    );
    assert.deepEqual(
      stsVisibilityFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        trackingStatus: "pose-found",
        trackingQuality: "fair",
      }),
      { hip: 0.55, knee: 0.55, ankle: 0.55 },
    );
    assert.deepEqual(
      stsVisibilityFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        trackingStatus: "pose-found",
        trackingQuality: "poor",
      }),
      { hip: 0.3, knee: 0.3, ankle: 0.3 },
    );
  });

  it("caps visibility when framing reports low_visibility", () => {
    assert.deepEqual(
      stsVisibilityFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        trackingStatus: "pose-found",
        trackingQuality: "good",
        bodyFramingState: "low_visibility",
      }),
      { hip: 0.35, knee: 0.35, ankle: 0.35 },
    );
  });

  it("returns zero visibility on pose lost", () => {
    assert.deepEqual(
      stsVisibilityFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        trackingStatus: "pose-lost",
        trackingQuality: "good",
      }),
      { hip: 0, knee: 0, ankle: 0 },
    );
  });
});

describe("stsMovementPhaseFromCaptureSnapshot", () => {
  it("uses stand phase when provided", () => {
    assert.equal(
      stsMovementPhaseFromCaptureSnapshot(BASE_SNAPSHOT, "up"),
      "standing",
    );
    assert.equal(
      stsMovementPhaseFromCaptureSnapshot(BASE_SNAPSHOT, "down"),
      "seated",
    );
  });

  it("returns unknown on pose lost without stand phase", () => {
    assert.equal(
      stsMovementPhaseFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        trackingStatus: "pose-lost",
      }),
      "unknown",
    );
  });

  it("returns rest during baseline calibration", () => {
    assert.equal(
      stsMovementPhaseFromCaptureSnapshot({
        ...BASE_SNAPSHOT,
        isBaselineCalibrating: true,
      }),
      "rest",
    );
  });
});

describe("buildStsTimelineTickFromCaptureState", () => {
  it("maps a tracking snapshot into StsMotionTimelineTickInput", () => {
    const snap: SitToStandDetectorSnapshot = {
      ...BASE_SNAPSHOT,
      trackingStatus: "pose-found",
      trackingQuality: "good",
      sessionSeconds: 5,
      repCount: 2,
      movementDetected: true,
      previewActive: true,
    };

    const tick = buildStsTimelineTickFromCaptureState(snap, { standPhase: "up" });

    assert.equal(tick.sessionSeconds, 5);
    assert.equal(tick.posePresent, true);
    assert.equal(tick.trackingQuality, "good");
    assert.equal(tick.repCount, 2);
    assert.equal(tick.movementDetected, true);
    assert.equal(tick.movementPhase, "standing");
    assert.deepEqual(tick.visibility, { hip: 0.8, knee: 0.8, ankle: 0.8 });
    assert.equal(tick.bodyFraming, PATIENT_STS_CONFIG.bodyFramingProfileId);
  });

  it("maps pose lost to tracking quality lost", () => {
    const tick = buildStsTimelineTickFromCaptureState({
      ...BASE_SNAPSHOT,
      trackingStatus: "pose-lost",
      trackingQuality: "poor",
      sessionSeconds: 2,
    });

    assert.equal(tick.posePresent, false);
    assert.equal(tick.trackingQuality, "lost");
    assert.equal(tick.movementPhase, "unknown");
    assert.deepEqual(tick.visibility, { hip: 0, knee: 0, ankle: 0 });
  });

  it("assigns body framing from context override", () => {
    const tick = buildStsTimelineTickFromCaptureState(BASE_SNAPSHOT, {
      bodyFraming: "seated-rise",
    });
    assert.equal(tick.bodyFraming, "seated-rise");
  });

  it("passes through optional events", () => {
    const tick = buildStsTimelineTickFromCaptureState(BASE_SNAPSHOT, {
      events: ["rep_unclear"],
    });
    assert.deepEqual(tick.events, ["rep_unclear"]);
  });

  it("produces deterministic output for the same snapshot", () => {
    const snap: SitToStandDetectorSnapshot = {
      ...BASE_SNAPSHOT,
      trackingStatus: "pose-found",
      trackingQuality: "fair",
      sessionSeconds: 3,
      repCount: 1,
      movementDetected: true,
    };
    const a = buildStsTimelineTickFromCaptureState(snap);
    const b = buildStsTimelineTickFromCaptureState(snap);
    assert.deepEqual(a, b);
  });

  it("rejects forbidden keys in serialized tick payload", () => {
    const tick = buildStsTimelineTickFromCaptureState({
      ...BASE_SNAPSHOT,
      trackingStatus: "pose-found",
      trackingQuality: "good",
    });
    assert.deepEqual(findForbiddenKeysInStsTimelineTick(tick), []);

    const serialized = JSON.stringify(tick);
    assert.equal(serialized.includes("landmark"), false);
    assert.equal(serialized.includes("video"), false);
    assert.equal(serialized.includes("image"), false);
  });
});
