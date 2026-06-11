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
import {
  buildCaptureFlagsSummary,
  filterSemanticallyDuplicatePrompts,
  resolveCaptureEvidenceCycleMetricLabel,
  resolveCaptureEvidenceTimingLabels,
} from "@/app/lib/cv/motion-analysis-report-present";
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

  it("builds report for mini-squat, heel-raise, step-up, and lateral-step", () => {
    for (const exerciseId of ["mini-squat", "heel-raise", "step-up", "lateral-step"] as const) {
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
    assert.equal(resolveExerciseKinesiologyContext("heel-raise")?.exerciseId, "heel-raise");
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
    assert.ok(report.movementQuality);
    assert.equal(report.movementQuality.pacingConsistency, "Variable");
    assert.equal(report.movementQuality.phaseConsistency, "Moderate");
    assert.equal(report.movementQuality.completionClarity, "Clear");
    assert.equal(report.movementQuality.observedStandingPhaseRatio, 45);
    assert.equal(report.movementQuality.observedReturningPhaseRatio, 10);
  });

  it("flags partial visibility with evidence integrity gate", () => {
    const report = enrichedStsReport({
      visibilityRatios: { hip: 40, knee: 35, ankle: 30 },
      phaseRatios: { standing: 70, rising: 30 },
      repTimings: { avgS: 2, fastestS: 2, slowestS: 2.2 },
    });

    assert.equal(report.evidenceIntegrity?.status, "unable_to_assess");
    assert.equal(report.biomechanicalContributionReview, null);
    assert.equal(report.clinicalSnapshot?.interpretationSupport, "limited");
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
  });

  it("flags high unknown phase ratio", () => {
    const report = enrichedStsReport({
      phaseRatios: { unknown: 40, standing: 35, rising: 25 },
      repTimings: { avgS: 2, fastestS: 2, slowestS: 2.1 },
    });

    assert.equal(report.evidenceIntegrity?.status, "limited");
    assert.equal(report.evidenceIntegrity?.sufficientForBiomechanicalInterpretation, false);
    assert.equal(report.clinicalSnapshot?.interpretationSupport, "limited");
    assert.equal(report.biomechanicalContributionReview, null);
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
  });

  it("gates interpretation when snapshots are zero despite recorded reps", () => {
    const regated = buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
      sessionDurationS: 12,
      repCount: 4,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        smtPilot: {
          pilotVersion: "smt-1",
          isPilot: true,
          exerciseId: "sit-to-stand",
          snapshotCount: 0,
          durationS: 12,
          repCount: 4,
          completeReps: 4,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: { seated: 10, rising: 30, standing: 50, returning: 10 },
          repTimings: { avgS: 2.5, fastestS: 2, slowestS: 3 },
          visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
          clinicianFlags: [],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });

    assert.equal(regated.evidenceIntegrity?.status, "unable_to_assess");
    assert.equal(regated.evidenceIntegrity?.sufficientForBiomechanicalInterpretation, false);
    assert.equal(regated.clinicalSnapshot?.interpretationSupport, "limited");
    assert.notEqual(regated.clinicalSnapshot?.interpretationSupport, "moderate");
    assert.equal(regated.reportHeader?.confidenceLevel, "limited");
    assert.equal(regated.biomechanicalContributionReview, null);
    assert.equal(regated.phaseInterpretation, null);
    assert.ok(
      regated.clinicalSnapshot?.interpretationSupportNote?.includes("Rep count is assistive only"),
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
    assert.equal(report.evidenceIntegrity?.status, "limited");
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
    assert.ok(report.reviewNext && report.reviewNext.length > 0);
    assert.ok(report.kinesiologyContext);
    assert.ok(report.smtPilot);
    assert.ok(report.movementQuality);
    assert.equal(report.movementQuality.pacingConsistency, "Insufficient data");
    assert.equal(report.movementQuality.phaseConsistency, "Insufficient data");
    assert.equal(report.movementQuality.completionClarity, "Clear");
  });

  it("provides mini squat intelligence from synthesized motion evidence", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "mini-squat",
      sessionDurationS: 8,
      repCount: 2,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.sessionSummary?.exerciseLabel, "Mini Squat");
    assert.equal(report.phaseInterpretation, null);
    assert.ok(report.msPilot);
    assert.ok(report.kinesiologyContext);
    assert.ok(report.reviewNext && report.reviewNext.length > 0);
    assert.ok(report.movementQuality);
    assert.ok(report.executiveSummary);
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
    assert.equal(report.reportHeader?.confidenceLevel, "limited");
    assert.equal(report.evidenceIntegrity?.sufficientForBiomechanicalInterpretation, false);
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
  });

  it("flags high unknown phase in clinical snapshot", () => {
    const report = enrichedStsReport({
      phaseRatios: { unknown: 40, standing: 35, rising: 25 },
    });
    assert.equal(report.reportHeader?.confidenceLevel, "limited");
    assert.equal(report.clinicalSnapshot?.interpretationSupport, "limited");
    assert.equal(report.phaseInterpretation, null);
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
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
    assert.equal(report.evidenceIntegrity?.status, "limited");
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
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

    if (report.evidenceIntegrity?.sufficientForBiomechanicalInterpretation) {
      assert.ok(report.phaseInterpretation?.some((p) => p.phaseId === "rising"));
      assert.ok(report.phaseInterpretation?.some((p) => p.phaseId === "standing"));
      assert.ok(report.phaseInterpretation?.some((p) => p.phaseId === "returning"));
    } else {
      assert.equal(report.phaseInterpretation, null);
      assert.equal(report.biomechanicalContributionReview, null);
      assert.ok(report.evidenceIntegrity?.reasons.length);
    }
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

describe("biomechanical contribution review", () => {
  function stsReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      visibilityRatios?: { hip: number; knee: number; ankle: number };
      clinicianFlags?: string[];
      unclearReps?: number;
      trackingQuality?: string;
      motionQuality?: Record<string, unknown> | null;
    } = {},
  ) {
    if (overrides.motionQuality === null) {
      return buildMotionAnalysisReport({
        exerciseId: "sit-to-stand",
        sessionDurationS: 10,
        repCount: 2,
        trackingQuality: overrides.trackingQuality ?? "good",
        movementDetected: true,
      });
    }

    return buildMotionAnalysisReport({
      exerciseId: "sit-to-stand",
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
          unclearReps: overrides.unclearReps ?? 0,
          trackingSignal: overrides.trackingQuality ?? "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            seated: 12,
            rising: 25,
            standing: 40,
            returning: 18,
            rest: 5,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 2.1,
            fastestS: 2.0,
            slowestS: 2.2,
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

  const FORBIDDEN_PHRASES = [
    "weak quadriceps",
    "poor glute",
    "abnormal movement",
    "compensation detected",
  ];

  function assertSafeLanguage(review: NonNullable<
    ReturnType<typeof buildMotionAnalysisReport>["biomechanicalContributionReview"]
  >) {
    const allText = [
      ...review.observedMovementPattern,
      ...review.possibleContributors,
      ...review.muscleDemandContext,
      ...review.clinicianReviewPrompts,
    ].join(" ").toLowerCase();

    for (const phrase of FORBIDDEN_PHRASES) {
      assert.equal(allText.includes(phrase), false, `forbidden phrase: ${phrase}`);
    }
  }

  it("builds review for a normal STS session", () => {
    const report = stsReport();

    assert.ok(report.biomechanicalContributionReview);
    assertSafeLanguage(report.biomechanicalContributionReview);
    assert.ok(
      report.biomechanicalContributionReview.observedMovementPattern.some((item) =>
        item.includes("consistent repetition pacing"),
      ),
    );
    assert.ok(
      report.biomechanicalContributionReview.observedMovementPattern.some((item) =>
        item.includes("Rising phase represented 25%"),
      ),
    );
    assert.ok(
      report.biomechanicalContributionReview.possibleContributors.includes(
        "Lower-limb force production strategy",
      ),
    );
    assert.ok(
      report.biomechanicalContributionReview.muscleDemandContext.some((item) =>
        item.includes("Quadriceps demand during rising"),
      ),
    );
  });

  it("highlights variable pacing and limited returning phase", () => {
    const report = stsReport({
      repTimings: { avgS: 2.8, fastestS: 1.5, slowestS: 4.0 },
      phaseRatios: {
        seated: 10,
        rising: 30,
        standing: 52,
        returning: 8,
        rest: 0,
      },
    });

    assert.ok(report.biomechanicalContributionReview);
    assertSafeLanguage(report.biomechanicalContributionReview);
    assert.ok(
      report.biomechanicalContributionReview.observedMovementPattern.some((item) =>
        item.includes("Variable pacing observed"),
      ),
    );
    assert.ok(
      report.biomechanicalContributionReview.reviewFlags.includes("variable_pacing"),
    );
    assert.ok(
      report.biomechanicalContributionReview.reviewFlags.includes("low_returning_phase"),
    );
    assert.ok(
      report.biomechanicalContributionReview.possibleContributors.includes(
        "Eccentric lowering control",
      ),
    );
  });

  it("suppresses biomechanical review when incomplete-cycle evidence is flagged", () => {
    const report = stsReport({
      clinicianFlags: ["incomplete_cycle"],
      phaseRatios: { seated: 30, rising: 20, standing: 35, returning: 0, rest: 15 },
    });

    assert.equal(report.biomechanicalContributionReview, null);
    assert.equal(report.evidenceIntegrity?.sufficientForBiomechanicalInterpretation, false);
    assert.ok(report.evidenceIntegrity?.reasons.includes("phase_evidence_incomplete_or_unclear"));
  });

  it("suppresses biomechanical review for limited visibility sessions", () => {
    const report = stsReport({
      trackingQuality: "poor",
      visibilityRatios: { hip: 40, knee: 35, ankle: 30 },
      phaseRatios: { standing: 70, rising: 30 },
      repTimings: { avgS: 2, fastestS: 2, slowestS: 2.2 },
    });

    assert.equal(report.biomechanicalContributionReview, null);
    assert.equal(report.evidenceIntegrity?.status, "unable_to_assess");
    assert.equal(report.clinicalSnapshot?.interpretationSupport, "limited");
  });

  it("gates legacy STS sessions without phase enrichment", () => {
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

    assert.equal(report.biomechanicalContributionReview, null);
    assert.equal(report.evidenceIntegrity?.status, "limited");
    assert.ok(report.clinicalObservations?.some((obs) => obs.id === "evidence_integrity_limited"));
  });

  it("suppresses biomechanical review for synthesized mini squat evidence", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "mini-squat",
      sessionDurationS: 8,
      repCount: 2,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.biomechanicalContributionReview, null);
    assert.equal(report.evidenceIntegrity?.status, "unable_to_assess");
    assert.equal(report.msPilotEvidenceMode, "synthesized");
  });

  it("suppresses biomechanical review for synthesized heel raise evidence", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "heel-raise",
      sessionDurationS: 8,
      repCount: 2,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.biomechanicalContributionReview, null);
    assert.equal(report.evidenceIntegrity?.status, "unable_to_assess");
    assert.equal(report.hrPilotEvidenceMode, "synthesized");
  });

  it("returns null for exercises without intelligence support", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "single-leg-stance",
      sessionDurationS: 8,
      repCount: 0,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.biomechanicalContributionReview, null);
  });
});

