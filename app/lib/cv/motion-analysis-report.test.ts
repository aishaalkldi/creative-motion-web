/**
 * Run: npx tsx --test app/lib/cv/motion-analysis-report.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMotionAnalysisReport,
  hasDisplayableMotionAnalysisReport,
  motionAnalysisInputFromCvMetric,
  resolveMotionAnalysisSummaryLabel,
} from "@/app/lib/cv/motion-analysis-report";
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
