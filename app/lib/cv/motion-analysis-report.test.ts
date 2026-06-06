/**
 * Run: npx tsx --test app/lib/cv/motion-analysis-report.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMotionAnalysisReport,
  hasDisplayableMotionAnalysisReport,
  motionAnalysisInputFromCvMetric,
  parseSmtPilotSummary,
  resolveMotionAnalysisSummaryLabel,
  trackingSignalDotTone,
} from "@/app/lib/cv/motion-analysis-report";
import { buildStsMotionPilotRecord } from "@/app/lib/cv/sts-motion-pilot-record";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";

function metricRow(
  partial: Partial<CvSessionMetricPublic> & Pick<CvSessionMetricPublic, "exerciseId">,
): CvSessionMetricPublic {
  return {
    id: "test-id",
    exerciseId: partial.exerciseId,
    repCount: partial.repCount ?? null,
    sessionDurationS: partial.sessionDurationS ?? null,
    trackingQuality: partial.trackingQuality ?? null,
    movementDetected: partial.movementDetected ?? false,
    source: partial.source ?? "patient_session",
    prototypeVersion: partial.prototypeVersion ?? "0.1",
    recordedAt: partial.recordedAt ?? "2026-05-30T12:00:00.000Z",
    ...partial,
  };
}

describe("buildMotionAnalysisReport", () => {
  it("builds report for sit-to-stand metrics", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      sessionDurationS: 14,
      repCount: 4,
      trackingQuality: "good",
      movementDetected: true,
    });

    assert.equal(report.sessionDurationSeconds, 14);
    assert.equal(report.completedReps, 4);
    assert.equal(report.summaryLabel, "Movement data available");
    assert.ok(report.movementTimeline.some((item) => item.label === "Repetitions recorded"));
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("builds report for mini-squat and heel-raise", () => {
    for (const exerciseId of ["mini-squat", "heel-raise"] as const) {
      const report = buildMotionAnalysisReport({
        exerciseId,
        sessionDurationS: 10,
        repCount: 2,
        trackingQuality: "fair",
        movementDetected: true,
      });
      assert.equal(report.completedReps, 2);
      assert.equal(report.summaryLabel, "Movement data available");
    }
  });

  it("uses hold timeline for single-leg-stance", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "single-leg-stance",
      sessionDurationS: 12,
      repCount: 0,
      trackingQuality: "good",
      movementDetected: true,
    });

    assert.equal(report.completedReps, 0);
    assert.ok(report.movementTimeline.some((item) => item.label === "Assistive hold tracked"));
    assert.ok(!report.movementTimeline.some((item) => item.label === "Repetitions recorded"));
  });

  it("uses limited visibility for poor tracking", () => {
    const report = buildMotionAnalysisReport({
      sessionDurationS: 8,
      repCount: 1,
      trackingQuality: "poor",
      movementDetected: true,
    });

    assert.equal(report.summaryLabel, "Limited visibility");
    assert.ok(report.movementTimeline.some((item) => item.label === "Camera visibility note"));
  });

  it("suggests review when duration recorded without movement", () => {
    const report = buildMotionAnalysisReport({
      sessionDurationS: 6,
      trackingQuality: "good",
      movementDetected: false,
    });

    assert.equal(report.summaryLabel, "Review suggested");
  });

  it("handles empty input safely", () => {
    const report = buildMotionAnalysisReport({});

    assert.equal(report.sessionDurationSeconds, 0);
    assert.equal(report.completedReps, 0);
    assert.deepEqual(report.movementTimeline, []);
    assert.equal(report.summaryLabel, "Session completed");
    assert.equal(hasDisplayableMotionAnalysisReport(report), false);
  });

  it("does not throw on partial metrics", () => {
    assert.doesNotThrow(() =>
      buildMotionAnalysisReport({
        sessionDurationS: Number.NaN,
        repCount: undefined,
        trackingQuality: "  ",
        movementDetected: undefined,
      }),
    );

    const report = buildMotionAnalysisReport({
      sessionDurationS: Number.NaN,
      repCount: undefined,
    });

    assert.equal(report.sessionDurationSeconds, 0);
    assert.equal(report.completedReps, 0);
  });
});

describe("motionAnalysisInputFromCvMetric", () => {
  it("maps public metric row without motion_quality", () => {
    const input = motionAnalysisInputFromCvMetric(
      metricRow({
        exerciseId: "heel-raise",
        repCount: 3,
        sessionDurationS: 9,
        trackingQuality: "fair",
        movementDetected: true,
      }),
    );

    const report = buildMotionAnalysisReport(input);
    assert.equal(report.completedReps, 3);
    assert.equal(report.sessionDurationSeconds, 9);
  });
});

describe("resolveMotionAnalysisSummaryLabel", () => {
  it("uses limited visibility wording for poor signal", () => {
    assert.equal(
      resolveMotionAnalysisSummaryLabel({
        trackingSignal: "poor",
        movementDetected: true,
        sessionDurationSeconds: 10,
      }),
      "Limited visibility",
    );
  });
});

describe("parseSmtPilotSummary", () => {
  it("parses smtPilot fields from motion_quality", () => {
    const summary: SessionMotionSummary = {
      sessionDurationS: 12,
      legacyRepCount: 4,
      completeRepCount: 3,
      unclearRepCount: 1,
      trackingQualityDistribution: { good: 8, fair: 1, poor: 0, unknown: 0, lost: 0 },
    };
    const record = buildStsMotionPilotRecord({
      summary,
      metrics: {
        exerciseId: "sit-to-stand",
        movementDetected: true,
        repCount: 4,
        sessionDurationS: 12,
        trackingQuality: "good",
        framesWithPose: 10,
        framesTotal: 12,
      },
      snapshotCount: 5,
    });

    const parsed = parseSmtPilotSummary({ smtPilot: record });
    assert.ok(parsed);
    assert.equal(parsed.snapshotCount, 5);
    assert.equal(parsed.completeReps, 3);
    assert.equal(parsed.unclearReps, 1);
    assert.equal(parsed.trackingSignal, "good");
    assert.equal(parsed.showReviewBanner, true);
  });

  it("returns null when smtPilot is missing", () => {
    assert.equal(parseSmtPilotSummary(null), null);
    assert.equal(parseSmtPilotSummary({}), null);
  });
});

describe("buildMotionAnalysisReport smtPilot", () => {
  it("includes smtPilot summary and remains displayable", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      sessionDurationS: 10,
      repCount: 2,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        smtPilot: {
          pilotVersion: "smt-1",
          isPilot: true,
          exerciseId: "sit-to-stand",
          snapshotCount: 4,
          durationS: 10,
          repCount: 2,
          completeReps: 2,
          unclearReps: 0,
          trackingSignal: "fair",
          movementDetected: true,
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });

    assert.ok(report.smtPilot);
    assert.equal(report.smtPilot.completeReps, 2);
    assert.equal(report.smtPilot.trackingSignal, "fair");
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("falls back when motion_quality has no smtPilot", () => {
    const report = buildMotionAnalysisReport({
      sessionDurationS: 8,
      repCount: 1,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: { otherPhase: "mqe-0" },
    });

    assert.equal(report.smtPilot, null);
    assert.equal(report.completedReps, 1);
  });
});

describe("trackingSignalDotTone", () => {
  it("maps tracking signals to dot tones", () => {
    assert.equal(trackingSignalDotTone("good"), "good");
    assert.equal(trackingSignalDotTone("fair"), "fair");
    assert.equal(trackingSignalDotTone("poor"), "poor");
    assert.equal(trackingSignalDotTone("unknown"), "unknown");
    assert.equal(trackingSignalDotTone("lost"), "poor");
    assert.equal(trackingSignalDotTone("mixed"), "fair");
  });
});