describe("report readability polish", () => {
  function enrichedStsReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
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
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            seated: 12,
            rising: 25,
            standing: 40,
            returning: 18,
            rest: 5,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 2.1,
            fastestS: 2.0,
            slowestS: 2.2,
          },
          visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive motion capture for clinician review only.",
        },
      },
    });
  }

  it("builds executive summary with 3–5 key lines", () => {
    const report = enrichedStsReport();
    assert.ok(report.executiveSummary);
    assert.ok(report.executiveSummary!.lines.length >= 3);
    assert.ok(report.executiveSummary!.lines.length <= 5);
    assert.ok(
      report.executiveSummary!.lines.some((line) =>
        line.toLowerCase().includes("complete cycle") ||
        line.toLowerCase().includes("camera-detected movement cycle"),
      ),
    );
    assert.ok(
      report.executiveSummary!.lines.some((line) =>
        line.toLowerCase().includes("tracking confidence"),
      ),
    );
  });

  it("uses complete cycles only when strict phase completeness is met", () => {
    const strict = enrichedStsReport();
    assert.ok(strict.sessionSummary?.metricSummary?.includes("3 complete cycles"));

    const incomplete = enrichedStsReport({
      phaseRatios: { seated: 30, rising: 20, standing: 35, returning: 0, rest: 15 },
      clinicianFlags: ["incomplete_cycle"],
    });
    assert.ok(
      incomplete.sessionSummary?.metricSummary?.includes(
        "camera-detected movement cycle",
      ),
    );
    assert.equal(
      incomplete.sessionSummary?.metricSummary?.includes("complete cycle"),
      false,
    );
  });

  it("uses cycle interval timing labels when rest is present", () => {
    const report = enrichedStsReport();
    assert.equal(report.timingMetricLabels?.average, "Average cycle interval");
    assert.equal(report.timingMetricLabels?.fastest, "Fastest cycle interval");
    assert.equal(report.timingMetricLabels?.slowest, "Slowest cycle interval");
  });

  it("shortens biomechanical contribution review for display", () => {
    const report = enrichedStsReport({
      repTimings: { avgS: 2.8, fastestS: 1.5, slowestS: 4.0 },
      phaseRatios: {
        seated: 10,
        rising: 30,
        standing: 52,
        returning: 8,
        rest: 0,
      },
    });
    assert.ok(report.biomechanicalContributionReviewCompact);
    assert.ok(report.biomechanicalContributionReviewCompact!.possibleContributors.length <= 3);
    assert.ok(report.biomechanicalContributionReviewCompact!.muscleDemandContext.length <= 2);
    assert.ok(report.biomechanicalContributionReviewCompact!.clinicianReview.length <= 3);
  });

  it("limits review next to prioritized items", () => {
    const report = enrichedStsReport({
      repTimings: { avgS: 2.5, fastestS: 1.5, slowestS: 3.5 },
      phaseRatios: {
        seated: 15,
        rising: 25,
        standing: 45,
        returning: 10,
        rest: 5,
      },
    });
    assert.ok(report.reviewNext);
    assert.ok(report.reviewNext!.length <= 5);
  });
});

