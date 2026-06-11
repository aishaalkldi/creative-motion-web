/**
 * Camera-estimated postural alignment / line-of-gravity proxy layer.
 * Movement Analysis Engine Foundation — assistive visual proxy only.
 *
 * NOT center of mass, NOT center of pressure, NOT diagnostic measurement.
 * No raw landmark storage in reports; optional ephemeral landmark sampling at capture
 * produces derived scalars only.
 */

import type { CvEvidenceIntegrityGate } from "@/app/lib/cv/cv-evidence-integrity-gate";
import type { MovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";
import type {
  MotionAnalysisMotionPilotSummary,
  MotionAnalysisPhaseRatios,
  MotionAnalysisVisibilityRatios,
} from "@/app/lib/cv/motion-analysis-report";
import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";

export const POSTURAL_ALIGNMENT_PROXY_LABEL =
  "Camera-estimated postural alignment proxy";

export const POSTURAL_ALIGNMENT_PROXY_DISCLAIMER =
  "Estimated camera-based visual proxy only — not center of mass, not center of pressure, and not a diagnostic measurement. Assistive observation for clinician review.";

export const POSTURAL_ALIGNMENT_OBSERVATION_DISCLAIMER =
  "This is camera-assisted movement evidence only and should be reviewed by the clinician.";

export const ALIGNMENT_PROXY_EXERCISE_IDS = [
  "sit-to-stand",
  "mini-squat",
  "single-leg-stance",
  "heel-raise",
  "step-up",
  "functional-reach",
  "lateral-step",
] as const;

export type AlignmentProxyExerciseId = (typeof ALIGNMENT_PROXY_EXERCISE_IDS)[number];

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_ANKLE = 27;
const R_ANKLE = 28;

const MIN_LANDMARK_VISIBILITY = 0.45;
const MIN_REPORT_ALIGNMENT_CONFIDENCE = 45;
const REP_TIMING_SPREAD_MIN_S = 1;
const RISING_PHASE_LOW_PCT = 15;
const RETURNING_PHASE_LOW_PCT = 15;
const STANDING_PHASE_LOW_PCT = 15;

export type NormalizedPoint2D = {
  x: number;
  y: number;
};

export type TrunkLineProxy = {
  dx: number;
  dy: number;
};

/** Reusable derived alignment metrics (proxy scalars only). */
export type PosturalAlignmentProxyMetrics = {
  shoulderMidpoint: NormalizedPoint2D | null;
  hipMidpoint: NormalizedPoint2D | null;
  ankleBaseMidpoint: NormalizedPoint2D | null;
  trunkLine: TrunkLineProxy | null;
  estimatedVerticalReference: TrunkLineProxy;
  forwardAlignmentShiftProxy: number | null;
  lateralAlignmentShiftProxy: number | null;
  baseOfSupportProxy: number | null;
  posturalSwayProxy: number | null;
  alignmentConfidence: number;
};

export type PosturalAlignmentObservationId =
  | "possible_forward_shifted_trunk"
  | "possible_lateral_shift"
  | "reduced_alignment_stability"
  | "increased_postural_sway"
  | "unable_to_assess_alignment";

export type PosturalAlignmentObservation = {
  id: PosturalAlignmentObservationId;
  pattern: string;
  rationale: string;
  phaseContext: string | null;
  clinicianReviewRequired: true;
};

export type PosturalAlignmentProxyResult = {
  label: string;
  sectionNote: string;
  disclaimer: string;
  suppressed: boolean;
  suppressionReason: string | null;
  metrics: PosturalAlignmentProxyMetrics | null;
  observations: PosturalAlignmentObservation[];
};

export type PosturalAlignmentLandmarkSample = {
  shoulderMidpoint: NormalizedPoint2D | null;
  hipMidpoint: NormalizedPoint2D | null;
  ankleBaseMidpoint: NormalizedPoint2D | null;
  trunkLine: TrunkLineProxy | null;
  forwardAlignmentShiftProxy: number | null;
  lateralAlignmentShiftProxy: number | null;
  baseOfSupportProxy: number | null;
  posturalSwayProxy?: number | null;
  sampleConfidence: number;
};

export type BuildPosturalAlignmentProxyInput = {
  exerciseId?: string | null;
  evidenceIntegrity?: CvEvidenceIntegrityGate | null;
  motionPilot?: MotionAnalysisMotionPilotSummary | null;
  movementQuality?: MovementQualitySignals | null;
  /** Optional capture-time rollup from ephemeral landmark samples (derived scalars only). */
  captureRollup?: PosturalAlignmentLandmarkSample | null;
};

export function isAlignmentProxyExercise(
  exerciseId: string | null | undefined,
): exerciseId is AlignmentProxyExerciseId {
  if (!exerciseId?.trim()) return false;
  return (ALIGNMENT_PROXY_EXERCISE_IDS as readonly string[]).includes(
    exerciseId.trim().toLowerCase(),
  );
}

function vis(landmark: PoseLandmark | undefined): number {
  return landmark?.visibility ?? 0;
}

function midpointFromLandmarks(
  left: PoseLandmark | undefined,
  right: PoseLandmark | undefined,
): NormalizedPoint2D | null {
  if (vis(left) < MIN_LANDMARK_VISIBILITY || vis(right) < MIN_LANDMARK_VISIBILITY) {
    return null;
  }
  return {
    x: ((left!.x + right!.x) / 2),
    y: ((left!.y + right!.y) / 2),
  };
}

function normalizeVector(dx: number, dy: number): TrunkLineProxy | null {
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return null;
  return { dx: dx / mag, dy: dy / mag };
}

/**
 * Sample alignment proxy from ephemeral landmarks at capture time.
 * Does not persist landmarks — returns derived scalars only.
 */
export function samplePosturalAlignmentFromLandmarks(
  landmarks: readonly PoseLandmark[] | null | undefined,
): PosturalAlignmentLandmarkSample | null {
  if (!landmarks || landmarks.length < 29) return null;

  const shoulderMidpoint = midpointFromLandmarks(
    landmarks[L_SHOULDER],
    landmarks[R_SHOULDER],
  );
  const hipMidpoint = midpointFromLandmarks(landmarks[L_HIP], landmarks[R_HIP]);
  const ankleBaseMidpoint = midpointFromLandmarks(
    landmarks[L_ANKLE],
    landmarks[R_ANKLE],
  );

  const visScores = [
    vis(landmarks[L_SHOULDER]),
    vis(landmarks[R_SHOULDER]),
    vis(landmarks[L_HIP]),
    vis(landmarks[R_HIP]),
    vis(landmarks[L_ANKLE]),
    vis(landmarks[R_ANKLE]),
  ];
  const sampleConfidence = Math.round(
    (visScores.reduce((sum, v) => sum + v, 0) / visScores.length) * 100,
  );

  let trunkLine: TrunkLineProxy | null = null;
  if (shoulderMidpoint && hipMidpoint) {
    trunkLine = normalizeVector(
      shoulderMidpoint.x - hipMidpoint.x,
      shoulderMidpoint.y - hipMidpoint.y,
    );
  }

  let forwardAlignmentShiftProxy: number | null = null;
  let lateralAlignmentShiftProxy: number | null = null;
  let baseOfSupportProxy: number | null = null;

  if (shoulderMidpoint && ankleBaseMidpoint) {
    forwardAlignmentShiftProxy = Number(
      (shoulderMidpoint.x - ankleBaseMidpoint.x).toFixed(3),
    );
  }
  if (hipMidpoint && ankleBaseMidpoint) {
    lateralAlignmentShiftProxy = Number(
      (hipMidpoint.x - ankleBaseMidpoint.x).toFixed(3),
    );
  }
  if (vis(landmarks[L_ANKLE]) >= MIN_LANDMARK_VISIBILITY &&
      vis(landmarks[R_ANKLE]) >= MIN_LANDMARK_VISIBILITY) {
    baseOfSupportProxy = Number(
      Math.abs(landmarks[R_ANKLE]!.x - landmarks[L_ANKLE]!.x).toFixed(3),
    );
  }

  return {
    shoulderMidpoint,
    hipMidpoint,
    ankleBaseMidpoint,
    trunkLine,
    forwardAlignmentShiftProxy,
    lateralAlignmentShiftProxy,
    baseOfSupportProxy,
    sampleConfidence,
  };
}

/** Roll up multiple ephemeral samples into session-level proxy scalars (no landmarks stored). */
export function rollupPosturalAlignmentSamples(
  samples: readonly PosturalAlignmentLandmarkSample[],
): PosturalAlignmentLandmarkSample | null {
  if (samples.length === 0) return null;

  const valid = samples.filter((s) => s.sampleConfidence >= MIN_LANDMARK_VISIBILITY * 100);
  if (valid.length === 0) return null;

  const avg = (values: number[]): number =>
    Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3));

  const avgPoint = (
    pick: (s: PosturalAlignmentLandmarkSample) => NormalizedPoint2D | null,
  ): NormalizedPoint2D | null => {
    const pts = valid.map(pick).filter((p): p is NormalizedPoint2D => p != null);
    if (pts.length === 0) return null;
    return { x: avg(pts.map((p) => p.x)), y: avg(pts.map((p) => p.y)) };
  };

  const lateralShifts = valid
    .map((s) => s.lateralAlignmentShiftProxy)
    .filter((v): v is number => v != null);
  const forwardShifts = valid
    .map((s) => s.forwardAlignmentShiftProxy)
    .filter((v): v is number => v != null);
  const baseWidths = valid
    .map((s) => s.baseOfSupportProxy)
    .filter((v): v is number => v != null);
  const sway =
    lateralShifts.length >= 2
      ? Number(
          (Math.max(...lateralShifts) - Math.min(...lateralShifts)).toFixed(3),
        )
      : null;

  return {
    shoulderMidpoint: avgPoint((s) => s.shoulderMidpoint),
    hipMidpoint: avgPoint((s) => s.hipMidpoint),
    ankleBaseMidpoint: avgPoint((s) => s.ankleBaseMidpoint),
    trunkLine: valid[valid.length - 1]?.trunkLine ?? null,
    forwardAlignmentShiftProxy:
      forwardShifts.length > 0 ? avg(forwardShifts) : null,
    lateralAlignmentShiftProxy:
      lateralShifts.length > 0 ? avg(lateralShifts) : null,
    baseOfSupportProxy: baseWidths.length > 0 ? avg(baseWidths) : null,
    posturalSwayProxy: sway,
    sampleConfidence: Math.round(
      valid.reduce((sum, s) => sum + s.sampleConfidence, 0) / valid.length,
    ),
  };
}

