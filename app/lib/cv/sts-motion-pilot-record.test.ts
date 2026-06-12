/**
 * Run: npx tsx --test app/lib/cv/sts-motion-pilot-record.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";
import {
  buildMotionQualityWithStsPilot,
  buildStsMotionPilotRecord,
  findForbiddenKeysInStsPilotRecord,
  STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
} from "@/app/lib/cv/sts-motion-pilot-record";

const SUMMARY: SessionMotionSummary = {
  schemaVersion: "smt-1",
  exerciseId: "sit-to-stand",
  sessionDurationS: 12,
  legacyRepCount: 3,
  completeRepCount: 2,
  unclearRepCount: 1,
  trackingQualityDistribution: { good: 8, fair: 2, poor: 0, unknown: 1, lost: 1 },
  visibilityAssist: { hipVisiblePct: 80, kneeVisiblePct: 75, ankleVisiblePct: 70 },
  interruptions: { poseLossEventCount: 1, longestPoseLossGapMs: 500 },
  repDurationSummary: {
    avgDurationS: 2,
    fastestDurationS: 1.5,
    slowestDurationS: 3,
    completedRepCount: 2,
  },
  phaseRatios: { rising: 40, standing: 60 },
  captureFlags: ["short_cycle"],
  observations: [],
  capturedAt: "2026-06-02T12:00:00.000Z",
  patientVisible: false,
  clinicianReviewRequired: true,
  therapistReviewHint: "derived_motion_summary_only",
};

describe("buildStsMotionPilotRecord", () => {
  it("builds allowed pilot evidence fields only", () => {
    const record = buildStsMotionPilotRecord({
      summary: SUMMARY,
      metrics: {
        exerciseId: "sit-to-stand",
        repCount: 3,
        sessionDurationS: 12,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 100,
        framesTotal: 120,
      },
      snapshotCount: 10,
    });

    assert.equal(record.pilotVersion, "smt-1");
    assert.equal(record.isPilot, true);
    assert.equal(record.exerciseId, "sit-to-stand");
    assert.equal(record.snapshotCount, 10);
    assert.equal(record.durationS, 12);
    assert.equal(record.repCount, 3);
    assert.equal(record.completeReps, 2);
    assert.equal(record.unclearReps, 1);
    assert.equal(record.movementDetected, true);
    assert.equal(record.reviewRequired, true);
    assert.deepEqual(record.phaseRatios, { rising: 40, standing: 60 });
    assert.deepEqual(record.repTimings, {
      avgS: 2,
      fastestS: 1.5,
      slowestS: 3,
    });
    assert.deepEqual(record.visibilityRatios, { hip: 80, knee: 75, ankle: 70 });
    assert.ok(record.clinicianFlags.includes("short_cycle"));
    assert.ok(record.clinicianFlags.includes("unclear_reps_recorded"));
    assert.ok(record.attemptSummaries);
    assert.deepEqual(
      [...STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort(),
      Object.keys(record).sort(),
    );
    assert.deepEqual(findForbiddenKeysInStsPilotRecord(record), []);
  });

  it("merges smtPilot without removing other motion_quality keys", () => {
    const record = buildStsMotionPilotRecord({
      summary: SUMMARY,
      metrics: {
        exerciseId: "sit-to-stand",
        repCount: 3,
        sessionDurationS: 12,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 10,
        framesTotal: 10,
      },
      snapshotCount: 5,
    });

    const merged = buildMotionQualityWithStsPilot(record, { futurePhase: "mqe-0" });
    assert.equal(merged.futurePhase, "mqe-0");
    assert.equal(merged.smtPilot?.snapshotCount, 5);
  });
});
