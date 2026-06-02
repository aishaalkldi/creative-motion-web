/**
 * Run: npx tsx --test app/lib/cv/sts-motion-summary-builder.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BiomechanicalObservation, MotionSnapshot } from "@/app/lib/cv/motion-summary-types";
import {
  findForbiddenKeysInSummaryPayload,
  STS_SUMMARY_ALLOWED_TOP_LEVEL_KEYS,
} from "@/app/lib/cv/motion-summary-types";
import { buildStsSessionMotionSummary } from "@/app/lib/cv/sts-motion-summary-builder";

const CAPTURED_AT = "2026-06-02T12:00:00.000Z";

function snap(tSec: number, overrides: Partial<MotionSnapshot> = {}): MotionSnapshot {
  return {
    tSec,
    exerciseId: "sit-to-stand",
    posePresent: true,
    trackingQuality: "good",
    bodyFraming: "seated-rise",
    repCount: 0,
    movementPhase: "rest",
    visibility: { hip: 0.8, knee: 0.75, ankle: 0.7 },
    events: [],
    ...overrides,
  };
}

function assertObservationShape(obs: BiomechanicalObservation): void {
  assert.equal(typeof obs.id, "string");
  assert.ok(obs.id.length > 0);
  assert.ok(
    ["rep_timing", "rep_completion", "tracking_visibility", "session_capture"].includes(
      obs.category,
    ),
  );
  assert.equal(typeof obs.label, "string");
  assert.ok(obs.label.length > 0);
  assert.equal(obs.patientVisible, false);
  assert.equal(obs.clinicianReviewRequired, true);
}

describe("buildStsSessionMotionSummary", () => {
  it("returns empty session with safe defaults", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [],
      legacyRepCount: 0,
      repRecords: [],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.schemaVersion, "smt-1");
    assert.equal(summary.exerciseId, "sit-to-stand");
    assert.equal(summary.sessionDurationS, 0);
    assert.equal(summary.legacyRepCount, 0);
    assert.equal(summary.completeRepCount, 0);
    assert.equal(summary.unclearRepCount, 0);
    assert.equal(summary.patientVisible, false);
    assert.equal(summary.clinicianReviewRequired, true);
    assert.deepEqual(summary.repDurationSummary, {
      avgDurationS: null,
      fastestDurationS: null,
      slowestDurationS: null,
      completedRepCount: 0,
    });
    assert.equal(summary.capturedAt, CAPTURED_AT);
    for (const obs of summary.observations) {
      assertObservationShape(obs);
    }
  });

  it("summarizes STS rep duration from completed rep records", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [snap(0), snap(3), snap(6)],
      legacyRepCount: 2,
      repRecords: [
        { repIndex: 1, completed: true, durationMs: 2000, captureFlags: ["complete_rep"] },
        { repIndex: 2, completed: true, durationMs: 3000, captureFlags: ["complete_rep"] },
      ],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.repDurationSummary.avgDurationS, 2.5);
    assert.equal(summary.repDurationSummary.fastestDurationS, 2);
    assert.equal(summary.repDurationSummary.slowestDurationS, 3);
    assert.equal(summary.repDurationSummary.completedRepCount, 2);
    assert.equal(summary.completeRepCount, 2);
    assert.equal(summary.unclearRepCount, 0);

    const timingObs = summary.observations.find((o) => o.id === "avg_rep_duration");
    assert.ok(timingObs);
    assert.equal(timingObs!.value, 2.5);
    assert.equal(timingObs!.unit, "s");
  });

  it("counts complete reps and unclear reps separately", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [snap(0), snap(2)],
      legacyRepCount: 2,
      repRecords: [
        { repIndex: 1, completed: true, durationMs: 1800, captureFlags: ["complete_rep"] },
        {
          repIndex: 2,
          completed: false,
          durationMs: null,
          captureFlags: ["incomplete_return", "unclear_visibility"],
        },
      ],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.completeRepCount, 1);
    assert.equal(summary.unclearRepCount, 1);
    assert.ok(summary.captureFlags.includes("incomplete_cycle"));
    assert.ok(summary.captureFlags.includes("incomplete_return"));

    const completeObs = summary.observations.find((o) => o.id === "complete_reps");
    const unclearObs = summary.observations.find((o) => o.id === "unclear_reps");
    assert.equal(completeObs!.value, 1);
    assert.equal(unclearObs!.value, 1);
  });

  it("rolls up tracking quality distribution across snapshots", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [
        snap(0, { trackingQuality: "good" }),
        snap(1, { trackingQuality: "fair" }),
        snap(2, { posePresent: false, trackingQuality: "lost" }),
        snap(3, { trackingQuality: "unknown" }),
      ],
      legacyRepCount: 0,
      repRecords: [],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.trackingQualityDistribution.good, 1);
    assert.equal(summary.trackingQualityDistribution.fair, 1);
    assert.equal(summary.trackingQualityDistribution.lost, 1);
    assert.equal(summary.trackingQualityDistribution.unknown, 1);
    assert.equal(summary.sessionDurationS, 3);

    const distObs = summary.observations.find((o) => o.id === "tracking_distribution");
    assert.ok(distObs);
    assert.match(distObs!.value as string, /good:1/);
    assert.match(distObs!.label, /camera visibility/i);
    assert.doesNotMatch(distObs!.label, /movement quality score/i);
  });

  it("produces biomechanical observations with required safety fields", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [snap(0, { events: ["pose_lost"] })],
      legacyRepCount: 1,
      repRecords: [
        { repIndex: 1, completed: true, durationMs: 2200, captureFlags: ["complete_rep"] },
      ],
      capturedAt: CAPTURED_AT,
    });

    assert.ok(summary.observations.length >= 4);
    for (const obs of summary.observations) {
      assertObservationShape(obs);
      assert.doesNotMatch(obs.label, /diagnosis/i);
      assert.doesNotMatch(obs.label, /recommend/i);
      assert.doesNotMatch(obs.label, /clinical score/i);
      assert.doesNotMatch(obs.label, /movement quality score/i);
      assert.doesNotMatch(obs.label, /progression/i);
    }
  });

  it("rejects forbidden keys in serialized summary payload", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [snap(0)],
      legacyRepCount: 1,
      repRecords: [],
      capturedAt: CAPTURED_AT,
    });

    const forbiddenHits = findForbiddenKeysInSummaryPayload(summary);
    assert.deepEqual(forbiddenHits, []);

    const polluted = {
      ...summary,
      diagnosis: "hidden",
      landmarks: [{ x: 1 }],
    };
    const pollutedHits = findForbiddenKeysInSummaryPayload(polluted);
    assert.ok(pollutedHits.includes("diagnosis"));
    assert.ok(pollutedHits.some((h) => h.includes("landmarks")));
  });

  it("uses only allowed top-level summary keys", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [snap(0), snap(1)],
      legacyRepCount: 0,
      repRecords: [],
      capturedAt: CAPTURED_AT,
    });

    const keys = Object.keys(summary).sort();
    const allowed = [...STS_SUMMARY_ALLOWED_TOP_LEVEL_KEYS].sort();
    assert.deepEqual(keys, allowed);
  });

  it("defaults patientVisible false and clinicianReviewRequired true on summary and observations", () => {
    const summary = buildStsSessionMotionSummary({
      snapshots: [snap(0)],
      legacyRepCount: 0,
      repRecords: [],
      capturedAt: CAPTURED_AT,
    });

    assert.equal(summary.patientVisible, false);
    assert.equal(summary.clinicianReviewRequired, true);
    for (const obs of summary.observations) {
      assert.equal(obs.patientVisible, false);
      assert.equal(obs.clinicianReviewRequired, true);
    }
  });

  it("is deterministic for unsorted snapshot input", () => {
    const input = {
      snapshots: [snap(2), snap(0), snap(1)],
      legacyRepCount: 0,
      repRecords: [] as const,
      capturedAt: CAPTURED_AT,
    };
    assert.deepEqual(
      buildStsSessionMotionSummary(input),
      buildStsSessionMotionSummary(input),
    );
    assert.equal(buildStsSessionMotionSummary(input).sessionDurationS, 2);
  });
});