describe("report evidence label alignment", () => {
  function enrichedStsReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
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
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            seated: 12,
            rising: 25,
            standing: 40,
            returning: 18,
            rest: 5,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 2.1,
            fastestS: 2.0,
            slowestS: 2.2,
          },
          visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
          clinicianFlags: overrides.clinicianFlags ?? ["pose_tracking_interrupted"],
          reviewRequired: true,
          reviewReason: "derived_motion_timeline_pilot",
          disclaimer: "Assistive only.",
        },
      },
    });
  }

  it("aligns capture evidence timing labels with main timing section", () => {
    const report = enrichedStsReport();
    const captureLabels = resolveCaptureEvidenceTimingLabels(
      report.timingMetricLabels,
      report.smtPilot?.phaseRatios ?? null,
    );
    assert.equal(captureLabels.average, "Avg cycle interval");
    assert.equal(captureLabels.fastest, "Fastest cycle interval");
    assert.equal(captureLabels.slowest, "Slowest cycle interval");
  });

  it("uses camera-detected cycle wording when strict completeness is not met", () => {
    const incomplete = enrichedStsReport({
      phaseRatios: { seated: 30, rising: 20, standing: 35, returning: 0, rest: 15 },
      clinicianFlags: ["incomplete_cycle"],
    });
    assert.equal(
      resolveCaptureEvidenceCycleMetricLabel(incomplete),
      "Camera-detected cycles",
    );
  });

  it("uses complete cycles label when strict completeness is met", () => {
    const report = enrichedStsReport({ clinicianFlags: [] });
    assert.equal(resolveCaptureEvidenceCycleMetricLabel(report), "Complete cycles");
  });

  it("builds short capture flags summary for show details", () => {
    const summary = buildCaptureFlagsSummary([
      "pose_tracking_interrupted",
      "incomplete_cycle",
      "unclear_reps_recorded",
      "high_unknown_phase",
    ]);
    assert.ok(summary?.includes("pose tracking interrupted"));
    assert.ok(summary?.includes("(+1 more"));
  });

  it("dedupes pacing prompts across biomechanical review and review next", () => {
    const report = enrichedStsReport({
      repTimings: { avgS: 2.8, fastestS: 1.5, slowestS: 4.0 },
      phaseRatios: {
        seated: 10,
        rising: 30,
        standing: 52,
        returning: 8,
        rest: 0,
      },
      clinicianFlags: [],
    });

    const reviewNextTexts = (report.reviewNext ?? []).map((item) => item.text);
    const bioReview = report.biomechanicalContributionReviewCompact?.clinicianReview ?? [];
    const hasPacingDup = bioReview.some((prompt) =>
      reviewNextTexts.some(
        (item) =>
          /pacing/i.test(prompt) &&
          /pacing/i.test(item),
      ),
    );
    assert.equal(hasPacingDup, false);

    const filteredFocus = report.movementQualityReviewFocusDisplay ?? [];
    const focusPacingDup = filteredFocus.some((prompt) =>
      reviewNextTexts.some(
        (item) => /pacing/i.test(prompt) && /pacing/i.test(item),
      ),
    );
    assert.equal(focusPacingDup, false);
  });

  it("filters semantically similar prompts by topic", () => {
    const filtered = filterSemanticallyDuplicatePrompts(
      [
        "Review repetition-to-repetition pacing consistency.",
        "Confirm terminal standing posture visually.",
      ],
      ["Clinician may review pacing consistency across reps during the clinical encounter."],
    );
    assert.deepEqual(filtered, ["Confirm terminal standing posture visually."]);
  });
});