function phasePct(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  phase: keyof MotionAnalysisPhaseRatios,
): number {
  const value = phaseRatios?.[phase];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function computeVisibilityConfidence(
  visibility: MotionAnalysisVisibilityRatios | null | undefined,
  snapshotCount: number,
  trackingSignal: string | null | undefined,
): number {
  if (!visibility || snapshotCount <= 0) return 0;
  const jointScores = [visibility.hip, visibility.knee, visibility.ankle];
  const avg = jointScores.reduce((sum, v) => sum + v, 0) / jointScores.length;
  let confidence = Math.round(avg);
  if (trackingSignal === "poor" || trackingSignal === "lost") {
    confidence = Math.min(confidence, 35);
  } else if (trackingSignal === "fair" || trackingSignal === "mixed") {
    confidence = Math.min(confidence, 65);
  }
  if (snapshotCount < 3) confidence = Math.min(confidence, 40);
  return Math.max(0, Math.min(100, confidence));
}

function deriveMetricsFromMotionEvidence(input: {
  exerciseId: AlignmentProxyExerciseId;
  motionPilot: MotionAnalysisMotionPilotSummary | null | undefined;
  movementQuality: MovementQualitySignals | null | undefined;
  captureRollup: PosturalAlignmentLandmarkSample | null | undefined;
}): PosturalAlignmentProxyMetrics {
  const pilot = input.motionPilot;
  const mq = input.movementQuality;
  const rollup = input.captureRollup;
  const phaseRatios = pilot?.phaseRatios ?? null;
  const visibility = pilot?.visibilityRatios ?? null;
  const snapshotCount = pilot?.snapshotCount ?? 0;
  const trackingSignal = pilot?.trackingSignal ?? null;

  let alignmentConfidence = rollup?.sampleConfidence ??
    computeVisibilityConfidence(visibility, snapshotCount, trackingSignal);

  if (rollup) {
    alignmentConfidence = Math.max(
      alignmentConfidence,
      rollup.sampleConfidence,
    );
  }

  const risingPct = phasePct(phaseRatios, "rising");
  const standingPct = phasePct(phaseRatios, "standing");
  const returningPct = phasePct(phaseRatios, "returning");
  const unknownPct = phasePct(phaseRatios, "unknown");
  const restPct = phasePct(phaseRatios, "rest");

  let forwardAlignmentShiftProxy = rollup?.forwardAlignmentShiftProxy ?? null;
  if (forwardAlignmentShiftProxy == null &&
      risingPct > 0 &&
      risingPct < RISING_PHASE_LOW_PCT &&
      standingPct > 40) {
    forwardAlignmentShiftProxy = Number(
      ((RISING_PHASE_LOW_PCT - risingPct) / RISING_PHASE_LOW_PCT * 0.35).toFixed(3),
    );
  }

  let lateralAlignmentShiftProxy = rollup?.lateralAlignmentShiftProxy ?? null;
  const timingSpread = mq?.timingRangeSec ?? 0;
  if (
    lateralAlignmentShiftProxy == null &&
    mq?.pacingConsistency === "Variable" &&
    timingSpread >= REP_TIMING_SPREAD_MIN_S
  ) {
    lateralAlignmentShiftProxy = Number(
      Math.min(0.5, timingSpread / 6).toFixed(3),
    );
  }

  let posturalSwayProxy = rollup?.posturalSwayProxy ?? null;
  if (
    posturalSwayProxy == null &&
    (input.exerciseId === "single-leg-stance" ||
      unknownPct + restPct >= 30)
  ) {
    posturalSwayProxy = Number(
      Math.min(1, (unknownPct + restPct) / 100 + (timingSpread > 0 ? timingSpread / 10 : 0)).toFixed(3),
    );
  }

  return {
    shoulderMidpoint: rollup?.shoulderMidpoint ?? null,
    hipMidpoint: rollup?.hipMidpoint ?? null,
    ankleBaseMidpoint: rollup?.ankleBaseMidpoint ?? null,
    trunkLine: rollup?.trunkLine ?? null,
    estimatedVerticalReference: { dx: 0, dy: -1 },
    forwardAlignmentShiftProxy,
    lateralAlignmentShiftProxy,
    baseOfSupportProxy: rollup?.baseOfSupportProxy ?? null,
    posturalSwayProxy,
    alignmentConfidence,
  };
}

function buildObservations(
  exerciseId: AlignmentProxyExerciseId,
  metrics: PosturalAlignmentProxyMetrics,
  movementQuality: MovementQualitySignals | null | undefined,
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
): PosturalAlignmentObservation[] {
  const observations: PosturalAlignmentObservation[] = [];
  const risingPct = phasePct(phaseRatios, "rising");
  const standingPct = phasePct(phaseRatios, "standing");
  const returningPct = phasePct(phaseRatios, "returning");

  if (
    (metrics.forwardAlignmentShiftProxy ?? 0) >= 0.12 ||
    (risingPct > 0 && risingPct < RISING_PHASE_LOW_PCT && standingPct > 40)
  ) {
    observations.push({
      id: "possible_forward_shifted_trunk",
      pattern:
        "Possible forward-shifted trunk alignment relative to estimated base of support.",
      rationale:
        metrics.forwardAlignmentShiftProxy != null
          ? `Camera-assisted postural alignment estimate suggests a possible forward shift (proxy offset ${metrics.forwardAlignmentShiftProxy}). Rising phase represented ${risingPct}% of captured snapshots.`
          : `Brief rising phase (${risingPct}%) relative to standing (${standingPct}%) may suggest forward trunk alignment during ascent — cannot be confirmed from camera data alone.`,
      phaseContext: risingPct > 0 ? "rising phase" : null,
      clinicianReviewRequired: true,
    });
  }

  if ((metrics.lateralAlignmentShiftProxy ?? 0) >= 0.08) {
    observations.push({
      id: "possible_lateral_shift",
      pattern:
        "Possible lateral shift relative to estimated base of support.",
      rationale: `Estimated lateral alignment shift proxy was ${metrics.lateralAlignmentShiftProxy} with ${movementQuality?.pacingConsistency ?? "unknown"} pacing across capture — frontal-plane alignment may require in-person review.`,
      phaseContext: null,
      clinicianReviewRequired: true,
    });
  }

  if (
    movementQuality?.phaseConsistency === "Variable" ||
    movementQuality?.phaseConsistency === "Incomplete" ||
    (returningPct > 0 && returningPct < RETURNING_PHASE_LOW_PCT)
  ) {
    observations.push({
      id: "reduced_alignment_stability",
      pattern: "Reduced alignment stability during transition.",
      rationale: `Phase consistency was ${movementQuality?.phaseConsistency ?? "unknown"} and returning phase represented ${returningPct}% of snapshots — transition alignment stability may need clinician review.`,
      phaseContext: "transition",
      clinicianReviewRequired: true,
    });
  }

  if ((metrics.posturalSwayProxy ?? 0) >= 0.15) {
    observations.push({
      id: "increased_postural_sway",
      pattern: "Increased postural sway tendency in estimated alignment proxy.",
      rationale: `Postural sway proxy variability was ${metrics.posturalSwayProxy} — assistive capture suggests sway tendency; not a balance impairment diagnosis.`,
      phaseContext:
        exerciseId === "single-leg-stance" ? "single-leg stance hold" : null,
      clinicianReviewRequired: true,
    });
  }

  return observations;
}

/**
 * Build clinician-facing postural alignment proxy layer for movement reports.
 * Suppressed (returns null) when evidence integrity or alignment confidence is insufficient.
 */
export function buildPosturalAlignmentProxy(
  input: BuildPosturalAlignmentProxyInput = {},
): PosturalAlignmentProxyResult | null {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  if (!isAlignmentProxyExercise(exerciseId)) return null;

  if (!input.evidenceIntegrity?.sufficientForBiomechanicalInterpretation) {
    return null;
  }

  const metrics = deriveMetricsFromMotionEvidence({
    exerciseId,
    motionPilot: input.motionPilot,
    movementQuality: input.movementQuality,
    captureRollup: input.captureRollup,
  });

  if (metrics.alignmentConfidence < MIN_REPORT_ALIGNMENT_CONFIDENCE) {
    return null;
  }

  const observations = buildObservations(
    exerciseId,
    metrics,
    input.movementQuality,
    input.motionPilot?.phaseRatios ?? null,
  );

  if (observations.length === 0) {
    return null;
  }

  return {
    label: POSTURAL_ALIGNMENT_PROXY_LABEL,
    sectionNote: POSTURAL_ALIGNMENT_PROXY_DISCLAIMER,
    disclaimer: POSTURAL_ALIGNMENT_OBSERVATION_DISCLAIMER,
    suppressed: false,
    suppressionReason: null,
    metrics,
    observations: observations.map((obs) => ({
      ...obs,
      rationale: `${obs.rationale} ${POSTURAL_ALIGNMENT_OBSERVATION_DISCLAIMER}`,
    })),
  };
}
