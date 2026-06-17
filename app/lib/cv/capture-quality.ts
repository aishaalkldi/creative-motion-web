/**
 * Shared CV capture quality and reliability scoring — technical QC only.
 * Not clinical interpretation, diagnosis, or treatment advice.
 */

import type { BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import {
  PATIENT_POSE_ANKLE_INDICES,
  PATIENT_POSE_HIP_INDICES,
  PATIENT_POSE_KNEE_INDICES,
  PATIENT_POSE_SHOULDER_INDICES,
  type PoseLandmark,
} from "@/app/lib/cv/pose-landmark-overlay";

export type CaptureQualityLevel = "high" | "medium" | "low";

export type BodyVisibilityLevel = "good" | "fair" | "poor";

export type TrackingConfidenceLevel = "high" | "medium" | "low";

export type CameraPositionStatus = "acceptable" | "needs_adjustment" | "unknown";

export type CaptureQualityResult = {
  qualityLevel: CaptureQualityLevel;
  bodyVisibility: BodyVisibilityLevel;
  trackingConfidence: TrackingConfidenceLevel;
  cameraPosition: CameraPositionStatus;
  retestRecommended: boolean;
  warnings: string[];
};

export type CaptureQualityLandmarkInput = {
  landmarks: readonly PoseLandmark[];
  bodyFramingState?: BodyFramingState;
  trackingStatus?: "idle" | "detecting" | "pose-found" | "pose-lost";
};

export type CaptureQualitySessionInput = {
  visibilityRatios: { hip: number; knee: number; ankle: number };
  trackingSignal: CvTrackingQuality | "lost" | "mixed";
  poseLossEventCount?: number;
  captureFlags?: readonly string[];
};

const MIN_PRESENT_VISIBILITY = 0.2;
const HIGH_CONFIDENCE = 0.6;
const MEDIUM_CONFIDENCE = 0.35;

const WARNING_FULL_BODY = "Full body may not be visible";
const WARNING_LOW_TRACKING = "Low tracking confidence";
const WARNING_LOWER_LIMB = "Key lower-limb landmarks are missing";
const WARNING_CAMERA = "Camera position may affect measurement reliability";
const WARNING_RETEST = "Retest recommended before therapist review";
const WARNING_SETUP_LIMITED = "Capture started before setup checks passed";
const WARNING_TRACKING_INTERRUPTED = "Tracking was interrupted during session";
const WARNING_NO_TIMELINE = "No motion timeline snapshots were recorded";

export const CAPTURE_SETUP_LIMITED_FLAG = "capture_setup_limited";
export const CAPTURE_POSE_INTERRUPTED_FLAG = "pose_tracking_interrupted";
export const CAPTURE_NO_TIMELINE_FLAG = "no_timeline_snapshots";

/** Safe-language guard — warnings must not contain clinical/diagnostic terms. */
export const FORBIDDEN_CAPTURE_WARNING_TERMS = [
  "abnormal",
  "diagnosis",
  "pathology",
  "weakness",
  "injury risk",
  "clinical decision",
] as const;

function visibilityAt(landmarks: readonly PoseLandmark[], index: number): number {
  const lm = landmarks[index];
  if (!lm) return 0;
  const v = lm.visibility;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

function groupStats(
  landmarks: readonly PoseLandmark[],
  indices: readonly number[],
): { presentCount: number; avgVisibility: number; anyPresent: boolean; bothPresent: boolean } {
  const values = indices.map((i) => visibilityAt(landmarks, i));
  const present = values.filter((v) => v >= MIN_PRESENT_VISIBILITY);
  return {
    presentCount: present.length,
    avgVisibility:
      present.length > 0
        ? present.reduce((sum, v) => sum + v, 0) / present.length
        : 0,
    anyPresent: present.length > 0,
    bothPresent: present.length >= indices.length,
  };
}

function lowerLimbLandmarksMissing(landmarks: readonly PoseLandmark[]): boolean {
  const hip = groupStats(landmarks, PATIENT_POSE_HIP_INDICES);
  const knee = groupStats(landmarks, PATIENT_POSE_KNEE_INDICES);
  const ankle = groupStats(landmarks, PATIENT_POSE_ANKLE_INDICES);
  return !hip.anyPresent || !knee.anyPresent || !ankle.anyPresent;
}

function essentialLowerLimbMissing(landmarks: readonly PoseLandmark[]): boolean {
  const hip = groupStats(landmarks, PATIENT_POSE_HIP_INDICES);
  const knee = groupStats(landmarks, PATIENT_POSE_KNEE_INDICES);
  return !hip.anyPresent || !knee.anyPresent;
}

function cameraPositionFromFraming(
  bodyFramingState?: BodyFramingState,
  trackingStatus?: CaptureQualityLandmarkInput["trackingStatus"],
): CameraPositionStatus {
  if (!bodyFramingState && trackingStatus === "pose-lost") {
    return "needs_adjustment";
  }
  if (!bodyFramingState) return "unknown";

  switch (bodyFramingState) {
    case "good_distance":
      return "acceptable";
    case "move_back":
    case "move_closer":
    case "adjust_camera_angle":
    case "low_visibility":
      return "needs_adjustment";
    case "checking":
    default:
      return "unknown";
  }
}

function bodyVisibilityFromAverage(avg: number): BodyVisibilityLevel {
  if (avg >= HIGH_CONFIDENCE) return "good";
  if (avg >= MEDIUM_CONFIDENCE) return "fair";
  return "poor";
}

function trackingConfidenceFromAverage(avg: number): TrackingConfidenceLevel {
  if (avg >= HIGH_CONFIDENCE) return "high";
  if (avg >= MEDIUM_CONFIDENCE) return "medium";
  return "low";
}

function qualityLevelFromSignals(input: {
  avgConfidence: number;
  essentialMissing: boolean;
  lowerLimbMissing: boolean;
  trackingConfidence: TrackingConfidenceLevel;
  bodyVisibility: BodyVisibilityLevel;
}): CaptureQualityLevel {
  if (input.essentialMissing || input.trackingConfidence === "low") return "low";
  if (
    input.lowerLimbMissing ||
    input.bodyVisibility === "poor" ||
    input.trackingConfidence === "medium"
  ) {
    return "medium";
  }
  if (input.avgConfidence >= HIGH_CONFIDENCE && input.bodyVisibility === "good") {
    return "high";
  }
  if (input.avgConfidence >= MEDIUM_CONFIDENCE) return "medium";
  return "low";
}

function hasCaptureFlag(flags: readonly string[] | undefined, flag: string): boolean {
  return (flags ?? []).includes(flag);
}

function buildWarnings(input: {
  qualityLevel: CaptureQualityLevel;
  bodyVisibility: BodyVisibilityLevel;
  trackingConfidence: TrackingConfidenceLevel;
  cameraPosition: CameraPositionStatus;
  lowerLimbMissing: boolean;
  essentialMissing: boolean;
  setupLimited?: boolean;
  trackingInterrupted?: boolean;
  noTimelineSnapshots?: boolean;
}): string[] {
  const warnings: string[] = [];
  if (input.bodyVisibility === "poor" || input.essentialMissing) {
    warnings.push(WARNING_FULL_BODY);
  }
  if (input.trackingConfidence === "low") {
    warnings.push(WARNING_LOW_TRACKING);
  }
  if (input.lowerLimbMissing) {
    warnings.push(WARNING_LOWER_LIMB);
  }
  if (input.cameraPosition === "needs_adjustment") {
    warnings.push(WARNING_CAMERA);
  }
  if (input.setupLimited) {
    warnings.push(WARNING_SETUP_LIMITED);
  }
  if (input.trackingInterrupted) {
    warnings.push(WARNING_TRACKING_INTERRUPTED);
  }
  if (input.noTimelineSnapshots) {
    warnings.push(WARNING_NO_TIMELINE);
  }
  if (
    input.qualityLevel === "low" ||
    input.essentialMissing ||
    input.setupLimited ||
    input.noTimelineSnapshots
  ) {
    warnings.push(WARNING_RETEST);
  }
  return [...new Set(warnings)];
}

function pctToUnit(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(1, pct / 100));
}

function trackingSignalToConfidence(
  signal: CaptureQualitySessionInput["trackingSignal"],
): TrackingConfidenceLevel {
  if (signal === "lost" || signal === "poor" || signal === "mixed") return "low";
  if (signal === "fair" || signal === "unknown") return "medium";
  return "high";
}

/**
 * Frame-level capture quality from pose landmarks (pure, testable).
 */
export function assessCaptureQualityFromLandmarks(
  input: CaptureQualityLandmarkInput,
): CaptureQualityResult {
  const { landmarks, bodyFramingState, trackingStatus } = input;

  const shoulder = groupStats(landmarks, PATIENT_POSE_SHOULDER_INDICES);
  const hip = groupStats(landmarks, PATIENT_POSE_HIP_INDICES);
  const knee = groupStats(landmarks, PATIENT_POSE_KNEE_INDICES);
  const ankle = groupStats(landmarks, PATIENT_POSE_ANKLE_INDICES);

  const trackedGroups = [shoulder, hip, knee, ankle].filter((g) => g.anyPresent);
  const avgConfidence =
    trackedGroups.length > 0
      ? trackedGroups.reduce((sum, g) => sum + g.avgVisibility, 0) / trackedGroups.length
      : 0;

  const lowerLimbMissing = lowerLimbLandmarksMissing(landmarks);
  const essentialMissing = essentialLowerLimbMissing(landmarks);

  const bodyVisibility = bodyVisibilityFromAverage(avgConfidence);
  let trackingConfidence = trackingConfidenceFromAverage(avgConfidence);
  if (trackingStatus === "pose-lost") trackingConfidence = "low";

  const cameraPosition = cameraPositionFromFraming(bodyFramingState, trackingStatus);

  const qualityLevel = qualityLevelFromSignals({
    avgConfidence,
    essentialMissing,
    lowerLimbMissing,
    trackingConfidence,
    bodyVisibility,
  });

  const retestRecommended = qualityLevel === "low" || essentialMissing;

  return {
    qualityLevel,
    bodyVisibility,
    trackingConfidence,
    cameraPosition,
    retestRecommended,
    warnings: buildWarnings({
      qualityLevel,
      bodyVisibility,
      trackingConfidence,
      cameraPosition,
      lowerLimbMissing,
      essentialMissing,
    }),
  };
}

/**
 * Session-level capture quality from STS visibility assist + tracking rollup.
 */
export function assessCaptureQualityFromSession(
  input: CaptureQualitySessionInput,
): CaptureQualityResult {
  const flags = input.captureFlags ?? [];
  const setupLimited = hasCaptureFlag(flags, CAPTURE_SETUP_LIMITED_FLAG);
  const trackingInterrupted =
    hasCaptureFlag(flags, CAPTURE_POSE_INTERRUPTED_FLAG) ||
    (input.poseLossEventCount ?? 0) > 0;
  const noTimelineSnapshots = hasCaptureFlag(flags, CAPTURE_NO_TIMELINE_FLAG);

  const hip = pctToUnit(input.visibilityRatios.hip);
  const knee = pctToUnit(input.visibilityRatios.knee);
  const ankle = pctToUnit(input.visibilityRatios.ankle);
  const avgConfidence = (hip + knee + ankle) / 3;

  const lowerLimbMissing = hip < MIN_PRESENT_VISIBILITY || knee < MIN_PRESENT_VISIBILITY || ankle < MIN_PRESENT_VISIBILITY;
  const essentialMissing = hip < MIN_PRESENT_VISIBILITY || knee < MIN_PRESENT_VISIBILITY;

  const bodyVisibility = bodyVisibilityFromAverage(avgConfidence);
  let trackingConfidence = trackingSignalToConfidence(input.trackingSignal);
  if ((input.poseLossEventCount ?? 0) > 2) {
    trackingConfidence = trackingConfidence === "high" ? "medium" : "low";
  }
  if (noTimelineSnapshots && trackingConfidence === "high") {
    trackingConfidence = "medium";
  }

  const hasFramingFlag = flags.some((f) =>
    [
      "unclear_visibility",
      CAPTURE_POSE_INTERRUPTED_FLAG,
      "limited_observed_phases",
      CAPTURE_SETUP_LIMITED_FLAG,
      CAPTURE_NO_TIMELINE_FLAG,
    ].includes(f),
  );
  const cameraPosition: CameraPositionStatus =
    input.trackingSignal === "lost" || hasFramingFlag || setupLimited
      ? "needs_adjustment"
      : avgConfidence >= HIGH_CONFIDENCE
        ? "acceptable"
        : "unknown";

  let qualityLevel = qualityLevelFromSignals({
    avgConfidence,
    essentialMissing,
    lowerLimbMissing,
    trackingConfidence,
    bodyVisibility,
  });

  if (setupLimited && qualityLevel === "high") {
    qualityLevel = "medium";
  }
  if (noTimelineSnapshots && qualityLevel === "high") {
    qualityLevel = "medium";
  }

  const retestRecommended =
    qualityLevel === "low" ||
    essentialMissing ||
    setupLimited ||
    noTimelineSnapshots;

  return {
    qualityLevel,
    bodyVisibility,
    trackingConfidence,
    cameraPosition,
    retestRecommended,
    warnings: buildWarnings({
      qualityLevel,
      bodyVisibility,
      trackingConfidence,
      cameraPosition,
      lowerLimbMissing,
      essentialMissing,
      setupLimited,
      trackingInterrupted,
      noTimelineSnapshots,
    }),
  };
}

/** Returns forbidden clinical terms found in warning strings (for tests). */
export function findForbiddenTermsInCaptureWarnings(warnings: readonly string[]): string[] {
  const found = new Set<string>();
  for (const warning of warnings) {
    const lower = warning.toLowerCase();
    for (const term of FORBIDDEN_CAPTURE_WARNING_TERMS) {
      if (lower.includes(term)) found.add(term);
    }
  }
  return [...found];
}

/** Build a landmarks fixture with uniform visibility on key indices. */
export function buildCaptureQualityLandmarkFixture(visibility: number): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  for (const idx of [
    ...PATIENT_POSE_SHOULDER_INDICES,
    ...PATIENT_POSE_HIP_INDICES,
    ...PATIENT_POSE_KNEE_INDICES,
    ...PATIENT_POSE_ANKLE_INDICES,
  ]) {
    landmarks[idx] = { x: 0.5, y: 0.5, visibility };
  }
  return landmarks;
}

