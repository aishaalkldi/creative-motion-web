/**
 * Motion Analysis Report — deterministic session-specific clinical interpretation.
 * Converts existing motion evidence into cautious clinician review prompts only.
 * No diagnosis, scoring, treatment advice, or muscle weakness claims.
 */

import { isHoldClassCvExercise } from "@/app/lib/cv/cv-metrics-display";
import type { ExerciseKinesiologyContext } from "@/app/lib/cv/exercise-kinesiology-context";
import type {
  MotionAnalysisPhaseRatios,
  MotionAnalysisRepTimings,
  MotionAnalysisSmtPilotSummary,
  MotionAnalysisSummaryLabel,
  MotionAnalysisVisibilityRatios,
} from "@/app/lib/cv/motion-analysis-report";

const EXERCISE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "sit-to-stand": "Sit-to-Stand",
  "mini-squat": "Mini Squat",
  "single-leg-stance": "Single Leg Stance",
  "heel-raise": "Heel Raise",
  "functional-reach": "Functional Reach",
  "lateral-step": "Lateral Step",
  "step-up": "Step Up",
};

const STS_PHASE_LABELS: Readonly<Record<string, string>> = {
  seated: "Seated",
  rising: "Rising",
  standing: "Standing",
  returning: "Returning",
  rest: "Rest / transition",
  unknown: "Unknown",
};

const UNKNOWN_PHASE_HIGH_PCT = 25;
const REST_PHASE_HIGH_PCT = 40;
const RETURNING_PHASE_LOW_PCT = 15;
const RISING_PHASE_LOW_PCT = 15;
const VISIBILITY_LOW_PCT = 50;
const REP_TIMING_SPREAD_MIN_S = 1;

export type MotionAnalysisSessionSummary = {
  exerciseLabel: string;
  exerciseId: string | null;
  sessionDurationSeconds: number;
  metricSummary: string | null;
  trackingSignal: string | null;
  summaryLabel: MotionAnalysisSummaryLabel;
  captureNote: string | null;
};

export type MotionAnalysisPhaseInterpretation = {
  phaseId: string;
  phaseLabel: string;
  snapshotPct: number;
};

export type MotionAnalysisClinicalObservation = {
  id: string;
  text: string;
};

export type MotionAnalysisReviewNextItem = {
  priority: number;
  text: string;
  category: MotionAnalysisReviewCategory;
};

export type MotionAnalysisConfidenceLevel = "high" | "moderate" | "low" | "limited";

export type MotionAnalysisReportMode = "full" | "legacy" | "minimal";

export type MotionAnalysisReportHeader = {
  exerciseLabel: string;
  recordedAtLabel: string | null;
  metricLabel: string | null;
  trackingSignal: string | null;
  trackingLabel: string;
  confidenceLevel: MotionAnalysisConfidenceLevel;
  confidenceLabel: string;
  reviewRequired: boolean;
  summaryLabel: MotionAnalysisSummaryLabel;
};

export type MotionAnalysisClinicalSnapshot = {
  movementCaptured: string;
  phasesDetected: string | null;
  interpretationSupport: "supported" | "moderate" | "limited";
  interpretationSupportNote: string;
  keyObservations: string[];
};

export type MotionAnalysisKinesiologyInsight = {
  primaryMuscles: string[];
  movementPhases: Array<{ id: string; label: string; description: string }>;
  movementStrategy: string[];
  functionalRelevance: string;
};

export type MotionAnalysisReviewCategory =
  | "capture_quality"
  | "movement_pattern"
  | "functional_relevance";

export type MotionAnalysisReviewNextGroup = {
  category: MotionAnalysisReviewCategory;
  categoryLabel: string;
  items: string[];
};

export type MotionAnalysisConfidenceLimitations = {
  bullets: string[];
};

export type MotionAnalysisInterpretation = {
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
};

export type BuildMotionAnalysisInterpretationInput = {
  exerciseId: string | null;
  recordedAt: string | null;
  summaryLabel: MotionAnalysisSummaryLabel;
  sessionDurationSeconds: number;
  completedReps: number;
  movementDetected: boolean;
  trackingSignal: string | null;
  smtPilot: MotionAnalysisSmtPilotSummary | null;
  kinesiologyContext: ExerciseKinesiologyContext | null;
};