describe("mini squat intelligence v1", () => {
  function enrichedMiniSquatReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
      repCount?: number;
      sessionDurationS?: number;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "mini-squat",
      sessionDurationS: overrides.sessionDurationS ?? 15,
      repCount: overrides.repCount ?? 4,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        msPilot: {
          pilotVersion: "msm-1",
          isPilot: true,
          exerciseId: "mini-squat",
          snapshotCount: 12,
          durationS: overrides.sessionDurationS ?? 15,
          repCount: overrides.repCount ?? 4,
          completeReps: overrides.repCount ?? 4,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            standing: 18,
            lowering: 22,
            bottom: 16,
            rising: 24,
            rest: 12,
            unknown: 8,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 3.2,
            fastestS: 2.8,
            slowestS: 3.8,
          },
          visibilityRatios: { hip: 90, knee: 88, ankle: 84 },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_mini_squat_motion_evidence",
          disclaimer: "Assistive only.",
        },
      },
    });
  }

  it("builds polished mini squat intelligence report", () => {
    const report = enrichedMiniSquatReport();
    assert.equal(report.kinesiologyContext?.exerciseId, "mini-squat");
    assert.ok(report.msPilot);
    assert.ok(report.executiveSummary);
    assert.ok(report.movementQuality);
    assert.ok(report.biomechanicalContributionReview);
    assert.ok(report.biomechanicalContributionReviewCompact);
    assert.equal(report.timingMetricLabels?.average, "Average cycle interval");
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("includes mini squat phase model in phase interpretation", () => {
    const report = enrichedMiniSquatReport();
    const phaseIds = (report.phaseInterpretation ?? []).map((phase) => phase.phaseId);
    assert.ok(phaseIds.includes("lowering"));
    assert.ok(phaseIds.includes("bottom"));
    assert.ok(phaseIds.includes("rising"));
  });

  it("synthesizes msPilot from session metrics when motion_quality is absent", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "mini-squat",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });
    assert.ok(report.msPilot);
    assert.equal(report.msPilot!.completeReps, 3);
    assert.equal(report.msPilot!.repTimings?.avgS, 4);
    assert.ok(report.movementQuality);
  });

  it("uses safe biomechanical review prompts without pathology labels", () => {
    const report = enrichedMiniSquatReport({
      repTimings: { avgS: 3.5, fastestS: 2.0, slowestS: 5.0 },
    });
    const prompts = report.biomechanicalContributionReview?.clinicianReviewPrompts ?? [];
    const joined = prompts.join(" ").toLowerCase();
    assert.ok(joined.includes("squat depth"));
    assert.ok(joined.includes("knee alignment"));
    assert.ok(!joined.includes("weak quadriceps"));
    assert.ok(!joined.includes("valgus detected"));
  });

  it("updates kinesiology context for expected movement strategy", () => {
    const context = resolveExerciseKinesiologyContext("mini-squat");
    assert.ok(context);
    assert.deepEqual(context!.primaryMuscles, [
      "Quadriceps",
      "Gluteus maximus",
      "Gluteus medius",
      "Core stabilizers",
    ]);
    assert.ok(
      context!.expectedPatterns.some((pattern) => /squat depth/i.test(pattern)),
    );
  });

  it("marks synthesized msPilot and avoids implying phase detection", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "mini-squat",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.msPilotEvidenceMode, "synthesized");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.movementQuality?.observedReturningPhaseRatio, null);
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Limited motion evidence"),
      ),
    );
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Cycle timing estimated from session duration and detected reps"),
      ),
    );
    assert.ok(
      !report.executiveSummary?.lines.some((line) => /phase consistency/i.test(line)),
    );
    const bioText = (report.biomechanicalContributionReview?.clinicianReviewPrompts ?? []).join(
      " ",
    ).toLowerCase();
    assert.ok(!bioText.includes("valgus detected"));
    assert.ok(!bioText.includes("weak quadriceps"));
    assert.ok(!bioText.includes("poor knee"));
  });

  it("shows phase percentages only for persisted msPilot phase ratios", () => {
    const report = enrichedMiniSquatReport();
    assert.equal(report.msPilotEvidenceMode, "persisted");
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length > 0);
    assert.ok(report.movementQuality?.observedReturningPhaseRatio !== null);
  });
});

