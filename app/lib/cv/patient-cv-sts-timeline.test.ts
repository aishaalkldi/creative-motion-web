/**
 * Run: npx tsx --test app/lib/cv/patient-cv-sts-timeline.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import {
  beginStsMotionTimeline,
  createStsTimelineCaptureRefs,
  disposeStsMotionTimelineRefs,
  finalizeStsMotionTimelineCapture,
  recordStsMotionTimelineTick,
  stsMotionTimelineFinalizeSkipReason,
} from "@/app/lib/cv/patient-cv-sts-timeline";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";

const BASE_SNAPSHOT: SitToStandDetectorSnapshot = {
  trackingStatus: "pose-found",
  trackingQuality: "good",
  poseReadiness: "ready",
  bodyFramingState: "good_distance",
  repCount: 0,
  sessionSeconds: 0,
  movementDetected: false,
  framesWithPose: 1,
  framesTotal: 1,
  initPhase: null,
  previewActive: true,
  trackingError: null,
  isBaselineCalibrating: false,
  standPhase: "down",
};

function withStsTimelineDisabled<T>(run: () => T): T {
  const prev = PATIENT_STS_CONFIG.motionTimelineEnabled;
  delete PATIENT_STS_CONFIG.motionTimelineEnabled;
  try {
    return run();
  } finally {
    PATIENT_STS_CONFIG.motionTimelineEnabled = prev;
  }
}

describe("stsMotionTimelineFinalizeSkipReason", () => {
  it("returns not_sts_exercise for mini squat", () => {
    const refs = createStsTimelineCaptureRefs();
    assert.equal(
      stsMotionTimelineFinalizeSkipReason("mini-squat", refs),
      "not_sts_exercise",
    );
  });

  it("returns timeline_disabled when motionTimelineEnabled is off", () => {
    withStsTimelineDisabled(() => {
      const refs = createStsTimelineCaptureRefs();
      assert.equal(
        stsMotionTimelineFinalizeSkipReason("sit-to-stand", refs),
        "timeline_disabled",
      );
    });
  });

  it("returns accumulator_never_started when timeline is enabled but capture never began", () => {
    const refs = createStsTimelineCaptureRefs();
    assert.equal(
      stsMotionTimelineFinalizeSkipReason("sit-to-stand", refs),
      "accumulator_never_started",
    );
  });
});

describe("patient-cv-sts-timeline (flag off)", () => {
  it("no-ops begin, record, and finalize when motionTimelineEnabled is unset", () => {
    withStsTimelineDisabled(() => {
      const refs = createStsTimelineCaptureRefs();
      beginStsMotionTimeline("sit-to-stand", refs);
      recordStsMotionTimelineTick("sit-to-stand", refs, BASE_SNAPSHOT);
      const summary = finalizeStsMotionTimelineCapture("sit-to-stand", refs, {
        getDerivedMetrics: () => ({
          repCount: 2,
          sessionDurationS: 5,
          trackingQuality: "good",
          movementDetected: true,
          framesWithPose: 5,
          framesTotal: 5,
        }),
      });
      assert.equal(summary, null);
      assert.equal(refs.acc.current, null);
      assert.equal(refs.summary.current, null);
    });
  });

  it("no-ops for mini squat even if flag is enabled on STS config only", () => {
    const refs = createStsTimelineCaptureRefs();
    beginStsMotionTimeline("mini-squat", refs);
    assert.equal(refs.acc.current, null);
  });
});

describe("patient-cv-sts-timeline (production enabled)", () => {
  it("accumulates ticks and finalizes once idempotently", () => {
    assert.equal(PATIENT_STS_CONFIG.motionTimelineEnabled, true);
    const refs = createStsTimelineCaptureRefs();
    beginStsMotionTimeline("sit-to-stand", refs);
    assert.ok(refs.acc.current?.isActive());

    recordStsMotionTimelineTick("sit-to-stand", refs, {
      ...BASE_SNAPSHOT,
      sessionSeconds: 1,
      repCount: 1,
    });

    const first = finalizeStsMotionTimelineCapture("sit-to-stand", refs, {
      getDerivedMetrics: () => ({
        repCount: 1,
        sessionDurationS: 1,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 10,
        framesTotal: 10,
      }),
    });
    const second = finalizeStsMotionTimelineCapture("sit-to-stand", refs, {
      getDerivedMetrics: () => ({
        repCount: 99,
        sessionDurationS: 99,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 10,
        framesTotal: 10,
      }),
    });

    assert.ok(first);
    assert.equal(second, first);
    assert.equal(first?.legacyRepCount, 1);
    assert.equal(refs.finalized.current, true);
    assert.equal(refs.acc.current, null);
  });

  it("dispose clears refs after finalize", () => {
    const refs = createStsTimelineCaptureRefs();
    beginStsMotionTimeline("sit-to-stand", refs);
    finalizeStsMotionTimelineCapture("sit-to-stand", refs, {
      getDerivedMetrics: () => ({
        repCount: 0,
        sessionDurationS: 0,
        trackingQuality: "unknown",
        movementDetected: false,
        framesWithPose: 0,
        framesTotal: 0,
      }),
    });
    disposeStsMotionTimelineRefs(refs);
    assert.equal(refs.summary.current, null);
    assert.equal(refs.finalized.current, false);
  });
});
