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
};

describe("stsMotionTimelineFinalizeSkipReason", () => {
  it("returns not_sts_exercise for mini squat", () => {
    const refs = createStsTimelineCaptureRefs();
    assert.equal(
      stsMotionTimelineFinalizeSkipReason("mini-squat", refs),
      "not_sts_exercise",
    );
  });

  it("returns timeline_disabled when pilot gate is off in Node", () => {
    const refs = createStsTimelineCaptureRefs();
    assert.equal(
      stsMotionTimelineFinalizeSkipReason("sit-to-stand", refs),
      "timeline_disabled",
    );
  });
});

describe("patient-cv-sts-timeline (flag off)", () => {
  it("no-ops begin, record, and finalize when motionTimelineEnabled is unset", () => {
    assert.equal(PATIENT_STS_CONFIG.motionTimelineEnabled, undefined);
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

  it("no-ops for mini squat even if flag were enabled on STS config only", () => {
    const refs = createStsTimelineCaptureRefs();
    beginStsMotionTimeline("mini-squat", refs);
    assert.equal(refs.acc.current, null);
  });
});

describe("patient-cv-sts-timeline (flag on)", () => {
  it("accumulates ticks and finalizes once idempotently", () => {
    const prev = PATIENT_STS_CONFIG.motionTimelineEnabled;
    PATIENT_STS_CONFIG.motionTimelineEnabled = true;
    try {
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
    } finally {
      if (prev === undefined) {
        delete PATIENT_STS_CONFIG.motionTimelineEnabled;
      } else {
        PATIENT_STS_CONFIG.motionTimelineEnabled = prev;
      }
    }
  });

  it("dispose clears refs after finalize", () => {
    const prev = PATIENT_STS_CONFIG.motionTimelineEnabled;
    PATIENT_STS_CONFIG.motionTimelineEnabled = true;
    try {
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
    } finally {
      if (prev === undefined) {
        delete PATIENT_STS_CONFIG.motionTimelineEnabled;
      } else {
        PATIENT_STS_CONFIG.motionTimelineEnabled = prev;
      }
    }
  });
});
