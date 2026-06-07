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
import { resolveExerciseKinesiologyContext } from "@/app/lib/cv/exercise-kinesiology-context";
import { MotionTimelineAccumulator } from "@/app/lib/cv/motion-timeline-accumulator";
import {
  buildMotionQualityWithStsPilot,
  buildStsMotionPilotRecord,
} from "@/app/lib/cv/sts-motion-pilot-record";
import type { SessionMotionSummary } from "@/app/lib/cv/motion-summary-types";
import { createStsPhaseClassifierState } from "@/app/lib/cv/sts-phase-classifier";
import { finalizeStsMotionTimelineSummary } from "@/app/lib/cv/sts-motion-summary-finalize";
import { buildStsTimelineTickFromCaptureState } from "@/app/lib/cv/sts-timeline-tick-builder";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
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
    assert.equal(report.kinesiologyContext?.exerciseId, "sit-to-stand");
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
    assert.equal(report.kinesiologyContext?.exerciseId, "single-leg-stance");
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
    assert.equal(report.kinesiologyContext, null);
    assert.equal(report.reportMode, "minimal");
    assert.equal(report.reportHeader, null);
    assert.ok(report.confidenceLimitations.bullets.length > 0);
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

describe("resolveExerciseKinesiologyContext", () => {
  it("returns context for supported exercises only", () => {
    assert.equal(resolveExerciseKinesiologyContext("mini-squat")?.exerciseId, "mini-squat");
    assert.equal(resolveExerciseKinesiologyContext("heel-raise"), null);
    assert.equal(resolveExerciseKinesiologyContext(null), null);
  });
});

describe("parseSmtPilotSummary", () => {
  it("parses smtPilot fields from motion_quality", () => {
    const summary: SessionMotionSummary = {
      schemaVersion: "smt-1",
      exerciseId: "sit-to-stand",
      sessionDurationS: 12,
      legacyRepCount: 4,
      completeRepCount: 3,
      unclearRepCount: 1,
      trackingQualityDistribution: { good: 8, fair: 1, poor: 0, unknown: 0, lost: 0 },
      visibilityAssist: { hipVisiblePct: 90, kneeVisiblePct: 85, ankleVisiblePct: 80 },
      interruptions: { poseLossEventCount: 0, longestPoseLossGapMs: 0 },
      repDurationSummary: {
        avgDurationS: 2.2,
        fastestDurationS: 1.8,
        slowestDurationS: 2.6,
        completedRepCount: 3,
      },
      phaseRatios: { rising: 30, standing: 70 },
      captureFlags: [],
      observations: [],
      capturedAt: "2026-06-02T12:00:00.000Z",
      patientVisible: false,
      clinicianReviewRequired: true,
      therapistReviewHint: "derived_motion_summary_only",
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
    assert.deepEqual(parsed.phaseRatios, { rising: 30, standing: 70 });
    assert.deepEqual(parsed.repTimings, {
      avgS: 2.2,
      fastestS: 1.8,
      slowestS: 2.6,
    });
    assert.deepEqual(parsed.visibilityRatios, { hip: 90, knee: 85, ankle: 80 });
    assert.deepEqual(parsed.clinicianFlags, ["unclear_reps_recorded"]);
  });

  it("parses legacy smtPilot without enrichment fields", () => {
    const parsed = parseSmtPilotSummary({
      smtPilot: {
        pilotVersion: "smt-1",
        isPilot: true,
        exerciseId: "sit-to-stand",
        snapshotCount: 3,
        durationS: 8,
        repCount: 2,
        completeReps: 2,
        unclearReps: 0,
        trackingSignal: "good",
        movementDetected: true,
        reviewRequired: true,
        reviewReason: "derived_motion_timeline_pilot",
        disclaimer: "Assistive motion capture for clinician review only.",
      },
    });

    assert.ok(parsed);
    assert.equal(parsed.phaseRatios, null);
    assert.equal(parsed.repTimings, null);
    assert.equal(parsed.visibilityRatios, null);
    assert.equal(parsed.clinicianFlags, null);
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
          phaseRatios: { seated: 20, rising: 30, standing: 50 },
          repTimings: { avgS: 2.5, fastestS: 2, slowestS: 3 },
          visibilityRatios: { hip: 88, knee: 82, ankle: 76 },
          clinicianFlags: ["pose_tracking_interrupted"],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });

    assert.ok(report.smtPilot);
    assert.equal(report.smtPilot.completeReps, 2);
    assert.equal(report.smtPilot.trackingSignal, "fair");
    assert.deepEqual(report.smtPilot.repTimings?.avgS, 2.5);
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

describe("clinical interpretation layer", () => {
  function enrichedStsReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      visibilityRatios?: { hip: number; knee: number; ankle: number };
      clinicianFlags?: string[];
      unclearReps?: number;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        smtPilot: {
          pilotVersion: "smt-1",
          isPilot: true,
          exerciseId: "sit-to-stand",
          snapshotCount: 8,
          durationS: 12,
          repCount: 3,
          completeReps: 3,
          unclearReps: overrides.unclearReps ?? 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            seated: 15,
            rising: 25,
            standing: 45,
            returning: 10,
            rest: 5,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 2.5,
            fastestS: 1.5,
            slowestS: 3.5,
          },
          visibilityRatios: overrides.visibilityRatios ?? {
            hip: 88,
            knee: 85,
            ankle: 82,
          },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });
  }

  it("builds enriched STS session interpretation", () => {
    const report = enrichedStsReport();

    assert.equal(report.sessionSummary?.exerciseLabel, "Sit-to-Stand");
    assert.ok(report.sessionSummary?.metricSummary?.includes("3 complete cycle"));
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length >= 4);
    assert.ok(report.phaseInterpretation?.some((phase) => phase.phaseId === "standing"));
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "sts_low_returning"));
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "wide_rep_timing_spread"));
    assert.ok(report.reviewNext && report.reviewNext.length > 0);
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("flags partial visibility in clinical observations", () => {
    const report = enrichedStsReport({
      visibilityRatios: { hip: 40, knee: 35, ankle: 30 },
      phaseRatios: { standing: 70, rising: 30 },
      repTimings: { avgS: 2, fastestS: 2, slowestS: 2.2 },
    });

    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "visibility_all_low"));
    assert.ok(
      report.reviewNext?.some((item) =>
        item.text.toLowerCase().includes("re-capturing") ||
        item.text.toLowerCase().includes("framing"),
      ),
    );
  });

  it("flags high unknown phase ratio", () => {
    const report = enrichedStsReport({
      phaseRatios: { unknown: 40, standing: 35, rising: 25 },
      repTimings: { avgS: 2, fastestS: 2, slowestS: 2.1 },
    });

    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "high_unknown_phase"));
    assert.ok(
      report.reviewNext?.some((item) => item.text.toLowerCase().includes("framing")),
    );
  });

  it("falls back safely for legacy sessions without PR58 enrichment", () => {
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
          trackingSignal: "good",
          movementDetected: true,
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });

    assert.equal(report.sessionSummary?.exerciseLabel, "Sit-to-Stand");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.clinicalObservations, null);
    assert.ok(report.reviewNext && report.reviewNext.length > 0);
    assert.ok(report.kinesiologyContext);
    assert.ok(report.smtPilot);
  });

  it("provides session summary without smtPilot for kinesiology exercises", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "mini-squat",
      sessionDurationS: 8,
      repCount: 2,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.sessionSummary?.exerciseLabel, "Mini Squat");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.clinicalObservations, null);
    assert.ok(report.kinesiologyContext);
    assert.ok(report.reviewNext && report.reviewNext.length > 0);
  });
});

