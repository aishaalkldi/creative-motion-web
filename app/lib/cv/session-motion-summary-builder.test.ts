/**
 * Run: npx tsx --test app/lib/cv/session-motion-summary-builder.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MotionSnapshot } from "@/app/lib/cv/motion-evidence.types";
import { buildSessionMotionEvidenceSummary } from "@/app/lib/cv/session-motion-summary-builder";

const CAPTURED_AT = "2026-06-01T10:00:00.000Z";

function snap(
  t: number,
  overrides: Partial<MotionSnapshot> = {},
): MotionSnapshot {
  return {
    t,
    posePresent: true,
    trackingQuality: "good",
    repCountConfirmed: 0,
    visibility: { hip: 0.8, knee: 0.75, ankle: 0.7 },
    movement: { phase: "rest" },
    events: [],
    ...overrides,
  };
}

describe("buildSessionMotionEvidenceSummary", () => {
  it("returns deterministic empty session summary", () => {
    const summary = buildSessionMotionEvidenceSummary({
      exerciseId: "sit-to-stand",
      snapshots: [],
      repsDetected: 0,
      repEvents: [],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.schemaVersion, "sms-1");
    assert.equal(summary.durationS, 0);
    assert.equal(summary.repsDetected, 0);
    assert.equal(summary.completeReps, 0);
    assert.equal(summary.unclearReps, 0);
    assert.deepEqual(summary.trackingDistribution, { good: 0, fair: 0, poor: 0, lost: 0 });
    assert.deepEqual(summary.tempoProfile, {
      avgRepDurationS: null,
      fastestRepS: null,
      slowestRepS: null,
    });
    assert.equal(summary.capturedAt, CAPTURED_AT);
  });

  it("rolls up tracking distribution and visibility percentages", () => {
    const snapshots = [
      snap(0, { trackingQuality: "good" }),
      snap(1000, { trackingQuality: "fair", visibility: { hip: 0.5, knee: 0.3, ankle: 0.2 } }),
      snap(2000, { trackingQuality: "poor", posePresent: false, trackingQuality: "lost" }),
    ];

    const summary = buildSessionMotionEvidenceSummary({
      exerciseId: "sit-to-stand",
      snapshots,
      repsDetected: 1,
      repEvents: [{ repIndex: 1, completed: true, durationMs: 2500, flags: ["complete_rep"] }],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.durationS, 2);
    assert.equal(summary.trackingDistribution.good, 1);
    assert.equal(summary.trackingDistribution.fair, 1);
    assert.equal(summary.trackingDistribution.lost, 1);
    assert.equal(summary.visibility.hipPct, 67);
    assert.equal(summary.completeReps, 1);
    assert.equal(summary.unclearReps, 0);
    assert.ok(summary.movementFlags.includes("complete_rep"));
  });

  it("computes tempo profile from completed rep events", () => {
    const summary = buildSessionMotionEvidenceSummary({
      exerciseId: "sit-to-stand",
      snapshots: [snap(0), snap(3000), snap(6000)],
      repsDetected: 2,
      repEvents: [
        { repIndex: 1, completed: true, durationMs: 2000, flags: [] },
        { repIndex: 2, completed: true, durationMs: 3000, flags: [] },
      ],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.tempoProfile.avgRepDurationS, 2.5);
    assert.equal(summary.tempoProfile.fastestRepS, 2);
    assert.equal(summary.tempoProfile.slowestRepS, 3);
  });

  it("counts pose loss interruptions and flags incomplete reps", () => {
    const snapshots = [
      snap(0, { events: ["pose_lost"] }),
      snap(1000, { posePresent: false, trackingQuality: "lost", events: ["pose_lost"] }),
      snap(2000, { events: ["pose_recovered"] }),
    ];

    const summary = buildSessionMotionEvidenceSummary({
      exerciseId: "sit-to-stand",
      snapshots,
      repsDetected: 1,
      repEvents: [
        {
          repIndex: 1,
          completed: false,
          durationMs: null,
          flags: ["incomplete_return"],
        },
      ],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.interruptions.poseLossCount, 2);
    assert.equal(summary.unclearReps, 1);
    assert.ok(summary.movementFlags.includes("incomplete_cycle"));
    assert.ok(summary.movementFlags.includes("incomplete_return"));
  });

  it("is deterministic for unsorted snapshot input", () => {
    const snapshots = [snap(2000), snap(0), snap(1000)];
    const input = {
      exerciseId: "sit-to-stand" as const,
      snapshots,
      repsDetected: 0,
      repEvents: [],
      capturedAt: CAPTURED_AT,
    };
    const a = buildSessionMotionEvidenceSummary(input);
    const b = buildSessionMotionEvidenceSummary(input);
    assert.deepEqual(a, b);
    assert.equal(a.durationS, 2);
  });
});