describe("heel raise movement intelligence report (PR67)", () => {
  function enrichedHeelRaiseReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
      repCount?: number;
      sessionDurationS?: number;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "heel-raise",
      sessionDurationS: overrides.sessionDurationS ?? 15,
      repCount: overrides.repCount ?? 4,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        hrPilot: {
          pilotVersion: "hrm-1",
          isPilot: true,
          exerciseId: "heel-raise",
          snapshotCount: 12,
          durationS: overrides.sessionDurationS ?? 15,
          repCount: overrides.repCount ?? 4,
          completeReps: overrides.repCount ?? 4,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            standing: 20,
            rising: 18,
            peak_raise: 14,
            lowering: 22,
            rest: 14,
            unknown: 12,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 3.2,
            fastestS: 2.8,
            slowestS: 3.8,
          },
          visibilityRatios: { hip: 88, knee: 86, ankle: 92 },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_heel_raise_motion_evidence",
          disclaimer: "Assistive only.",
        },
      },
    });
  }

  it("builds polished heel raise intelligence report", () => {
    const report = enrichedHeelRaiseReport();
    assert.equal(report.kinesiologyContext?.exerciseId, "heel-raise");
    assert.ok(report.hrPilot);
    assert.ok(report.executiveSummary);
    assert.ok(report.movementQuality);
    assert.ok(report.biomechanicalContributionReview);
    assert.ok(report.biomechanicalContributionReviewCompact);
    assert.equal(report.timingMetricLabels?.average, "Average cycle interval");
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("includes heel raise phase model in phase interpretation", () => {
    const report = enrichedHeelRaiseReport();
    const phaseIds = (report.phaseInterpretation ?? []).map((phase) => phase.phaseId);
    assert.ok(phaseIds.includes("rising"));
    assert.ok(phaseIds.includes("peak_raise"));
    assert.ok(phaseIds.includes("lowering"));
    const peakLabel = (report.phaseInterpretation ?? []).find(
      (phase) => phase.phaseId === "peak_raise",
    )?.phaseLabel;
    assert.equal(peakLabel, "Peak raise");
  });

  it("synthesizes hrPilot from session metrics when motion_quality is absent", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "heel-raise",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });
    assert.ok(report.hrPilot);
    assert.equal(report.hrPilot!.completeReps, 3);
    assert.equal(report.hrPilot!.repTimings?.avgS, 4);
    assert.ok(report.movementQuality);
  });

  it("uses safe biomechanical review prompts without pathology labels", () => {
    const report = enrichedHeelRaiseReport({
      repTimings: { avgS: 3.5, fastestS: 2.0, slowestS: 5.0 },
    });
    const prompts = report.biomechanicalContributionReview?.clinicianReviewPrompts ?? [];
    const joined = prompts.join(" ").toLowerCase();
    assert.ok(joined.includes("heel raise height"));
    assert.ok(joined.includes("lowering control"));
    assert.ok(!joined.includes("calf weakness"));
    assert.ok(!joined.includes("achilles"));
    assert.ok(!joined.includes("return-to-sport"));
    assert.ok(!joined.includes("treatment recommendation"));
  });

  it("updates kinesiology context for expected movement strategy", () => {
    const context = resolveExerciseKinesiologyContext("heel-raise");
    assert.ok(context);
    assert.deepEqual(context!.primaryMuscles, [
      "Gastrocnemius",
      "Soleus",
      "Tibialis posterior / ankle stabilizers",
      "Intrinsic foot stabilizers",
    ]);
    assert.ok(
      context!.expectedPatterns.some((pattern) => /controlled heel lift/i.test(pattern)),
    );
    assert.ok(/push-off in gait/i.test(context!.functionalTransfer));
  });

  it("marks synthesized hrPilot and avoids implying phase detection", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "heel-raise",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.hrPilotEvidenceMode, "synthesized");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.movementQuality?.observedReturningPhaseRatio, null);
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Limited motion evidence"),
      ),
    );
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Cycle timing estimated from session duration and detected reps"),
      ),
    );
    assert.ok(
      !report.executiveSummary?.lines.some((line) => /phase consistency/i.test(line)),
    );
    const bioText = (report.biomechanicalContributionReview?.clinicianReviewPrompts ?? []).join(
      " ",
    ).toLowerCase();
    assert.ok(!bioText.includes("calf weakness"));
    assert.ok(!bioText.includes("achilles pathology"));
    assert.ok(!bioText.includes("instability diagnosis"));
  });

  it("shows phase percentages only for persisted hrPilot phase ratios", () => {
    const report = enrichedHeelRaiseReport();
    assert.equal(report.hrPilotEvidenceMode, "persisted");
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length > 0);
    assert.ok(report.movementQuality?.observedReturningPhaseRatio !== null);
  });

  it("supports manual fallback for legacy sessions without motion_quality", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "heel-raise",
      sessionDurationS: 8,
      repCount: 2,
      trackingQuality: "good",
      movementDetected: true,
    });
    assert.equal(report.completedReps, 2);
    assert.equal(report.hrPilotEvidenceMode, "synthesized");
    assert.ok(report.movementTimeline.some((item) => item.label === "Repetitions recorded"));
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });
});

