/**
 * Run: npx tsx --test app/lib/post-stroke-objective/sts-cv-output-adapter.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StsMotionPilotRecord } from "@/app/lib/cv/sts-motion-pilot-record";
import { mapStsMotionPilotToFiveTimesStsResult } from "@/app/lib/post-stroke-objective/sts-cv-output-adapter";

function buildPilot(overrides: Partial<StsMotionPilotRecord> = {}): StsMotionPilotRecord {
  return {
    pilotVersion: "smt-1",
    isPilot: true,
    exerciseId: "sit-to-stand",
    snapshotCount: 10,
    durationS: 12.5,
    repCount: 3,
    completeReps: 2,
    unclearReps: 1,
    trackingSignal: "fair",
    movementDetected: true,
    phaseRatios: {},
    repTimings: { avgS: 2.5, fastestS: 2.1, slowestS: 3.0 },
    visibilityRatios: { hip: 0.9, knee: 0.8, ankle: 0.7 },
    clinicianFlags: ["pose_tracking_interrupted"],
    reviewRequired: true,
    reviewReason: "Pilot record",
    disclaimer: "For therapist review only.",
    captureQuality: {
      level: "fair",
      reasons: [],
      flags: [],
    },
    ...overrides,
  };
}

describe("sts-cv-output-adapter", () => {
  it("maps pilot rep count and duration without inventing diagnosis fields", () => {
    const result = mapStsMotionPilotToFiveTimesStsResult({
      protocol: "standard_5xsts",
      pilot: buildPilot(),
      startedAt: "2026-07-30T12:00:00.000Z",
      completedAt: "2026-07-30T12:00:12.500Z",
      sourceCvMetricId: "metric-1",
    });
    assert.equal(result.repetitionsCompleted, 3);
    assert.equal(result.completionState, "interrupted");
    assert.equal(result.tracking?.interruptions, 1);
    assert.equal(result.sourceCvMetricId, "metric-1");
    assert.equal("diagnosis" in result, false);
  });

  it("maps five completed reps to completed state while retaining standard protocol externally", () => {
    const result = mapStsMotionPilotToFiveTimesStsResult({
      protocol: "standard_5xsts",
      pilot: buildPilot({ repCount: 5, clinicianFlags: [] }),
    });
    assert.equal(result.completionState, "completed");
    assert.equal(result.repetitionsCompleted, 5);
  });
});
