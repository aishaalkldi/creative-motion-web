/**
 * Run: npx tsx --test app/lib/cv/sts-motion-summary-finalize.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import {
  finalizeStsMotionTimelineSummary,
  legacyRepCountFromDerivedMetrics,
} from "@/app/lib/cv/sts-motion-summary-finalize";

describe("finalizeStsMotionTimelineSummary", () => {
  it("builds in-memory summary with no forbidden keys", () => {
    const acc = new MotionTimelineAccumulator();
    acc.start();
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
    acc.stop();

    const { summary, forbiddenKeys } = finalizeStsMotionTimelineSummary({
      accumulator: acc,
      legacyRepCount: 1,
      capturedAt: "2026-06-02T12:00:00.000Z",
    });

    assert.equal(summary.schemaVersion, "smt-1");
    assert.equal(summary.exerciseId, "sit-to-stand");
    assert.equal(summary.legacyRepCount, 1);
    assert.deepEqual(forbiddenKeys, []);
    assert.deepEqual(
      findForbiddenKeysInSummaryPayload(summary),
      [],
    );
  });
});

describe("legacyRepCountFromDerivedMetrics", () => {
  it("reads repCount from derived metrics", () => {
    assert.equal(
      legacyRepCountFromDerivedMetrics({
        repCount: 3,
        sessionDurationS: 12,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 10,
        framesTotal: 12,
      }),
      3,
    );
  });
});