describe("step up motion intelligence report (PR68)", () => {
  function enrichedStepUpReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
      repCount?: number;
      sessionDurationS?: number;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "step-up",
      sessionDurationS: overrides.sessionDurationS ?? 15,
      repCount: overrides.repCount ?? 4,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        suPilot: {
          pilotVersion: "sum-1",
          isPilot: true,
          exerciseId: "step-up",
          snapshotCount: 12,
          durationS: overrides.sessionDurationS ?? 15,
          repCount: overrides.repCount ?? 4,
          completeReps: overrides.repCount ?? 4,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            standing: 20,
            step_ascent: 18,
            top_position: 14,
            step_descent: 22,
            rest: 14,
            unknown: 12,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 3.2,
            fastestS: 2.8,
            slowestS: 3.8,
          },
          visibilityRatios: { hip: 88, knee: 86, ankle: 92 },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_step_up_motion_evidence",
          disclaimer: "Assistive only.",
        },
      },
    });
  }

  it("builds polished step up intelligence report", () => {
    const report = enrichedStepUpReport();
    assert.equal(report.kinesiologyContext?.exerciseId, "step-up");
    assert.ok(report.suPilot);
    assert.ok(report.executiveSummary);
    assert.ok(report.movementQuality);
    assert.ok(report.biomechanicalContributionReview);
    assert.equal(report.suPilotEvidenceMode, "persisted");
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("includes step up phase model in phase interpretation", () => {
    const report = enrichedStepUpReport();
    const phaseIds = (report.phaseInterpretation ?? []).map((phase) => phase.phaseId);
    assert.ok(phaseIds.includes("step_ascent"));
    assert.ok(phaseIds.includes("top_position"));
    assert.ok(phaseIds.includes("step_descent"));
  });

  it("synthesizes suPilot from session metrics when motion_quality is absent", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "step-up",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });
    assert.ok(report.suPilot);
    assert.equal(report.suPilot!.completeReps, 3);
    assert.equal(report.suPilot!.repTimings?.avgS, 4);
    assert.equal(report.suPilotEvidenceMode, "synthesized");
    assert.ok(report.movementQuality);
  });

  it("uses safe biomechanical review prompts without pathology labels", () => {
    const report = enrichedStepUpReport();
    const prompts = report.biomechanicalContributionReview?.clinicianReviewPrompts ?? [];
    const joined = prompts.join(" ").toLowerCase();
    assert.ok(joined.includes("ascent") || joined.includes("step height"));
    assert.ok(joined.includes("descent"));
    assert.ok(!joined.includes("weakness"));
    assert.ok(!joined.includes("return-to-sport"));
    assert.ok(!joined.includes("treatment recommendation"));
    assert.ok(!joined.includes("diagnosis"));
  });

  it("marks synthesized suPilot and avoids implying phase detection", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "step-up",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.suPilotEvidenceMode, "synthesized");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.movementQuality?.observedReturningPhaseRatio, null);
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Limited motion evidence"),
      ),
    );
  });

  it("shows phase percentages only for persisted suPilot phase ratios", () => {
    const report = enrichedStepUpReport();
    assert.equal(report.suPilotEvidenceMode, "persisted");
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length > 0);
    assert.ok(report.movementQuality?.observedReturningPhaseRatio !== null);
  });
});