describe("movement intelligence report v3", () => {
  function enrichedStsReport(
    overrides: {
      recordedAt?: string;
      phaseRatios?: Record<string, number>;
      visibilityRatios?: { hip: number; knee: number; ankle: number };
      trackingQuality?: string;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      recordedAt: overrides.recordedAt ?? "2026-06-05T14:30:00.000Z",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: overrides.trackingQuality ?? "good",
      movementDetected: true,
      motionQuality: {
        smtPilot: {
          pilotVersion: "smt-1",
          isPilot: true,
          exerciseId: "sit-to-stand",
          snapshotCount: 8,
          durationS: 12,
          repCount: 3,
          completeReps: 3,
          unclearReps: 0,
          trackingSignal: overrides.trackingQuality ?? "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            seated: 15,
            rising: 25,
            standing: 45,
            returning: 10,
            rest: 5,
          },
          repTimings: { avgS: 2.5, fastestS: 1.5, slowestS: 3.5 },
          visibilityRatios: overrides.visibilityRatios ?? {
            hip: 88,
            knee: 85,
            ankle: 82,
          },
          clinicianFlags: [],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });
  }

  it("builds report header with confidence and review badge", () => {
    const report = enrichedStsReport();
    assert.equal(report.reportMode, "full");
    assert.equal(report.reportHeader?.exerciseLabel, "Sit-to-Stand");
    assert.ok(report.reportHeader?.recordedAtLabel);
    assert.equal(report.reportHeader?.confidenceLevel, "high");
    assert.equal(report.reportHeader?.reviewRequired, true);
    assert.ok(report.clinicalSnapshot?.movementCaptured.includes("Sit-to-Stand"));
    assert.ok(report.kinesiologyInsight?.primaryMuscles.length);
  });

  it("limits review next to grouped checklist", () => {
    const report = enrichedStsReport();
    assert.ok(report.reviewNextGrouped);
    assert.ok(report.reviewNextGrouped!.length <= 3);
    const totalItems = report.reviewNextGrouped!.reduce((sum, g) => sum + g.items.length, 0);
    assert.ok(totalItems <= 5);
    assert.ok(report.reviewNextGrouped!.some((g) => g.categoryLabel === "Functional relevance"));
  });

  it("flags partial visibility with limited confidence", () => {
    const report = enrichedStsReport({
      visibilityRatios: { hip: 35, knee: 30, ankle: 25 },
      trackingQuality: "fair",
    });
    assert.equal(report.reportHeader?.confidenceLevel, "low");
    assert.ok(report.clinicalSnapshot?.keyObservations.length);
    assert.ok(
      report.clinicalObservations?.some((obs) => obs.id === "visibility_all_low"),
    );
  });

  it("flags high unknown phase in clinical snapshot", () => {
    const report = enrichedStsReport({
      phaseRatios: { unknown: 40, standing: 35, rising: 25 },
    });
    assert.equal(report.reportHeader?.confidenceLevel, "limited");
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "high_unknown_phase"));
    assert.ok(report.clinicalSnapshot?.phasesDetected?.includes("Unknown"));
  });

  it("uses legacy mode for old smtPilot without enrichment", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      recordedAt: "2026-05-01T10:00:00.000Z",
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
          trackingSignal: "good",
          movementDetected: true,
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });

    assert.equal(report.reportMode, "legacy");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.clinicalObservations, null);
    assert.ok(report.reportHeader);
    assert.ok(report.clinicalSnapshot);
    assert.ok(report.kinesiologyInsight);
    assert.ok(report.confidenceLimitations.bullets.length >= 5);
  });
});

