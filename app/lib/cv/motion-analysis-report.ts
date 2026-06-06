/**
 * RASQ Motion Analysis Report v2 — read-only assistive summary from cv_session_metrics fields.
 * Optional smtPilot display from motion_quality when present. No diagnosis, scoring,
 * progression, or treatment recommendations.
 */

import { isHoldClassCvExercise } from "@/app/lib/cv/cv-metrics-display";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";

export const MOTION_ANALYSIS_SUMMARY_LABELS = [
  "Review suggested",
  "Movement data available",
  "Limited visibility",
  "Session completed",
] as const;

export type MotionAnalysisSummaryLabel =
  (typeof MOTION_ANALYSIS_SUMMARY_LABELS)[number];

export type MotionAnalysisTimelineItem = {
  /** Seconds from session start when known; null for session-level notes. */
  atSecond: number | null;
  label: string;
  detail: string | null;
};

export const MOTION_ANALYSIS_CAMERA_DISCLAIMER =
  "Camera-assisted data · not clinically validated · clinician review required";

export const MOTION_ANALYSIS_REVIEW_BANNER =
  "Flagged for clinician review · camera-assisted data only";

export type MotionAnalysisSmtPilotSummary = {
  snapshotCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: string;
  showReviewBanner: boolean;
};

export type MotionAnalysisReport = {
  sessionDurationSeconds: number;
  completedReps: number;
  movementTimeline: MotionAnalysisTimelineItem[];
  summaryLabel: MotionAnalysisSummaryLabel;
  smtPilot: MotionAnalysisSmtPilotSummary | null;
};

export type BuildMotionAnalysisReportInput = {
  exerciseId?: string | null;
  sessionDurationS?: number | null;
  repCount?: number | null;
  trackingQuality?: string | null;
  movementDetected?: boolean | null;
  motionQuality?: CvMotionQualityPayload | null;
};

const TRACKING_SIGNALS = new Set(["good", "fair", "poor", "unknown", "lost", "mixed"]);

export type TrackingSignalDotTone = "good" | "fair" | "poor" | "unknown";

export function trackingSignalDotTone(signal: string | null | undefined): TrackingSignalDotTone {
  const normalized = signal?.trim().toLowerCase();
  if (normalized === "good") return "good";
  if (normalized === "fair" || normalized === "mixed") return "fair";
  if (normalized === "poor" || normalized === "lost") return "poor";
  return "unknown";
}

export function formatMotionAnalysisTrackingSignal(signal: string | null | undefined): string {
  const normalized = signal?.trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "good") return "Good";
  if (normalized === "fair") return "Fair";
  if (normalized === "poor") return "Poor";
  if (normalized === "unknown") return "Unknown";
  if (normalized === "lost") return "Lost";
  if (normalized === "mixed") return "Mixed";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function parseSmtPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisSmtPilotSummary | null {
  const smtPilot = motionQuality?.smtPilot;
  if (!smtPilot || typeof smtPilot !== "object") return null;

  const snapshotCount = nonNegativeInt(smtPilot.snapshotCount);
  const completeReps = nonNegativeInt(smtPilot.completeReps);
  const unclearReps = nonNegativeInt(smtPilot.unclearReps);
  const trackingSignalRaw = String(smtPilot.trackingSignal ?? "").trim().toLowerCase();
  const trackingSignal = TRACKING_SIGNALS.has(trackingSignalRaw) ? trackingSignalRaw : "unknown";
  const reviewRequired = smtPilot.reviewRequired === true;

  return {
    snapshotCount,
    completeReps,
    unclearReps,
    trackingSignal,
    showReviewBanner: reviewRequired || unclearReps > 0,
  };
}

function nonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeTrackingSignal(quality: string | null | undefined): string | null {
  const trimmed = quality?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function isLimitedVisibility(signal: string | null): boolean {
  if (!signal) return false;
  return signal === "poor" || signal === "lost" || signal === "unknown";
}

export function resolveMotionAnalysisSummaryLabel(input: {
  trackingSignal: string | null;
  movementDetected: boolean;
  sessionDurationSeconds: number;
}): MotionAnalysisSummaryLabel {
  if (isLimitedVisibility(input.trackingSignal)) {
    return "Limited visibility";
  }
  if (input.sessionDurationSeconds > 0 && !input.movementDetected) {
    return "Review suggested";
  }
  if (input.movementDetected) {
    return "Movement data available";
  }
  return "Session completed";
}

function buildMovementTimeline(input: {
  exerciseId: string | null;
  sessionDurationSeconds: number;
  completedReps: number;
  movementDetected: boolean;
  trackingSignal: string | null;
}): MotionAnalysisTimelineItem[] {
  const timeline: MotionAnalysisTimelineItem[] = [];
  const holdClass = isHoldClassCvExercise(input.exerciseId);

  if (input.sessionDurationSeconds > 0) {
    timeline.push({
      atSecond: 0,
      label: "Session started",
      detail: null,
    });
  }

  if (input.movementDetected) {
    timeline.push({
      atSecond: null,
      label: "Movement observed",
      detail: "Movement data available",
    });
  } else if (input.sessionDurationSeconds > 0) {
    timeline.push({
      atSecond: null,
      label: "Movement not detected",
      detail: "Recorded session — verify capture conditions",
    });
  }

  if (holdClass && input.sessionDurationSeconds > 0) {
    timeline.push({
      atSecond: null,
      label: "Assistive hold tracked",
      detail: `${input.sessionDurationSeconds}s assistive duration`,
    });
  } else if (input.completedReps > 0) {
    timeline.push({
      atSecond: null,
      label: "Repetitions recorded",
      detail: `${input.completedReps} assistive rep count`,
    });
  }

  if (isLimitedVisibility(input.trackingSignal)) {
    timeline.push({
      atSecond: null,
      label: "Camera visibility note",
      detail: "Limited visibility",
    });
  }

  if (input.sessionDurationSeconds > 0) {
    timeline.push({
      atSecond: input.sessionDurationSeconds,
      label: "Session ended",
      detail: "Session completed",
    });
  }

  return timeline;
}

export function buildMotionAnalysisReport(
  input: BuildMotionAnalysisReportInput = {},
): MotionAnalysisReport {
  const sessionDurationSeconds = nonNegativeInt(input.sessionDurationS);
  const completedReps = nonNegativeInt(input.repCount);
  const trackingSignal = normalizeTrackingSignal(input.trackingQuality);
  const movementDetected = input.movementDetected === true;
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;

  const movementTimeline = buildMovementTimeline({
    exerciseId,
    sessionDurationSeconds,
    completedReps,
    movementDetected,
    trackingSignal,
  });

  const smtPilot = parseSmtPilotSummary(input.motionQuality);

  return {
    sessionDurationSeconds,
    completedReps,
    movementTimeline,
    summaryLabel: resolveMotionAnalysisSummaryLabel({
      trackingSignal,
      movementDetected,
      sessionDurationSeconds,
    }),
    smtPilot,
  };
}

/** True when the report has enough derived data to show clinicians. */
export function hasDisplayableMotionAnalysisReport(
  report: MotionAnalysisReport,
): boolean {
  return (
    report.smtPilot != null ||
    report.sessionDurationSeconds > 0 ||
    report.completedReps > 0 ||
    report.movementTimeline.length > 0
  );
}

/** Map public CV metric row (GET /api/cv/session-metrics) to report builder input. */
export function motionAnalysisInputFromCvMetric(
  metric: Pick<
    CvSessionMetricPublic,
    | "exerciseId"
    | "repCount"
    | "sessionDurationS"
    | "trackingQuality"
    | "movementDetected"
    | "motionQuality"
  >,
): BuildMotionAnalysisReportInput {
  return {
    exerciseId: metric.exerciseId,
    sessionDurationS: metric.sessionDurationS,
    repCount: metric.repCount,
    trackingQuality: metric.trackingQuality,
    movementDetected: metric.movementDetected,
    motionQuality: metric.motionQuality ?? null,
  };
}