describe("lateral step motion intelligence report (PR69)", () => {
  function enrichedLateralStepReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
      repCount?: number;
      sessionDurationS?: number;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "lateral-step",
      sessionDurationS: overrides.sessionDurationS ?? 15,
      repCount: overrides.repCount ?? 4,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        lsPilot: {
          pilotVersion: "lsm-1",
          isPilot: true,
          exerciseId: "lateral-step",
          snapshotCount: 12,
          durationS: overrides.sessionDurationS ?? 15,
          repCount: overrides.repCount ?? 4,
          completeReps: overrides.repCount ?? 4,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            standing: 20,
            lateral_shift: 18,
            step_out: 14,
            return_to_center: 22,
            rest: 14,
            unknown: 12,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 3.2,
            fastestS: 2.8,
            slowestS: 3.8,
          },
          visibilityRatios: { hip: 88, knee: 86, ankle: 92 },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_lateral_step_motion_evidence",
          disclaimer: "Assistive only.",
        },
      },
    });
  }

  it("builds polished lateral step intelligence report", () => {
    const report = enrichedLateralStepReport();
    assert.equal(report.kinesiologyContext?.exerciseId, "lateral-step");
    assert.ok(report.lsPilot);
    assert.ok(report.executiveSummary);
    assert.ok(report.movementQuality);
    assert.ok(report.biomechanicalContributionReview);
    assert.equal(report.lsPilotEvidenceMode, "persisted");
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("includes lateral step phase model in phase interpretation", () => {
    const report = enrichedLateralStepReport();
    const phaseIds = (report.phaseInterpretation ?? []).map((phase) => phase.phaseId);
    assert.ok(phaseIds.includes("lateral_shift"));
    assert.ok(phaseIds.includes("step_out"));
    assert.ok(phaseIds.includes("return_to_center"));
  });

  it("synthesizes lsPilot from session metrics when motion_quality is absent", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "lateral-step",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });
    assert.ok(report.lsPilot);
    assert.equal(report.lsPilot!.completeReps, 3);
    assert.equal(report.lsPilot!.repTimings?.avgS, 4);
    assert.equal(report.lsPilotEvidenceMode, "synthesized");
    assert.ok(report.movementQuality);
  });

  it("uses safe biomechanical review prompts without pathology labels", () => {
    const report = enrichedLateralStepReport();
    const prompts = report.biomechanicalContributionReview?.clinicianReviewPrompts ?? [];
    const joined = prompts.join(" ").toLowerCase();
    assert.ok(joined.includes("lateral loading") || joined.includes("weight-shift"));
    assert.ok(joined.includes("step width") || joined.includes("return-to-center"));
    assert.ok(!joined.includes("weakness"));
    assert.ok(!joined.includes("return-to-sport"));
    assert.ok(!joined.includes("treatment recommendation"));
    assert.ok(!joined.includes("diagnosis"));
    assert.ok(!joined.includes("instability diagnosis"));
  });

  it("marks synthesized lsPilot and avoids implying phase detection", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "lateral-step",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.lsPilotEvidenceMode, "synthesized");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.movementQuality?.observedReturningPhaseRatio, null);
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Limited motion evidence"),
      ),
    );
  });

  it("shows phase percentages only for persisted lsPilot phase ratios", () => {
    const report = enrichedLateralStepReport();
    assert.equal(report.lsPilotEvidenceMode, "persisted");
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length > 0);
    assert.ok(report.movementQuality?.observedReturningPhaseRatio !== null);
  });
});

