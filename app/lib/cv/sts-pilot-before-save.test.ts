/**
 * Run: npx tsx --test app/lib/cv/sts-pilot-before-save.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import { PATIENT_STS_CONFIG, type CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import {
  createStsTimelineCaptureRefs,
  tryFinalizeStsTimelineBeforePilotSave,
  finalizeStsMotionTimelineCapture,
} from "@/app/lib/cv/patient-cv-sts-timeline";
import {
  buildMotionQualityWithStsPilot,
  buildStsMotionPilotRecord,
} from "@/app/lib/cv/sts-motion-pilot-record";

function stsMetricsSource(repCount = 2) {
  return {
    getDerivedMetrics: () => ({
      exerciseId: "sit-to-stand" as const,
      repCount,
      sessionDurationS: 12,
      trackingQuality: "good" as const,
      movementDetected: true,
      framesWithPose: 100,
      framesTotal: 120,
    }),
  };
}

function seedActiveTimeline(refs: ReturnType<typeof createStsTimelineCaptureRefs>) {
  const acc = new MotionTimelineAccumulator();
  acc.start();
  refs.acc.current = acc;
  refs.finalized.current = false;
  refs.summary.current = null;
  acc.recordTick({
    sessionSeconds: 0,
    posePresent: true,
    trackingQuality: "good",
    repCount: 1,
    movementDetected: true,
    movementPhase: "standing",
    visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    bodyFraming: "seated-rise",
  });
  acc.recordTick({
    sessionSeconds: 1,
    posePresent: true,
    trackingQuality: "good",
    repCount: 1,
    movementDetected: true,
    movementPhase: "standing",
    visibility: { hip: 0.8, knee: 0.8, ankle: 0.8 },
    bodyFraming: "seated-rise",
  });
}

function withStsTimelineEnabled<T>(run: () => T): T {
  const prev = PATIENT_STS_CONFIG.motionTimelineEnabled;
  PATIENT_STS_CONFIG.motionTimelineEnabled = true;
  try {
    return run();
  } finally {
    if (prev === undefined) {
      delete PATIENT_STS_CONFIG.motionTimelineEnabled;
    } else {
      PATIENT_STS_CONFIG.motionTimelineEnabled = prev;
    }
  }
}

describe("tryFinalizeStsTimelineBeforePilotSave", () => {
  it("finalizes STS pilot timeline when Complete runs without prior Stop", () => {
    withStsTimelineEnabled(() => {
    const refs = createStsTimelineCaptureRefs();
    seedActiveTimeline(refs);
    const metricsSource = stsMetricsSource();

    const summary = tryFinalizeStsTimelineBeforePilotSave(
      "sit-to-stand",
      refs,
      metricsSource,
      true,
    );

    assert.ok(summary);
    assert.equal(refs.finalized.current, true);
    assert.equal(refs.summary.current, summary);
    assert.equal(refs.acc.current, null);

    const record = buildStsMotionPilotRecord({
      summary,
      metrics: metricsSource.getDerivedMetrics(),
      snapshotCount: refs.lastFinalizeSnapshotCount.current ?? 0,
    });
    const motionQuality = buildMotionQualityWithStsPilot(record);
    assert.equal(motionQuality.smtPilot?.exerciseId, "sit-to-stand");
    assert.equal(motionQuality.smtPilot?.isPilot, true);
    });
  });

  it("does not double-finalize after Stop then Complete", () => {
    withStsTimelineEnabled(() => {
    const refs = createStsTimelineCaptureRefs();
    seedActiveTimeline(refs);
    const metricsSource = stsMetricsSource();

    const first = tryFinalizeStsTimelineBeforePilotSave(
      "sit-to-stand",
      refs,
      metricsSource,
      true,
    );
    assert.ok(first);

    const second = tryFinalizeStsTimelineBeforePilotSave(
      "sit-to-stand",
      refs,
      metricsSource,
      true,
    );
    assert.equal(second, first);
    assert.equal(refs.summary.current, first);

    const viaCaptureApi = finalizeStsMotionTimelineCapture(
      "sit-to-stand",
      refs,
      metricsSource,
    );
    assert.equal(viaCaptureApi, first);
    });
  });

  it("skips finalize when caller passes gate false", () => {
    withStsTimelineEnabled(() => {
    const refs = createStsTimelineCaptureRefs();
    seedActiveTimeline(refs);

    const summary = tryFinalizeStsTimelineBeforePilotSave(
      "sit-to-stand",
      refs,
      stsMetricsSource(),
      false,
    );

    assert.equal(summary, null);
    assert.equal(refs.finalized.current, false);
    assert.notEqual(refs.acc.current, null);
    });
  });

  const nonStsExercises: CvY1ExerciseId[] = ["mini-squat", "single-leg-stance"];

  for (const exerciseId of nonStsExercises) {
    it(`does not finalize smtPilot path for ${exerciseId}`, () => {
      withStsTimelineEnabled(() => {
      const refs = createStsTimelineCaptureRefs();
      seedActiveTimeline(refs);

      const summary = tryFinalizeStsTimelineBeforePilotSave(
        exerciseId,
        refs,
        stsMetricsSource(),
        true,
      );

      assert.equal(summary, null);
      assert.equal(refs.finalized.current, false);
      });
    });
  }

  it("returns null when metrics source is missing", () => {
    withStsTimelineEnabled(() => {
    const refs = createStsTimelineCaptureRefs();
    seedActiveTimeline(refs);

    assert.equal(
      tryFinalizeStsTimelineBeforePilotSave("sit-to-stand", refs, null, true),
      null,
    );
    assert.equal(refs.finalized.current, false);
    });
  });
});
