/**
 * RASQ Motion Analysis Report v3 — read-only assistive summary from
 * cv_session_metrics fields with session-specific clinical interpretation.
 * No diagnosis, scoring, progression, or treatment recommendations.
 */

import { isHoldClassCvExercise } from "@/app/lib/cv/cv-metrics-display";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import {
  resolveExerciseKinesiologyContext,
  type ExerciseKinesiologyContext,
} from "@/app/lib/cv/exercise-kinesiology-context";
import {
  buildMotionAnalysisInterpretation,
  type MotionAnalysisClinicalObservation,
  type MotionAnalysisClinicalSnapshot,
  type MotionAnalysisConfidenceLimitations,
  type MotionAnalysisConfidenceLevel,
  type MotionAnalysisKinesiologyInsight,
  type MotionAnalysisPhaseInterpretation,
  type MotionAnalysisReportHeader,
  type MotionAnalysisReportMode,
  type MotionAnalysisReviewNextGroup,
  type MotionAnalysisReviewNextItem,
  type MotionAnalysisSessionSummary,
} from "@/app/lib/cv/motion-analysis-interpretation";
import {
  buildBiomechanicalContributionReview,
  type BiomechanicalContributionReview,
} from "@/app/lib/cv/biomechanical-contribution-review";
import {
  buildBiomechanicalContributionReviewCompact,
  buildMotionAnalysisExecutiveSummary,
  filterSemanticallyDuplicatePrompts,
  resolveStsTimingMetricLabels,
  type BiomechanicalContributionReviewCompact,
  type MotionAnalysisExecutiveSummary,
  type MotionAnalysisTimingMetricLabels,
} from "@/app/lib/cv/motion-analysis-report-present";
import {
  buildHeelRaiseBiomechanicalContributionReview,
} from "@/app/lib/cv/heel-raise-biomechanical-contribution-review";
import {
  buildFunctionalReachBiomechanicalContributionReview,
} from "@/app/lib/cv/functional-reach-biomechanical-contribution-review";
import {
  buildLateralStepBiomechanicalContributionReview,
} from "@/app/lib/cv/lateral-step-biomechanical-contribution-review";
import {
  buildStepUpBiomechanicalContributionReview,
} from "@/app/lib/cv/step-up-biomechanical-contribution-review";
import {
  buildHeelRaiseMotionPilotRecord,
  type HrPilotEvidenceMode,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
export type { HrPilotEvidenceMode } from "@/app/lib/cv/heel-raise-motion-pilot-record";
export {
  HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE,
  HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
import {
  buildHeelRaiseMovementQualitySignals,
  heelRaiseSignalsToMovementQuality,
} from "@/app/lib/cv/heel-raise-movement-quality-signals";
import {
  buildStepUpMotionPilotRecord,
  type SuPilotEvidenceMode,
} from "@/app/lib/cv/step-up-motion-pilot-record";
export type { SuPilotEvidenceMode } from "@/app/lib/cv/step-up-motion-pilot-record";
export {
  STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE,
  STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import {
  buildFunctionalReachMotionPilotRecord,
  type FrPilotEvidenceMode,
} from "@/app/lib/cv/functional-reach-motion-pilot-record";
export type { FrPilotEvidenceMode } from "@/app/lib/cv/functional-reach-motion-pilot-record";
export {
  FUNCTIONAL_REACH_CYCLE_TIMING_ESTIMATED_NOTE,
  FUNCTIONAL_REACH_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/functional-reach-motion-pilot-record";
import {
  buildFunctionalReachMovementQualitySignals,
  functionalReachSignalsToMovementQuality,
} from "@/app/lib/cv/functional-reach-movement-quality-signals";
import {
  buildLateralStepMotionPilotRecord,
  type LsPilotEvidenceMode,
} from "@/app/lib/cv/lateral-step-motion-pilot-record";
export type { LsPilotEvidenceMode } from "@/app/lib/cv/lateral-step-motion-pilot-record";
export {
  LATERAL_STEP_CYCLE_TIMING_ESTIMATED_NOTE,
  LATERAL_STEP_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/lateral-step-motion-pilot-record";
import {
  buildLateralStepMovementQualitySignals,
  lateralStepSignalsToMovementQuality,
} from "@/app/lib/cv/lateral-step-movement-quality-signals";
import {
  buildStepUpMovementQualitySignals,
  stepUpSignalsToMovementQuality,
} from "@/app/lib/cv/step-up-movement-quality-signals";
import {
  buildMiniSquatBiomechanicalContributionReview,
} from "@/app/lib/cv/mini-squat-biomechanical-contribution-review";
import {
  buildMiniSquatMotionPilotRecord,
  type MsPilotEvidenceMode,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
export type { MsPilotEvidenceMode } from "@/app/lib/cv/mini-squat-motion-pilot-record";
export {
  MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE,
  MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
import {
  buildMiniSquatMovementQualitySignals,
  miniSquatSignalsToMovementQuality,
} from "@/app/lib/cv/mini-squat-movement-quality-signals";
import {
  buildMovementQualitySignals,
  type MovementQualitySignals,
} from "@/app/lib/cv/movement-quality-signals";
import type { CvMotionQualityPayload } from "@/app/lib/cv/sts-motion-pilot-record";
import {
  evaluateCvEvidenceIntegrity,
  type CvEvidenceIntegrityGate,
} from "@/app/lib/cv/cv-evidence-integrity-gate";
import {
  buildStsBiomechanicalFlags,
  type StsBiomechanicalFlagsResult,
} from "@/app/lib/cv/sts-biomechanical-flags";
import {
  buildPosturalAlignmentProxy,
  type PosturalAlignmentProxyResult,
} from "@/app/lib/cv/postural-alignment-proxy";
import type { StsMotionPilotAttemptSummary } from "@/app/lib/cv/sts-motion-pilot-record";
import {
  parseCaptureQuality,
  type CaptureQualityResult,
} from "@/app/lib/cv/capture-quality";

export type { BiomechanicalContributionReview } from "@/app/lib/cv/biomechanical-contribution-review";
export type { CvEvidenceIntegrityGate } from "@/app/lib/cv/cv-evidence-integrity-gate";
export type { StsBiomechanicalFlagsResult } from "@/app/lib/cv/sts-biomechanical-flags";
export type { PosturalAlignmentProxyResult } from "@/app/lib/cv/postural-alignment-proxy";
export type { MovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";
export type {
  BiomechanicalContributionReviewCompact,
  MotionAnalysisExecutiveSummary,
  MotionAnalysisTimingMetricLabels,
} from "@/app/lib/cv/motion-analysis-report-present";

export type {
  MotionAnalysisClinicalObservation,
  MotionAnalysisClinicalSnapshot,
  MotionAnalysisConfidenceLimitations,
  MotionAnalysisConfidenceLevel,
  MotionAnalysisKinesiologyInsight,
  MotionAnalysisPhaseInterpretation,
  MotionAnalysisReportHeader,
  MotionAnalysisReportMode,
  MotionAnalysisReviewNextGroup,
  MotionAnalysisReviewNextItem,
  MotionAnalysisSessionSummary,
} from "@/app/lib/cv/motion-analysis-interpretation";

export const MOTION_ANALYSIS_RULES_BASED_LABEL =
  "Rules-based clinical summary · clinician review required";

export const MOTION_ANALYSIS_REPORT_TITLE = "Movement intelligence report";

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

export type MotionAnalysisPhaseRatios = Partial<
  Record<
    | "seated"
    | "rising"
    | "standing"
    | "returning"
    | "lowering"
    | "bottom"
    | "peak_raise"
    | "step_ascent"
    | "top_position"
    | "step_descent"
    | "lateral_shift"
    | "step_out"
    | "return_to_center"
    | "reaching_forward"
    | "peak_reach"
    | "rest"
    | "unknown",
    number
  >
>;

export type MotionAnalysisRepTimings = {
  avgS: number | null;
  fastestS: number | null;
  slowestS: number | null;
};

export type MotionAnalysisVisibilityRatios = {
  hip: number;
  knee: number;
  ankle: number;
};

export type MotionAnalysisMotionPilotSummary = {
  snapshotCount: number;
  completeReps: number;
  unclearReps: number;
  trackingSignal: string;
  showReviewBanner: boolean;
  phaseRatios: MotionAnalysisPhaseRatios | null;
  repTimings: MotionAnalysisRepTimings | null;
  visibilityRatios: MotionAnalysisVisibilityRatios | null;
  clinicianFlags: string[] | null;
};

export type MotionAnalysisSmtPilotSummary = MotionAnalysisMotionPilotSummary;
export type MotionAnalysisMsPilotSummary = MotionAnalysisMotionPilotSummary;
export type MotionAnalysisHrPilotSummary = MotionAnalysisMotionPilotSummary;
export type MotionAnalysisSuPilotSummary = MotionAnalysisMotionPilotSummary;
export type MotionAnalysisLsPilotSummary = MotionAnalysisMotionPilotSummary;
export type MotionAnalysisFrPilotSummary = MotionAnalysisMotionPilotSummary;

export type MotionAnalysisReport = {
  sessionDurationSeconds: number;
  completedReps: number;
  movementTimeline: MotionAnalysisTimelineItem[];
  summaryLabel: MotionAnalysisSummaryLabel;
  smtPilot: MotionAnalysisSmtPilotSummary | null;
  msPilot: MotionAnalysisMsPilotSummary | null;
  /** Whether msPilot came from motion_quality or was estimated from rep count + duration. */
  msPilotEvidenceMode: MsPilotEvidenceMode | null;
  hrPilot: MotionAnalysisHrPilotSummary | null;
  /** Whether hrPilot came from motion_quality or was estimated from rep count + duration. */
  hrPilotEvidenceMode: HrPilotEvidenceMode | null;
  suPilot: MotionAnalysisSuPilotSummary | null;
  /** Whether suPilot came from motion_quality or was estimated from rep count + duration. */
  suPilotEvidenceMode: SuPilotEvidenceMode | null;
  lsPilot: MotionAnalysisLsPilotSummary | null;
  /** Whether lsPilot came from motion_quality or was estimated from rep count + duration. */
  lsPilotEvidenceMode: LsPilotEvidenceMode | null;
  frPilot: MotionAnalysisFrPilotSummary | null;
  /** Whether frPilot came from motion_quality or was estimated from rep count + duration. */
  frPilotEvidenceMode: FrPilotEvidenceMode | null;
  kinesiologyContext: ExerciseKinesiologyContext | null;
  reportMode: MotionAnalysisReportMode;
  reportHeader: MotionAnalysisReportHeader | null;
  clinicalSnapshot: MotionAnalysisClinicalSnapshot | null;
  sessionSummary: MotionAnalysisSessionSummary | null;
  phaseInterpretation: MotionAnalysisPhaseInterpretation[] | null;
  clinicalObservations: MotionAnalysisClinicalObservation[] | null;
  kinesiologyInsight: MotionAnalysisKinesiologyInsight | null;
  reviewNext: MotionAnalysisReviewNextItem[] | null;
  reviewNextGrouped: MotionAnalysisReviewNextGroup[] | null;
  confidenceLimitations: MotionAnalysisConfidenceLimitations;
  movementQuality: MovementQualitySignals | null;
  biomechanicalContributionReview: BiomechanicalContributionReview | null;
  executiveSummary: MotionAnalysisExecutiveSummary | null;
  biomechanicalContributionReviewCompact: BiomechanicalContributionReviewCompact | null;
  timingMetricLabels: MotionAnalysisTimingMetricLabels | null;
  movementQualityReviewFocusDisplay: string[] | null;
  evidenceIntegrity: CvEvidenceIntegrityGate | null;
  stsBiomechanicalFlags: StsBiomechanicalFlagsResult | null;
  posturalAlignmentProxy: PosturalAlignmentProxyResult | null;
  stsAttemptSummaries: StsMotionPilotAttemptSummary[] | null;
  /** STS smtPilot capture quality metadata when persisted (PR96+). */
  captureQuality: CaptureQualityResult | null;
};

export type BuildMotionAnalysisReportInput = {
  exerciseId?: string | null;
  recordedAt?: string | null;
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

function parseMotionPilotSummary(
  pilot: Record<string, unknown> | null | undefined,
): MotionAnalysisMotionPilotSummary | null {
  if (!pilot || typeof pilot !== "object") return null;

  const snapshotCount = nonNegativeInt(pilot.snapshotCount);
  const completeReps = nonNegativeInt(pilot.completeReps);
  const unclearReps = nonNegativeInt(pilot.unclearReps);
  const trackingSignalRaw = String(pilot.trackingSignal ?? "").trim().toLowerCase();
  const trackingSignal = TRACKING_SIGNALS.has(trackingSignalRaw) ? trackingSignalRaw : "unknown";
  const reviewRequired = pilot.reviewRequired === true;

  return {
    snapshotCount,
    completeReps,
    unclearReps,
    trackingSignal,
    showReviewBanner: reviewRequired || unclearReps > 0,
    phaseRatios: parsePhaseRatios(pilot.phaseRatios),
    repTimings: parseRepTimings(pilot.repTimings),
    visibilityRatios: parseVisibilityRatios(pilot.visibilityRatios),
    clinicianFlags: parseClinicianFlags(pilot.clinicianFlags),
  };
}

export function parseSmtPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisSmtPilotSummary | null {
  const smtPilot = motionQuality?.smtPilot;
  if (!smtPilot || typeof smtPilot !== "object") return null;
  return parseMotionPilotSummary(smtPilot as Record<string, unknown>);
}

export function parseMsPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisMsPilotSummary | null {
  const msPilot = motionQuality?.msPilot;
  if (!msPilot || typeof msPilot !== "object") return null;
  return parseMotionPilotSummary(msPilot as Record<string, unknown>);
}

export function parseHrPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisHrPilotSummary | null {
  const hrPilot = motionQuality?.hrPilot;
  if (!hrPilot || typeof hrPilot !== "object") return null;
  return parseMotionPilotSummary(hrPilot as Record<string, unknown>);
}

export function parseSuPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisSuPilotSummary | null {
  const suPilot = motionQuality?.suPilot;
  if (!suPilot || typeof suPilot !== "object") return null;
  return parseMotionPilotSummary(suPilot as Record<string, unknown>);
}

export function parseLsPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisLsPilotSummary | null {
  const lsPilot = motionQuality?.lsPilot;
  if (!lsPilot || typeof lsPilot !== "object") return null;
  return parseMotionPilotSummary(lsPilot as Record<string, unknown>);
}

export function parseFrPilotSummary(
  motionQuality: CvMotionQualityPayload | null | undefined,
): MotionAnalysisFrPilotSummary | null {
  const frPilot = motionQuality?.frPilot;
  if (!frPilot || typeof frPilot !== "object") return null;
  return parseMotionPilotSummary(frPilot as Record<string, unknown>);
}

function synthesizeMsPilotSummary(input: {
  sessionDurationSeconds: number;
  completedReps: number;
  trackingSignal: string | null;
  movementDetected: boolean;
}): MotionAnalysisMsPilotSummary | null {
  if (input.completedReps <= 0 && input.sessionDurationSeconds <= 0) return null;

  const record = buildMiniSquatMotionPilotRecord({
    metrics: {
      exerciseId: "mini-squat",
      repCount: input.completedReps,
      sessionDurationS: input.sessionDurationSeconds,
      trackingQuality:
        input.trackingSignal === "good" ||
        input.trackingSignal === "fair" ||
        input.trackingSignal === "poor"
          ? input.trackingSignal
          : "unknown",
      movementDetected: input.movementDetected,
      framesWithPose: 0,
      framesTotal: 0,
    },
    completeReps: input.completedReps,
  });

  return parseMotionPilotSummary(record as unknown as Record<string, unknown>);
}

function synthesizeHrPilotSummary(input: {
  sessionDurationSeconds: number;
  completedReps: number;
  trackingSignal: string | null;
  movementDetected: boolean;
}): MotionAnalysisHrPilotSummary | null {
  if (input.completedReps <= 0 && input.sessionDurationSeconds <= 0) return null;

  const record = buildHeelRaiseMotionPilotRecord({
    metrics: {
      exerciseId: "heel-raise",
      repCount: input.completedReps,
      sessionDurationS: input.sessionDurationSeconds,
      trackingQuality:
        input.trackingSignal === "good" ||
        input.trackingSignal === "fair" ||
        input.trackingSignal === "poor"
          ? input.trackingSignal
          : "unknown",
      movementDetected: input.movementDetected,
      framesWithPose: 0,
      framesTotal: 0,
    },
    completeReps: input.completedReps,
  });

  return parseMotionPilotSummary(record as unknown as Record<string, unknown>);
}

function synthesizeSuPilotSummary(input: {
  sessionDurationSeconds: number;
  completedReps: number;
  trackingSignal: string | null;
  movementDetected: boolean;
}): MotionAnalysisSuPilotSummary | null {
  if (input.completedReps <= 0 && input.sessionDurationSeconds <= 0) return null;

  const record = buildStepUpMotionPilotRecord({
    metrics: {
      exerciseId: "step-up",
      repCount: input.completedReps,
      sessionDurationS: input.sessionDurationSeconds,
      trackingQuality:
        input.trackingSignal === "good" ||
        input.trackingSignal === "fair" ||
        input.trackingSignal === "poor"
          ? input.trackingSignal
          : "unknown",
      movementDetected: input.movementDetected,
      framesWithPose: 0,
      framesTotal: 0,
    },
    completeReps: input.completedReps,
  });

  return parseMotionPilotSummary(record as unknown as Record<string, unknown>);
}

function synthesizeLsPilotSummary(input: {
  sessionDurationSeconds: number;
  completedReps: number;
  trackingSignal: string | null;
  movementDetected: boolean;
}): MotionAnalysisLsPilotSummary | null {
  if (input.completedReps <= 0 && input.sessionDurationSeconds <= 0) return null;

  const record = buildLateralStepMotionPilotRecord({
    metrics: {
      exerciseId: "lateral-step",
      repCount: input.completedReps,
      sessionDurationS: input.sessionDurationSeconds,
      trackingQuality:
        input.trackingSignal === "good" ||
        input.trackingSignal === "fair" ||
        input.trackingSignal === "poor"
          ? input.trackingSignal
          : "unknown",
      movementDetected: input.movementDetected,
      framesWithPose: 0,
      framesTotal: 0,
    },
    completeReps: input.completedReps,
  });

  return parseMotionPilotSummary(record as unknown as Record<string, unknown>);
}

function synthesizeFrPilotSummary(input: {
  sessionDurationSeconds: number;
  completedReps: number;
  trackingSignal: string | null;
  movementDetected: boolean;
}): MotionAnalysisFrPilotSummary | null {
  if (input.completedReps <= 0 && input.sessionDurationSeconds <= 0) return null;

  const record = buildFunctionalReachMotionPilotRecord({
    metrics: {
      exerciseId: "functional-reach",
      repCount: input.completedReps,
      sessionDurationS: input.sessionDurationSeconds,
      trackingQuality:
        input.trackingSignal === "good" ||
        input.trackingSignal === "fair" ||
        input.trackingSignal === "poor"
          ? input.trackingSignal
          : "unknown",
      movementDetected: input.movementDetected,
      framesWithPose: 0,
      framesTotal: 0,
    },
    completeReps: input.completedReps,
  });

  return parseMotionPilotSummary(record as unknown as Record<string, unknown>);
}

function parsePhaseRatios(value: unknown): MotionAnalysisPhaseRatios | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = new Set([
    "seated",
    "rising",
    "standing",
    "returning",
    "lowering",
    "bottom",
    "peak_raise",
    "step_ascent",
    "top_position",
    "step_descent",
    "lateral_shift",
    "step_out",
    "return_to_center",
    "reaching_forward",
    "peak_reach",
    "rest",
    "unknown",
  ]);
  const ratios: MotionAnalysisPhaseRatios = {};
  let hasAny = false;
  for (const [phase, ratio] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(phase)) continue;
    if (typeof ratio !== "number" || !Number.isFinite(ratio)) continue;
    ratios[phase as keyof MotionAnalysisPhaseRatios] = clampPct(ratio);
    hasAny = true;
  }
  return hasAny ? ratios : null;
}

function parseRepTimings(value: unknown): MotionAnalysisRepTimings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const timings = value as Record<string, unknown>;
  const avgS = parseNullableDurationS(timings.avgS);
  const fastestS = parseNullableDurationS(timings.fastestS);
  const slowestS = parseNullableDurationS(timings.slowestS);
  if (avgS === undefined && fastestS === undefined && slowestS === undefined) {
    return null;
  }
  return {
    avgS: avgS ?? null,
    fastestS: fastestS ?? null,
    slowestS: slowestS ?? null,
  };
}

function parseVisibilityRatios(value: unknown): MotionAnalysisVisibilityRatios | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ratios = value as Record<string, unknown>;
  if (
    typeof ratios.hip !== "number" ||
    typeof ratios.knee !== "number" ||
    typeof ratios.ankle !== "number"
  ) {
    return null;
  }
  return {
    hip: clampPct(ratios.hip),
    knee: clampPct(ratios.knee),
    ankle: clampPct(ratios.ankle),
  };
}

function parseClinicianFlags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const flags = value
    .filter((flag): flag is string => typeof flag === "string" && flag.trim().length > 0)
    .map((flag) => flag.trim());
  return flags.length > 0 ? flags : null;
}

function parseNullableDurationS(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 10) / 10;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
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

  const smtPilot =
    exerciseId === "sit-to-stand" ? parseSmtPilotSummary(input.motionQuality) : null;
  const captureQuality =
    exerciseId === "sit-to-stand"
      ? parseCaptureQuality(input.motionQuality?.smtPilot?.captureQuality)
      : null;
  const persistedMsPilot =
    exerciseId === "mini-squat" ? parseMsPilotSummary(input.motionQuality) : null;
  const msPilot =
    exerciseId === "mini-squat"
      ? persistedMsPilot ??
        synthesizeMsPilotSummary({
          sessionDurationSeconds,
          completedReps,
          trackingSignal,
          movementDetected,
        })
      : null;
  const msPilotEvidenceMode: MsPilotEvidenceMode | null =
    exerciseId === "mini-squat" && msPilot
      ? persistedMsPilot
        ? "persisted"
        : "synthesized"
      : null;
  const persistedHrPilot =
    exerciseId === "heel-raise" ? parseHrPilotSummary(input.motionQuality) : null;
  const hrPilot =
    exerciseId === "heel-raise"
      ? persistedHrPilot ??
        synthesizeHrPilotSummary({
          sessionDurationSeconds,
          completedReps,
          trackingSignal,
          movementDetected,
        })
      : null;
  const hrPilotEvidenceMode: HrPilotEvidenceMode | null =
    exerciseId === "heel-raise" && hrPilot
      ? persistedHrPilot
        ? "persisted"
        : "synthesized"
      : null;
  const persistedSuPilot =
    exerciseId === "step-up" ? parseSuPilotSummary(input.motionQuality) : null;
  const suPilot =
    exerciseId === "step-up"
      ? persistedSuPilot ??
        synthesizeSuPilotSummary({
          sessionDurationSeconds,
          completedReps,
          trackingSignal,
          movementDetected,
        })
      : null;
  const suPilotEvidenceMode: SuPilotEvidenceMode | null =
    exerciseId === "step-up" && suPilot
      ? persistedSuPilot
        ? "persisted"
        : "synthesized"
      : null;
  const persistedLsPilot =
    exerciseId === "lateral-step" ? parseLsPilotSummary(input.motionQuality) : null;
  const lsPilot =
    exerciseId === "lateral-step"
      ? persistedLsPilot ??
        synthesizeLsPilotSummary({
          sessionDurationSeconds,
          completedReps,
          trackingSignal,
          movementDetected,
        })
      : null;
  const lsPilotEvidenceMode: LsPilotEvidenceMode | null =
    exerciseId === "lateral-step" && lsPilot
      ? persistedLsPilot
        ? "persisted"
        : "synthesized"
      : null;
  const persistedFrPilot =
    exerciseId === "functional-reach" ? parseFrPilotSummary(input.motionQuality) : null;
  const frPilot =
    exerciseId === "functional-reach"
      ? persistedFrPilot ??
        synthesizeFrPilotSummary({
          sessionDurationSeconds,
          completedReps,
          trackingSignal,
          movementDetected,
        })
      : null;
  const frPilotEvidenceMode: FrPilotEvidenceMode | null =
    exerciseId === "functional-reach" && frPilot
      ? persistedFrPilot
        ? "persisted"
        : "synthesized"
      : null;
  const motionPilot = smtPilot ?? msPilot ?? hrPilot ?? suPilot ?? lsPilot ?? frPilot;
  const evidenceSynthesized =
    msPilotEvidenceMode === "synthesized" ||
    hrPilotEvidenceMode === "synthesized" ||
    suPilotEvidenceMode === "synthesized" ||
    lsPilotEvidenceMode === "synthesized" ||
    frPilotEvidenceMode === "synthesized";
  const kinesiologyContext = resolveExerciseKinesiologyContext(exerciseId);
  const summaryLabel = resolveMotionAnalysisSummaryLabel({
    trackingSignal,
    movementDetected,
    sessionDurationSeconds,
  });

  const recordedAt =
    typeof input.recordedAt === "string" && input.recordedAt.trim().length > 0
      ? input.recordedAt.trim()
      : null;

  const evidenceIntegrity = evaluateCvEvidenceIntegrity({
    exerciseId,
    completedReps,
    trackingSignal,
    summaryLabel,
    motionPilot,
    evidenceSynthesized,
  });

  const interpretation = buildMotionAnalysisInterpretation({
    exerciseId,
    recordedAt,
    summaryLabel,
    sessionDurationSeconds,
    completedReps,
    movementDetected,
    trackingSignal,
    smtPilot: motionPilot,
    kinesiologyContext,
    evidenceIntegrity,
  });

  const stsMovementQuality = buildMovementQualitySignals({
    exerciseId,
    repTimings: smtPilot?.repTimings ?? null,
    phaseRatios: smtPilot?.phaseRatios ?? null,
    completeReps: smtPilot?.completeReps ?? completedReps,
    unclearReps: smtPilot?.unclearReps ?? 0,
    clinicianFlags: smtPilot?.clinicianFlags ?? null,
    trackingQuality: trackingSignal,
    summaryLabel,
  });

  const miniSquatMovementQuality =
    exerciseId === "mini-squat"
      ? buildMiniSquatMovementQualitySignals({
          exerciseId,
          evidenceMode: msPilotEvidenceMode ?? undefined,
          repTimings: msPilot?.repTimings ?? null,
          phaseRatios: msPilot?.phaseRatios ?? null,
          completeReps: msPilot?.completeReps ?? completedReps,
          unclearReps: msPilot?.unclearReps ?? 0,
          clinicianFlags: msPilot?.clinicianFlags ?? null,
          trackingQuality: trackingSignal,
          summaryLabel,
        })
      : null;

  const heelRaiseMovementQuality =
    exerciseId === "heel-raise"
      ? buildHeelRaiseMovementQualitySignals({
          exerciseId,
          evidenceMode: hrPilotEvidenceMode ?? undefined,
          repTimings: hrPilot?.repTimings ?? null,
          phaseRatios: hrPilot?.phaseRatios ?? null,
          completeReps: hrPilot?.completeReps ?? completedReps,
          unclearReps: hrPilot?.unclearReps ?? 0,
          clinicianFlags: hrPilot?.clinicianFlags ?? null,
          trackingQuality: trackingSignal,
          summaryLabel,
        })
      : null;

  const stepUpMovementQuality =
    exerciseId === "step-up"
      ? buildStepUpMovementQualitySignals({
          exerciseId,
          evidenceMode: suPilotEvidenceMode ?? undefined,
          repTimings: suPilot?.repTimings ?? null,
          phaseRatios: suPilot?.phaseRatios ?? null,
          completeReps: suPilot?.completeReps ?? completedReps,
          unclearReps: suPilot?.unclearReps ?? 0,
          clinicianFlags: suPilot?.clinicianFlags ?? null,
          trackingQuality: trackingSignal,
          summaryLabel,
        })
      : null;

  const lateralStepMovementQuality =
    exerciseId === "lateral-step"
      ? buildLateralStepMovementQualitySignals({
          exerciseId,
          evidenceMode: lsPilotEvidenceMode ?? undefined,
          repTimings: lsPilot?.repTimings ?? null,
          phaseRatios: lsPilot?.phaseRatios ?? null,
          completeReps: lsPilot?.completeReps ?? completedReps,
          unclearReps: lsPilot?.unclearReps ?? 0,
          clinicianFlags: lsPilot?.clinicianFlags ?? null,
          trackingQuality: trackingSignal,
          summaryLabel,
        })
      : null;

  const functionalReachMovementQuality =
    exerciseId === "functional-reach"
      ? buildFunctionalReachMovementQualitySignals({
          exerciseId,
          evidenceMode: frPilotEvidenceMode ?? undefined,
          repTimings: frPilot?.repTimings ?? null,
          phaseRatios: frPilot?.phaseRatios ?? null,
          completeReps: frPilot?.completeReps ?? completedReps,
          unclearReps: frPilot?.unclearReps ?? 0,
          clinicianFlags: frPilot?.clinicianFlags ?? null,
          trackingQuality: trackingSignal,
          summaryLabel,
        })
      : null;

  const movementQuality =
    stsMovementQuality ??
    (miniSquatMovementQuality
      ? miniSquatSignalsToMovementQuality(miniSquatMovementQuality)
      : null) ??
    (heelRaiseMovementQuality
      ? heelRaiseSignalsToMovementQuality(heelRaiseMovementQuality)
      : null) ??
    (stepUpMovementQuality
      ? stepUpSignalsToMovementQuality(stepUpMovementQuality)
      : null) ??
    (lateralStepMovementQuality
      ? lateralStepSignalsToMovementQuality(lateralStepMovementQuality)
      : null) ??
    (functionalReachMovementQuality
      ? functionalReachSignalsToMovementQuality(functionalReachMovementQuality)
      : null);

  const stsBiomechanicalReview = buildBiomechanicalContributionReview({
    exerciseId,
    phaseRatios: smtPilot?.phaseRatios ?? null,
    movementQuality: stsMovementQuality,
    clinicianFlags: smtPilot?.clinicianFlags ?? null,
    kinesiologyContext,
    trackingQuality: trackingSignal,
    summaryLabel,
    visibilityRatios: smtPilot?.visibilityRatios ?? null,
  });

  const miniSquatBiomechanicalReview =
    exerciseId === "mini-squat"
      ? buildMiniSquatBiomechanicalContributionReview({
          exerciseId,
          evidenceMode: msPilotEvidenceMode ?? undefined,
          phaseRatios: msPilot?.phaseRatios ?? null,
          movementQuality: miniSquatMovementQuality,
          clinicianFlags: msPilot?.clinicianFlags ?? null,
          kinesiologyContext,
          trackingQuality: trackingSignal,
          summaryLabel,
          visibilityRatios: msPilot?.visibilityRatios ?? null,
        })
      : null;

  const heelRaiseBiomechanicalReview =
    exerciseId === "heel-raise"
      ? buildHeelRaiseBiomechanicalContributionReview({
          exerciseId,
          evidenceMode: hrPilotEvidenceMode ?? undefined,
          phaseRatios: hrPilot?.phaseRatios ?? null,
          movementQuality: heelRaiseMovementQuality,
          clinicianFlags: hrPilot?.clinicianFlags ?? null,
          kinesiologyContext,
          trackingQuality: trackingSignal,
          summaryLabel,
          visibilityRatios: hrPilot?.visibilityRatios ?? null,
        })
      : null;

  const stepUpBiomechanicalReview =
    exerciseId === "step-up"
      ? buildStepUpBiomechanicalContributionReview({
          exerciseId,
          evidenceMode: suPilotEvidenceMode ?? undefined,
          phaseRatios: suPilot?.phaseRatios ?? null,
          movementQuality: stepUpMovementQuality,
          clinicianFlags: suPilot?.clinicianFlags ?? null,
          kinesiologyContext,
          trackingQuality: trackingSignal,
          summaryLabel,
          visibilityRatios: suPilot?.visibilityRatios ?? null,
        })
      : null;

  const lateralStepBiomechanicalReview =
    exerciseId === "lateral-step"
      ? buildLateralStepBiomechanicalContributionReview({
          exerciseId,
          evidenceMode: lsPilotEvidenceMode ?? undefined,
          phaseRatios: lsPilot?.phaseRatios ?? null,
          movementQuality: lateralStepMovementQuality,
          clinicianFlags: lsPilot?.clinicianFlags ?? null,
          kinesiologyContext,
          trackingQuality: trackingSignal,
          summaryLabel,
          visibilityRatios: lsPilot?.visibilityRatios ?? null,
        })
      : null;

  const functionalReachBiomechanicalReview =
    exerciseId === "functional-reach"
      ? buildFunctionalReachBiomechanicalContributionReview({
          exerciseId,
          evidenceMode: frPilotEvidenceMode ?? undefined,
          phaseRatios: frPilot?.phaseRatios ?? null,
          movementQuality: functionalReachMovementQuality,
          clinicianFlags: frPilot?.clinicianFlags ?? null,
          kinesiologyContext,
          trackingQuality: trackingSignal,
          summaryLabel,
          visibilityRatios: frPilot?.visibilityRatios ?? null,
        })
      : null;

  const biomechanicalContributionReviewRaw =
    stsBiomechanicalReview ??
    miniSquatBiomechanicalReview ??
    heelRaiseBiomechanicalReview ??
    stepUpBiomechanicalReview ??
    lateralStepBiomechanicalReview ??
    functionalReachBiomechanicalReview;
  const biomechanicalContributionReview =
    evidenceIntegrity.sufficientForBiomechanicalInterpretation
      ? biomechanicalContributionReviewRaw
      : null;

  const stsBiomechanicalFlags =
    exerciseId === "sit-to-stand"
      ? buildStsBiomechanicalFlags({
          exerciseId,
          evidenceIntegrity,
          smtPilot,
          movementQuality: stsMovementQuality,
        })
      : null;

  const posturalAlignmentProxy = buildPosturalAlignmentProxy({
    exerciseId,
    evidenceIntegrity,
    motionPilot,
    movementQuality,
  });

  const stsAttemptSummaries =
    exerciseId === "sit-to-stand" &&
    Array.isArray(input.motionQuality?.smtPilot?.attemptSummaries) &&
    input.motionQuality.smtPilot.attemptSummaries.length > 0
      ? input.motionQuality.smtPilot.attemptSummaries
      : null;

  const reportDraft: MotionAnalysisReport = {
    sessionDurationSeconds,
    completedReps,
    movementTimeline,
    summaryLabel,
    smtPilot,
    msPilot,
    msPilotEvidenceMode,
    hrPilot,
    hrPilotEvidenceMode,
    suPilot,
    suPilotEvidenceMode,
    lsPilot,
    lsPilotEvidenceMode,
    frPilot,
    frPilotEvidenceMode,
    kinesiologyContext,
    reportMode: interpretation.reportMode,
    reportHeader: interpretation.reportHeader,
    clinicalSnapshot: interpretation.clinicalSnapshot,
    sessionSummary: interpretation.sessionSummary,
    phaseInterpretation: interpretation.phaseInterpretation,
    clinicalObservations: interpretation.clinicalObservations,
    kinesiologyInsight: interpretation.kinesiologyInsight,
    reviewNext: interpretation.reviewNext,
    reviewNextGrouped: interpretation.reviewNextGrouped,
    confidenceLimitations: interpretation.confidenceLimitations,
    movementQuality,
    biomechanicalContributionReview,
    executiveSummary: null,
    biomechanicalContributionReviewCompact: null,
    timingMetricLabels: null,
    movementQualityReviewFocusDisplay: null,
    evidenceIntegrity,
    stsBiomechanicalFlags,
    posturalAlignmentProxy,
    stsAttemptSummaries,
    captureQuality,
  };

  const executiveSummary = buildMotionAnalysisExecutiveSummary(reportDraft);
  const biomechanicalContributionReviewCompact = biomechanicalContributionReview
    ? buildBiomechanicalContributionReviewCompact(
        biomechanicalContributionReview,
        interpretation.reviewNext,
        movementQuality?.clinicianReviewFocus,
      )
    : null;
  const timingMetricLabels =
    exerciseId === "sit-to-stand" ||
    exerciseId === "mini-squat" ||
    exerciseId === "heel-raise" ||
    exerciseId === "step-up" ||
    exerciseId === "lateral-step" ||
    exerciseId === "functional-reach"
      ? resolveStsTimingMetricLabels(motionPilot?.phaseRatios ?? null)
      : null;
  const movementQualityReviewFocusDisplay =
    (exerciseId === "sit-to-stand" ||
      exerciseId === "mini-squat" ||
      exerciseId === "heel-raise" ||
      exerciseId === "step-up" ||
      exerciseId === "lateral-step" ||
      exerciseId === "functional-reach") &&
    movementQuality
      ? filterSemanticallyDuplicatePrompts(movementQuality.clinicianReviewFocus, [
          ...(interpretation.reviewNext ?? []).map((item) => item.text),
          ...(biomechanicalContributionReviewCompact?.clinicianReview ?? []),
        ])
      : null;

  return {
    sessionDurationSeconds,
    completedReps,
    movementTimeline,
    summaryLabel,
    smtPilot,
    msPilot,
    msPilotEvidenceMode,
    hrPilot,
    hrPilotEvidenceMode,
    suPilot,
    suPilotEvidenceMode,
    lsPilot,
    lsPilotEvidenceMode,
    frPilot,
    frPilotEvidenceMode,
    kinesiologyContext,
    reportMode: interpretation.reportMode,
    reportHeader: interpretation.reportHeader,
    clinicalSnapshot: interpretation.clinicalSnapshot,
    sessionSummary: interpretation.sessionSummary,
    phaseInterpretation: interpretation.phaseInterpretation,
    clinicalObservations: interpretation.clinicalObservations,
    kinesiologyInsight: interpretation.kinesiologyInsight,
    reviewNext: interpretation.reviewNext,
    reviewNextGrouped: interpretation.reviewNextGrouped,
    confidenceLimitations: interpretation.confidenceLimitations,
    movementQuality,
    biomechanicalContributionReview,
    executiveSummary,
    biomechanicalContributionReviewCompact,
    timingMetricLabels,
    movementQualityReviewFocusDisplay,
    evidenceIntegrity,
    stsBiomechanicalFlags,
    posturalAlignmentProxy,
    stsAttemptSummaries,
    captureQuality,
  };
}

/** True when the report has enough derived data to show clinicians. */
export function hasDisplayableMotionAnalysisReport(
  report: MotionAnalysisReport,
): boolean {
  return (
    report.reportMode !== "minimal" &&
    (report.smtPilot != null ||
      report.msPilot != null ||
      report.hrPilot != null ||
      report.suPilot != null ||
      report.lsPilot != null ||
      report.frPilot != null ||
      report.kinesiologyContext != null ||
      report.reportHeader != null ||
      report.sessionDurationSeconds > 0 ||
      report.completedReps > 0 ||
      report.movementTimeline.length > 0)
  );
}

/** Map public CV metric row (GET /api/cv/session-metrics) to report builder input. */
export function motionAnalysisInputFromCvMetric(
  metric: Pick<
    CvSessionMetricPublic,
    | "exerciseId"
    | "recordedAt"
    | "repCount"
    | "sessionDurationS"
    | "trackingQuality"
    | "movementDetected"
    | "motionQuality"
  >,
): BuildMotionAnalysisReportInput {
  return {
    exerciseId: metric.exerciseId,
    recordedAt: metric.recordedAt,
    sessionDurationS: metric.sessionDurationS,
    repCount: metric.repCount,
    trackingQuality: metric.trackingQuality,
    movementDetected: metric.movementDetected,
    motionQuality: metric.motionQuality ?? null,
  };
}