describe("functional reach motion intelligence report (PR70)", () => {
  function enrichedFunctionalReachReport(
    overrides: {
      phaseRatios?: Record<string, number>;
      repTimings?: { avgS: number; fastestS: number; slowestS: number };
      clinicianFlags?: string[];
      repCount?: number;
      sessionDurationS?: number;
    } = {},
  ) {
    return buildMotionAnalysisReport({
      exerciseId: "functional-reach",
      sessionDurationS: overrides.sessionDurationS ?? 15,
      repCount: overrides.repCount ?? 4,
      trackingQuality: "good",
      movementDetected: true,
      motionQuality: {
        frPilot: {
          pilotVersion: "frm-1",
          isPilot: true,
          exerciseId: "functional-reach",
          snapshotCount: 12,
          durationS: overrides.sessionDurationS ?? 15,
          repCount: overrides.repCount ?? 4,
          completeReps: overrides.repCount ?? 4,
          unclearReps: 0,
          trackingSignal: "good",
          movementDetected: true,
          phaseRatios: overrides.phaseRatios ?? {
            standing: 20,
            reaching_forward: 18,
            peak_reach: 14,
            returning: 22,
            rest: 14,
            unknown: 12,
          },
          repTimings: overrides.repTimings ?? {
            avgS: 3.2,
            fastestS: 2.8,
            slowestS: 3.8,
          },
          visibilityRatios: { hip: 88, knee: 86, ankle: 92 },
          clinicianFlags: overrides.clinicianFlags ?? [],
          reviewRequired: true,
          reviewReason: "derived_functional_reach_motion_evidence",
          disclaimer: "Assistive only.",
        },
      },
    });
  }

  it("builds polished functional reach intelligence report", () => {
    const report = enrichedFunctionalReachReport();
    assert.equal(report.kinesiologyContext?.exerciseId, "functional-reach");
    assert.ok(report.frPilot);
    assert.ok(report.executiveSummary);
    assert.ok(report.movementQuality);
    assert.ok(report.biomechanicalContributionReview);
    assert.equal(report.frPilotEvidenceMode, "persisted");
    assert.ok(hasDisplayableMotionAnalysisReport(report));
  });

  it("includes functional reach phase model in phase interpretation", () => {
    const report = enrichedFunctionalReachReport();
    const phaseIds = (report.phaseInterpretation ?? []).map((phase) => phase.phaseId);
    assert.ok(phaseIds.includes("reaching_forward"));
    assert.ok(phaseIds.includes("peak_reach"));
    assert.ok(phaseIds.includes("returning"));
  });

  it("synthesizes frPilot from session metrics when motion_quality is absent", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "functional-reach",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });
    assert.ok(report.frPilot);
    assert.equal(report.frPilot!.completeReps, 3);
    assert.equal(report.frPilot!.repTimings?.avgS, 4);
    assert.equal(report.frPilotEvidenceMode, "synthesized");
    assert.ok(report.movementQuality);
  });

  it("uses safe biomechanical review prompts without pathology labels", () => {
    const report = enrichedFunctionalReachReport();
    const prompts = report.biomechanicalContributionReview?.clinicianReviewPrompts ?? [];
    const joined = prompts.join(" ").toLowerCase();
    assert.ok(joined.includes("reach strategy") || joined.includes("balance strategy"));
    assert.ok(joined.includes("trunk control") || joined.includes("return control"));
    assert.ok(!joined.includes("weakness"));
    assert.ok(!joined.includes("return-to-sport"));
    assert.ok(!joined.includes("treatment recommendation"));
    assert.ok(!joined.includes("diagnosis"));
    assert.ok(!joined.includes("instability diagnosis"));
  });

  it("marks synthesized frPilot and avoids implying phase detection", () => {
    const report = buildMotionAnalysisReport({
      exerciseId: "functional-reach",
      sessionDurationS: 12,
      repCount: 3,
      trackingQuality: "fair",
      movementDetected: true,
    });

    assert.equal(report.frPilotEvidenceMode, "synthesized");
    assert.equal(report.phaseInterpretation, null);
    assert.equal(report.movementQuality?.observedReturningPhaseRatio, null);
    assert.ok(
      report.executiveSummary?.lines.some((line) =>
        line.includes("Limited motion evidence"),
      ),
    );
  });

  it("shows phase percentages only for persisted frPilot phase ratios", () => {
    const report = enrichedFunctionalReachReport();
    assert.equal(report.frPilotEvidenceMode, "persisted");
    assert.ok(report.phaseInterpretation && report.phaseInterpretation.length > 0);
    assert.ok(report.movementQuality?.observedReturningPhaseRatio !== null);
  });
});
