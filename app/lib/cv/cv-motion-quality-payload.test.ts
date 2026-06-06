/**
 * Run: npx tsx --test app/lib/cv/cv-motion-quality-payload.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCvMotionQualityPayload } from "@/app/lib/cv/cv-motion-quality-payload";
import { buildStsMotionPilotRecord } from "@/app/lib/cv/sts-motion-pilot-record";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";

const SUMMARY: SessionMotionSummary = {
  schemaVersion: "smt-1",
  exerciseId: "sit-to-stand",
  sessionDurationS: 5,
  legacyRepCount: 1,
  completeRepCount: 1,
  unclearRepCount: 0,
  trackingQualityDistribution: { good: 4, fair: 0, poor: 0, unknown: 1, lost: 0 },
  visibilityAssist: { hipVisiblePct: 80, kneeVisiblePct: 80, ankleVisiblePct: 80 },
  interruptions: { poseLossEventCount: 0, longestPoseLossGapMs: 0 },
  repDurationSummary: {
    avgDurationS: 2,
    fastestDurationS: 2,
    slowestDurationS: 2,
    completedRepCount: 1,
  },
  phaseRatios: { standing: 100 },
  captureFlags: [],
  observations: [],
  capturedAt: "2026-06-02T12:00:00.000Z",
  patientVisible: false,
  clinicianReviewRequired: true,
  therapistReviewHint: "derived_motion_summary_only",
};

describe("validateCvMotionQualityPayload", () => {
  it("accepts motion_quality with smtPilot evidence", () => {
    const record = buildStsMotionPilotRecord({
      summary: SUMMARY,
      metrics: {
        exerciseId: "sit-to-stand",
        repCount: 1,
        sessionDurationS: 5,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 10,
        framesTotal: 10,
      },
      snapshotCount: 4,
    });

    assert.equal(
      validateCvMotionQualityPayload({ smtPilot: record, otherPhase: "mqe-0" }),
      null,
    );
  });

  it("rejects forbidden keys inside motion_quality", () => {
    assert.ok(
      validateCvMotionQualityPayload({ landmarks: [] }) !== null,
    );
  });

  it("rejects invalid smtPilot shape", () => {
    assert.ok(validateCvMotionQualityPayload({ smtPilot: { pilotVersion: "x" } }) !== null);
  });
});