const QUALITY_LEVELS = new Set<CaptureQualityLevel>(["high", "medium", "low"]);
const BODY_VISIBILITY_LEVELS = new Set<BodyVisibilityLevel>(["good", "fair", "poor"]);
const TRACKING_CONFIDENCE_LEVELS = new Set<TrackingConfidenceLevel>(["high", "medium", "low"]);
const CAMERA_POSITION_STATUSES = new Set<CameraPositionStatus>([
  "acceptable",
  "needs_adjustment",
  "unknown",
]);

/** Parse persisted captureQuality from motion_quality.smtPilot (null when absent/invalid). */
export function parseCaptureQuality(value: unknown): CaptureQualityResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const qualityLevel = record.qualityLevel;
  const bodyVisibility = record.bodyVisibility;
  const trackingConfidence = record.trackingConfidence;
  const cameraPosition = record.cameraPosition;

  if (
    typeof qualityLevel !== "string" ||
    !QUALITY_LEVELS.has(qualityLevel as CaptureQualityLevel) ||
    typeof bodyVisibility !== "string" ||
    !BODY_VISIBILITY_LEVELS.has(bodyVisibility as BodyVisibilityLevel) ||
    typeof trackingConfidence !== "string" ||
    !TRACKING_CONFIDENCE_LEVELS.has(trackingConfidence as TrackingConfidenceLevel) ||
    typeof cameraPosition !== "string" ||
    !CAMERA_POSITION_STATUSES.has(cameraPosition as CameraPositionStatus) ||
    typeof record.retestRecommended !== "boolean"
  ) {
    return null;
  }

  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return {
    qualityLevel: qualityLevel as CaptureQualityLevel,
    bodyVisibility: bodyVisibility as BodyVisibilityLevel,
    trackingConfidence: trackingConfidence as TrackingConfidenceLevel,
    cameraPosition: cameraPosition as CameraPositionStatus,
    retestRecommended: record.retestRecommended,
    warnings,
  };
}