describe("STS phase detection pipeline", () => {
  const STS_BASE: SitToStandDetectorSnapshot = {
    trackingStatus: "pose-found",
    trackingQuality: "good",
    poseReadiness: "ready",
    bodyFramingState: "good_distance",
    repCount: 0,
    sessionSeconds: 0,
    movementDetected: true,
    framesWithPose: 10,
    framesTotal: 10,
    initPhase: null,
    previewActive: true,
    trackingError: null,
    isBaselineCalibrating: false,
    standPhase: "down",
  };

  it("derives multi-phase evidence and report interpretation from timeline snapshots", () => {
    const classifier = createStsPhaseClassifierState();
    const acc = new MotionTimelineAccumulator();
    acc.start();

    const sequence: Array<Partial<SitToStandDetectorSnapshot> & { sessionSeconds: number }> = [
      { sessionSeconds: 0, standPhase: "down" },
      { sessionSeconds: 1, standPhase: "up" },
      { sessionSeconds: 2, standPhase: "up", repCount: 1 },
      { sessionSeconds: 3, standPhase: "down", repCount: 1 },
      { sessionSeconds: 4, standPhase: "down", repCount: 1 },
      { sessionSeconds: 5, standPhase: "up", repCount: 1 },
      { sessionSeconds: 6, standPhase: "up", repCount: 2 },
      { sessionSeconds: 7, standPhase: "down", repCount: 2 },
    ];

    for (const partial of sequence) {
      acc.recordTick(
        buildStsTimelineTickFromCaptureState(
          { ...STS_BASE, ...partial },
          { phaseClassifier: classifier },
        ),
      );
    }

    const { summary } = finalizeStsMotionTimelineSummary({
      accumulator: acc,
      legacyRepCount: 2,
      capturedAt: "2026-06-05T12:00:00.000Z",
    });

    assert.ok((summary.phaseRatios.rising ?? 0) > 0);
    assert.ok((summary.phaseRatios.standing ?? 0) > 0);
    assert.ok((summary.phaseRatios.returning ?? 0) > 0);
    assert.ok((summary.phaseRatios.seated ?? 0) > 0);
    assert.equal(summary.completeRepCount, 2);
    assert.ok(summary.repDurationSummary.avgDurationS !== null);

    const pilot = buildStsMotionPilotRecord({
      summary,
      metrics: {
        exerciseId: "sit-to-stand",
        repCount: 2,
        sessionDurationS: 7,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 70,
        framesTotal: 70,
      },
      snapshotCount: acc.getSnapshotCount(),
    });

    const report = buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      sessionDurationS: 7,
      repCount: 2,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: buildMotionQualityWithStsPilot(pilot),
    });

    assert.ok(report.phaseInterpretation?.some((p) => p.phaseId === "rising"));
    assert.ok(report.phaseInterpretation?.some((p) => p.phaseId === "standing"));
    assert.ok(report.phaseInterpretation?.some((p) => p.phaseId === "returning"));
    assert.ok(report.smtPilot?.repTimings?.avgS);
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("falls back safely when phase ratios are missing", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      sessionDurationS: 5,
      repCount: 1,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        smtPilot: {
          pilotVersion: "smt-1",
          isPilot: true,
          exerciseId: "sit-to-stand",
          snapshotCount: 2,
          durationS: 5,
          repCount: 1,
          completeReps: 1,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: { seated: 80, rest: 20 },
          repTimings: { avgS: null, fastestS: null, slowestS: null },
          visibilityRatios: { hip: 80, knee: 75, ankle: 70 },
          clinicianFlags: [],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive only.",
        },
      },
    });

    assert.ok(hasDisplayableMotionAnalysisReport(report));
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length > 0);
    assert.equal(report.phaseInterpretation?.some((p) => p.phaseId === "rising"), false);
  });
});