const CONFIDENCE_LABELS: Record<MotionAnalysisConfidenceLevel, string> = {
  high: "High assistive confidence",
  moderate: "Moderate assistive confidence",
  low: "Low assistive confidence",
  limited: "Limited assistive confidence",
};

const REVIEW_CATEGORY_LABELS: Record<MotionAnalysisReviewCategory, string> = {
  capture_quality: "Capture quality",
  movement_pattern: "Movement pattern",
  functional_relevance: "Functional relevance",
};

const MAX_REVIEW_ITEMS = 5;
const MAX_KEY_OBSERVATIONS = 2;

function exerciseDisplayLabel(exerciseId: string | null): string | null {
  if (!exerciseId) return null;
  return EXERCISE_DISPLAY_NAMES[exerciseId] ?? formatExerciseId(exerciseId);
}

function formatExerciseId(exerciseId: string): string {
  return exerciseId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function phaseLabel(phaseId: string, kinesiology: ExerciseKinesiologyContext | null): string {
  const fromKinesiology = kinesiology?.movementPhases.find((phase) => phase.id === phaseId);
  if (fromKinesiology) return fromKinesiology.label;
  return STS_PHASE_LABELS[phaseId] ?? formatExerciseId(phaseId);
}

function buildMetricSummary(input: BuildMotionAnalysisInterpretationInput): string | null {
  const holdClass = isHoldClassCvExercise(input.exerciseId);
  if (holdClass && input.sessionDurationSeconds > 0) {
    return `${input.sessionDurationSeconds}s assistive hold duration`;
  }
  if (input.smtPilot) {
    const parts: string[] = [];
    if (input.smtPilot.completeReps > 0) {
      parts.push(`${input.smtPilot.completeReps} complete cycle(s)`);
    }
    if (input.smtPilot.unclearReps > 0) {
      parts.push(`${input.smtPilot.unclearReps} unclear cycle(s)`);
    }
    if (parts.length > 0) return parts.join(" · ");
  }
  if (input.completedReps > 0) {
    return `${input.completedReps} assistive rep count`;
  }
  if (input.sessionDurationSeconds > 0) {
    return `${input.sessionDurationSeconds}s session duration`;
  }
  return null;
}

function buildCaptureNote(
  trackingSignal: string | null,
  summaryLabel: MotionAnalysisSummaryLabel,
  movementDetected: boolean,
): string | null {
  if (summaryLabel === "Limited visibility") {
    return "Capture may limit interpretation — camera visibility was reduced during this session.";
  }
  if (trackingSignal === "poor" || trackingSignal === "lost") {
    return "Capture may limit interpretation — tracking signal was weak for parts of the session.";
  }
  if (trackingSignal === "mixed") {
    return "Tracking signal varied during capture — assistive metrics should be reviewed in context.";
  }
  if (summaryLabel === "Review suggested" && !movementDetected) {
    return "Movement was not detected automatically — clinician may review whether capture conditions were adequate.";
  }
  return null;
}

export function buildSessionSummary(
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisSessionSummary | null {
  const exerciseLabel = exerciseDisplayLabel(input.exerciseId);
  if (!exerciseLabel && input.sessionDurationSeconds <= 0 && !input.movementDetected) {
    return null;
  }

  const effectiveTracking = input.smtPilot?.trackingSignal ?? input.trackingSignal;

  return {
    exerciseLabel: exerciseLabel ?? "Recorded exercise",
    exerciseId: input.exerciseId,
    sessionDurationSeconds: input.sessionDurationSeconds,
    metricSummary: buildMetricSummary(input),
    trackingSignal: effectiveTracking,
    summaryLabel: input.summaryLabel,
    captureNote: buildCaptureNote(
      effectiveTracking,
      input.summaryLabel,
      input.movementDetected,
    ),
  };
}

export function buildPhaseInterpretation(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  kinesiologyContext: ExerciseKinesiologyContext | null,
): MotionAnalysisPhaseInterpretation[] | null {
  if (!phaseRatios) return null;

  const entries = Object.entries(phaseRatios)
    .filter(([, pct]) => typeof pct === "number" && pct > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  return entries.map(([phaseId, snapshotPct]) => ({
    phaseId,
    phaseLabel: phaseLabel(phaseId, kinesiologyContext),
    snapshotPct,
  }));
}

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function observationsFromPhaseRatios(
  phaseRatios: MotionAnalysisPhaseRatios | null | undefined,
  exerciseId: string | null,
): MotionAnalysisClinicalObservation[] {
  if (!phaseRatios) return [];

  const observations: MotionAnalysisClinicalObservation[] = [];
  const unknownPct = phaseRatios.unknown ?? 0;
  const restPct = phaseRatios.rest ?? 0;
  const returningPct = phaseRatios.returning ?? 0;
  const risingPct = phaseRatios.rising ?? 0;
  const standingPct = phaseRatios.standing ?? 0;

  if (unknownPct >= UNKNOWN_PHASE_HIGH_PCT) {
    observations.push({
      id: "high_unknown_phase",
      text: "Camera-derived evidence suggests phase classification may be limited by capture quality.",
    });
  }

  if (restPct >= REST_PHASE_HIGH_PCT) {
    observations.push({
      id: "high_rest_phase",
      text: "Extended rest or transition time was captured — pacing between cycles is a pattern worth reviewing.",
    });
  }

  if (exerciseId === "sit-to-stand" && returningPct > 0 && returningPct < RETURNING_PHASE_LOW_PCT) {
    observations.push({
      id: "sts_low_returning",
      text: "Camera-derived evidence suggests the descent phase may be under-represented in capture; clinician may review lowering control visually.",
    });
  }

  if (
    exerciseId === "sit-to-stand" &&
    risingPct > 0 &&
    risingPct < RISING_PHASE_LOW_PCT &&
    standingPct > 40
  ) {
    observations.push({
      id: "sts_brief_rising",
      text: "A brief rising phase relative to standing was captured — clinician may review rise initiation and trunk strategy.",
    });
  }

  return observations;
}

function observationsFromRepTimings(
  repTimings: MotionAnalysisRepTimings | null | undefined,
): MotionAnalysisClinicalObservation[] {
  if (!repTimings) return [];

  const { fastestS, slowestS, avgS } = repTimings;
  if (fastestS === null || slowestS === null) return [];

  const spread = slowestS - fastestS;
  const spreadThreshold =
    avgS !== null && avgS > 0
      ? Math.max(REP_TIMING_SPREAD_MIN_S, avgS * 0.5)
      : REP_TIMING_SPREAD_MIN_S;

  if (spread >= spreadThreshold) {
    return [
      {
        id: "wide_rep_timing_spread",
        text: "Rep duration spread across cycles is a pattern worth reviewing — pacing consistency cannot be confirmed from camera data alone.",
      },
    ];
  }

  return [];
}

function observationsFromVisibility(
  visibility: MotionAnalysisVisibilityRatios | null | undefined,
): MotionAnalysisClinicalObservation[] {
  if (!visibility) return [];

  const observations: MotionAnalysisClinicalObservation[] = [];
  const joints: Array<{ key: keyof MotionAnalysisVisibilityRatios; label: string }> = [
    { key: "hip", label: "hip" },
    { key: "knee", label: "knee" },
    { key: "ankle", label: "ankle" },
  ];

  const lowJoints = joints.filter((joint) => visibility[joint.key] < VISIBILITY_LOW_PCT);
  if (lowJoints.length === joints.length) {
    observations.push({
      id: "visibility_all_low",
      text: "Camera-derived evidence suggests joint interpretation may be limited by landmark visibility across hip, knee, and ankle.",
    });
    return observations;
  }

  for (const joint of lowJoints) {
    observations.push({
      id: `visibility_low_${joint.key}`,
      text: `Camera-derived evidence suggests ${joint.label} landmark visibility was reduced — interpretation at that joint cannot be confirmed from camera data alone.`,
    });
  }

  return observations;
}

function observationsFromFlags(
  flags: string[] | null | undefined,
  unclearReps: number,
): MotionAnalysisClinicalObservation[] {
  const observations: MotionAnalysisClinicalObservation[] = [];

  if (hasFlag(flags, "unclear_reps_recorded") || unclearReps > 0) {
    observations.push({
      id: "unclear_reps",
      text: "Some cycles may require manual review — unclear rep boundaries were noted in camera-derived capture.",
    });
  }

  if (hasFlag(flags, "pose_tracking_interrupted")) {
    observations.push({
      id: "pose_interrupted",
      text: "Camera-derived evidence suggests pose tracking was interrupted — phase continuity may be incomplete.",
    });
  }

  if (hasFlag(flags, "incomplete_cycle")) {
    observations.push({
      id: "incomplete_cycle",
      text: "One or more cycles may be incomplete in capture — full movement pattern cannot be confirmed from camera data alone.",
    });
  }

  return observations;
}

function observationsFromTrackingSignal(
  trackingSignal: string | null | undefined,
): MotionAnalysisClinicalObservation[] {
  if (trackingSignal === "poor" || trackingSignal === "lost") {
    return [
      {
        id: "weak_tracking_signal",
        text: "Capture may limit interpretation — camera-derived assistive tracking signal was weak for parts of the session.",
      },
    ];
  }
  return [];
}

function dedupeObservations(
  observations: MotionAnalysisClinicalObservation[],
): MotionAnalysisClinicalObservation[] {
  const seen = new Set<string>();
  const result: MotionAnalysisClinicalObservation[] = [];
  for (const item of observations) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function buildClinicalObservations(
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisClinicalObservation[] | null {
  const smtPilot = input.smtPilot;
  const trackingSignal = smtPilot?.trackingSignal ?? input.trackingSignal;

  const observations = dedupeObservations([
    ...observationsFromPhaseRatios(smtPilot?.phaseRatios, input.exerciseId),
    ...observationsFromRepTimings(smtPilot?.repTimings),
    ...observationsFromVisibility(smtPilot?.visibilityRatios),
    ...observationsFromFlags(smtPilot?.clinicianFlags, smtPilot?.unclearReps ?? 0),
    ...observationsFromTrackingSignal(trackingSignal),
  ]);

  return observations.length > 0 ? observations : null;
}

const REVIEW_ITEM_MAP: Record<
  string,
  { text: string; category: MotionAnalysisReviewCategory; priority: number }
> = {
  high_unknown_phase: {
    text: "Re-check camera framing and lighting — phase labels may be unreliable for this session.",
    category: "capture_quality",
    priority: 1,
  },
  unclear_reps: {
    text: "Manually review unclear cycles to confirm whether boundaries reflect true movement or capture gaps.",
    category: "movement_pattern",
    priority: 2,
  },
  wide_rep_timing_spread: {
    text: "Clinician may review pacing consistency across reps during the clinical encounter.",
    category: "movement_pattern",
    priority: 3,
  },
  visibility_all_low: {
    text: "Consider re-capturing with lower-body framing if joint-level review is needed.",
    category: "capture_quality",
    priority: 1,
  },
  visibility_low_hip: {
    text: "Hip-level detail may need in-person observation — capture visibility was limited.",
    category: "capture_quality",
    priority: 2,
  },
  visibility_low_knee: {
    text: "Knee alignment may need in-person observation — capture visibility was limited.",
    category: "capture_quality",
    priority: 2,
  },
  visibility_low_ankle: {
    text: "Ankle and foot placement may need in-person observation — capture visibility was limited.",
    category: "capture_quality",
    priority: 2,
  },
  sts_low_returning: {
    text: "Clinician may review sit-to-stand lowering control directly — descent was under-represented in capture.",
    category: "movement_pattern",
    priority: 4,
  },
  sts_brief_rising: {
    text: "Clinician may review trunk lean and rise initiation strategy during ascent.",
    category: "movement_pattern",
    priority: 5,
  },
  pose_interrupted: {
    text: "Note where tracking dropped out and whether key phases were missed.",
    category: "capture_quality",
    priority: 3,
  },
  incomplete_cycle: {
    text: "Confirm whether incomplete cycles reflect early termination or capture interruption.",
    category: "movement_pattern",
    priority: 6,
  },
  weak_tracking_signal: {
    text: "Treat assistive metrics as supplementary — verify key observations in person.",
    category: "capture_quality",
    priority: 4,
  },
  high_rest_phase: {
    text: "Clinician may review rest intervals and whether pacing matched the prescribed session structure.",
    category: "movement_pattern",
    priority: 7,
  },
};

function reviewFromObservations(
  observations: MotionAnalysisClinicalObservation[] | null,
): MotionAnalysisReviewNextItem[] {
  if (!observations) return [];

  return observations
    .filter((obs) => REVIEW_ITEM_MAP[obs.id])
    .map((obs) => {
      const mapped = REVIEW_ITEM_MAP[obs.id]!;
      return {
        priority: mapped.priority,
        text: mapped.text,
        category: mapped.category,
      };
    });
}

function reviewFromKinesiology(
  kinesiology: ExerciseKinesiologyContext | null,
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisReviewNextItem[] {
  if (!kinesiology || kinesiology.clinicianObservationGuide.length === 0) return [];

  const items: MotionAnalysisReviewNextItem[] = [];
  const smtPilot = input.smtPilot;

  if (smtPilot && (smtPilot.unclearReps > 0 || hasFlag(smtPilot.clinicianFlags, "unclear_reps_recorded"))) {
    const guideItem = kinesiology.clinicianObservationGuide.find((item) =>
      item.toLowerCase().includes("unclear"),
    );
    if (guideItem) {
      items.push({ priority: 100, text: guideItem, category: "movement_pattern" });
    }
  }

  const visibility = smtPilot?.visibilityRatios;
  if (
    visibility &&
    (visibility.hip < VISIBILITY_LOW_PCT ||
      visibility.knee < VISIBILITY_LOW_PCT ||
      visibility.ankle < VISIBILITY_LOW_PCT)
  ) {
    const guideItem = kinesiology.clinicianObservationGuide.find(
      (item) =>
        item.toLowerCase().includes("visibility") ||
        item.toLowerCase().includes("framing"),
    );
    if (guideItem) {
      items.push({ priority: 101, text: guideItem, category: "capture_quality" });
    }
  }

  const primaryGuide = kinesiology.clinicianObservationGuide[0];
  if (primaryGuide) {
    items.push({ priority: 200, text: primaryGuide, category: "functional_relevance" });
  }

  return items;
}

function dedupeReviewItems(
  items: MotionAnalysisReviewNextItem[],
): MotionAnalysisReviewNextItem[] {
  const seen = new Set<string>();
  const result: MotionAnalysisReviewNextItem[] = [];
  for (const item of items.sort((a, b) => a.priority - b.priority)) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    result.push({
      priority: result.length + 1,
      text: item.text,
      category: item.category,
    });
  }
  return result;
}

export function buildReviewNext(
  input: BuildMotionAnalysisInterpretationInput,
  clinicalObservations: MotionAnalysisClinicalObservation[] | null,
): MotionAnalysisReviewNextItem[] | null {
  const items = dedupeReviewItems([
    ...reviewFromObservations(clinicalObservations),
    ...reviewFromKinesiology(input.kinesiologyContext, input),
  ]);

  if (input.summaryLabel === "Review suggested") {
    items.unshift({
      priority: 0,
      text: "Confirm whether recorded duration reflects an attempted exercise session and whether capture conditions were adequate.",
      category: "capture_quality",
    });
  }

  const normalized = dedupeReviewItems(items).slice(0, MAX_REVIEW_ITEMS);
  return normalized.length > 0 ? normalized : null;
}

function formatRecordedAtLabel(recordedAt: string | null): string | null {
  if (!recordedAt) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(recordedAt));
  } catch {
    return recordedAt;
  }
}

function formatTrackingLabel(signal: string | null): string {
  if (!signal) return "Not recorded";
  const normalized = signal.trim().toLowerCase();
  if (normalized === "good") return "Good tracking signal";
  if (normalized === "fair") return "Fair tracking signal";
  if (normalized === "mixed") return "Mixed tracking signal";
  if (normalized === "poor") return "Limited tracking signal";
  if (normalized === "lost") return "Lost tracking signal";
  if (normalized === "unknown") return "Unknown tracking signal";
  return signal.charAt(0).toUpperCase() + signal.slice(1);
}

function hasEnrichedSmtPilot(smtPilot: MotionAnalysisSmtPilotSummary | null): boolean {
  if (!smtPilot) return false;
  return (
    smtPilot.phaseRatios != null ||
    smtPilot.repTimings != null ||
    smtPilot.visibilityRatios != null ||
    smtPilot.clinicianFlags != null
  );
}

export function resolveReportMode(
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisReportMode {
  if (!input.exerciseId && input.sessionDurationSeconds <= 0 && !input.movementDetected) {
    return "minimal";
  }
  if (input.smtPilot && !hasEnrichedSmtPilot(input.smtPilot)) {
    return "legacy";
  }
  if (!input.smtPilot && !input.kinesiologyContext) {
    return "legacy";
  }
  return "full";
}

export function resolveConfidenceLevel(
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisConfidenceLevel {
  const tracking = input.smtPilot?.trackingSignal ?? input.trackingSignal;
  const visibility = input.smtPilot?.visibilityRatios;
  const unknownPct = input.smtPilot?.phaseRatios?.unknown ?? 0;

  if (
    input.summaryLabel === "Limited visibility" ||
    tracking === "poor" ||
    tracking === "lost" ||
    unknownPct >= UNKNOWN_PHASE_HIGH_PCT
  ) {
    return "limited";
  }

  if (visibility) {
    const lows = [visibility.hip, visibility.knee, visibility.ankle].filter(
      (pct) => pct < VISIBILITY_LOW_PCT,
    ).length;
    if (lows >= 2) return "low";
  }

  if (tracking === "fair" || tracking === "mixed" || tracking === "unknown") {
    return "moderate";
  }

  if (
    input.smtPilot?.unclearReps ||
    hasFlag(input.smtPilot?.clinicianFlags, "pose_tracking_interrupted")
  ) {
    return "moderate";
  }

  return "high";
}

function reviewRequired(input: BuildMotionAnalysisInterpretationInput): boolean {
  return (
    input.summaryLabel === "Review suggested" ||
    input.summaryLabel === "Limited visibility" ||
    input.smtPilot?.showReviewBanner === true ||
    (input.smtPilot?.unclearReps ?? 0) > 0
  );
}

export function buildReportHeader(
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisReportHeader | null {
  const exerciseLabel = exerciseDisplayLabel(input.exerciseId);
  if (!exerciseLabel && input.sessionDurationSeconds <= 0 && !input.movementDetected) {
    return null;
  }

  const trackingSignal = input.smtPilot?.trackingSignal ?? input.trackingSignal;
  const confidenceLevel = resolveConfidenceLevel(input);

  return {
    exerciseLabel: exerciseLabel ?? "Recorded exercise",
    recordedAtLabel: formatRecordedAtLabel(input.recordedAt),
    metricLabel: buildMetricSummary(input),
    trackingSignal,
    trackingLabel: formatTrackingLabel(trackingSignal),
    confidenceLevel,
    confidenceLabel: CONFIDENCE_LABELS[confidenceLevel],
    reviewRequired: reviewRequired(input),
    summaryLabel: input.summaryLabel,
  };
}

function interpretationSupportLevel(
  confidence: MotionAnalysisConfidenceLevel,
): MotionAnalysisClinicalSnapshot["interpretationSupport"] {
  if (confidence === "high" || confidence === "moderate") return "supported";
  if (confidence === "low") return "moderate";
  return "limited";
}

function interpretationSupportNote(
  level: MotionAnalysisClinicalSnapshot["interpretationSupport"],
): string {
  if (level === "supported") {
    return "Capture quality appears adequate for assistive phase and timing review, with clinician verification.";
  }
  if (level === "moderate") {
    return "Capture quality partially supports interpretation — clinician may review key observations in person.";
  }
  return "Capture may limit interpretation — camera-derived metrics should be treated as supplementary only.";
}

function phasesDetectedSummary(
  phaseInterpretation: MotionAnalysisPhaseInterpretation[] | null,
): string | null {
  if (!phaseInterpretation || phaseInterpretation.length === 0) return null;
  return phaseInterpretation
    .slice(0, 4)
    .map((phase) => `${phase.phaseLabel} (${phase.snapshotPct}%)`)
    .join(" · ");
}

export function buildClinicalSnapshot(
  input: BuildMotionAnalysisInterpretationInput,
  phaseInterpretation: MotionAnalysisPhaseInterpretation[] | null,
  clinicalObservations: MotionAnalysisClinicalObservation[] | null,
): MotionAnalysisClinicalSnapshot | null {
  const header = buildReportHeader(input);
  if (!header) return null;

  const confidence = resolveConfidenceLevel(input);
  const support = interpretationSupportLevel(confidence);
  const metricPart = header.metricLabel ? ` — ${header.metricLabel}` : "";
  const durationPart =
    input.sessionDurationSeconds > 0 ? ` over ${input.sessionDurationSeconds}s assistive capture` : "";

  return {
    movementCaptured: `${header.exerciseLabel}${metricPart}${durationPart}.`,
    phasesDetected: phasesDetectedSummary(phaseInterpretation),
    interpretationSupport: support,
    interpretationSupportNote: interpretationSupportNote(support),
    keyObservations: (clinicalObservations ?? [])
      .slice(0, MAX_KEY_OBSERVATIONS)
      .map((obs) => obs.text),
  };
}

export function buildKinesiologyInsight(
  kinesiology: ExerciseKinesiologyContext | null,
): MotionAnalysisKinesiologyInsight | null {
  if (!kinesiology) return null;
  return {
    primaryMuscles: [...kinesiology.primaryMuscles],
    movementPhases: kinesiology.movementPhases.map((phase) => ({
      id: phase.id,
      label: phase.label,
      description: phase.description,
    })),
    movementStrategy: [...kinesiology.expectedPatterns],
    functionalRelevance: kinesiology.functionalTransfer,
  };
}

export function buildReviewNextGrouped(
  reviewNext: MotionAnalysisReviewNextItem[] | null,
): MotionAnalysisReviewNextGroup[] | null {
  if (!reviewNext || reviewNext.length === 0) return null;

  const grouped = new Map<MotionAnalysisReviewCategory, string[]>();
  for (const item of reviewNext) {
    const list = grouped.get(item.category) ?? [];
    if (!list.includes(item.text)) {
      list.push(item.text);
    }
    grouped.set(item.category, list);
  }

  const order: MotionAnalysisReviewCategory[] = [
    "capture_quality",
    "movement_pattern",
    "functional_relevance",
  ];

  const result: MotionAnalysisReviewNextGroup[] = [];
  for (const category of order) {
    const items = grouped.get(category);
    if (!items || items.length === 0) continue;
    result.push({
      category,
      categoryLabel: REVIEW_CATEGORY_LABELS[category],
      items,
    });
  }

  return result.length > 0 ? result : null;
}

export function buildConfidenceLimitations(): MotionAnalysisConfidenceLimitations {
  return {
    bullets: [
      "Camera-derived assistive metrics only — not a clinical score or validated assessment.",
      "No video or body coordinates are stored or displayed in this report.",
      "No diagnosis, pathology label, or treatment recommendation is provided.",
      "No automatic progression or return-to-sport decision is made.",
      "Clinician review and in-person observation remain required.",
    ],
  };
}

export function buildMotionAnalysisInterpretation(
  input: BuildMotionAnalysisInterpretationInput,
): MotionAnalysisInterpretation {
  const reportMode = resolveReportMode(input);
  const sessionSummary = buildSessionSummary(input);
  const phaseInterpretation = buildPhaseInterpretation(
    input.smtPilot?.phaseRatios,
    input.kinesiologyContext,
  );
  const clinicalObservations = buildClinicalObservations(input);
  const reviewNext = buildReviewNext(input, clinicalObservations);
  const reportHeader = buildReportHeader(input);
  const clinicalSnapshot = buildClinicalSnapshot(
    input,
    phaseInterpretation,
    clinicalObservations,
  );
  const kinesiologyInsight = buildKinesiologyInsight(input.kinesiologyContext);

  return {
    reportMode,
    reportHeader,
    clinicalSnapshot,
    sessionSummary,
    phaseInterpretation,
    clinicalObservations,
    kinesiologyInsight,
    reviewNext,
    reviewNextGrouped: buildReviewNextGrouped(reviewNext),
    confidenceLimitations: buildConfidenceLimitations(),
  };
}
