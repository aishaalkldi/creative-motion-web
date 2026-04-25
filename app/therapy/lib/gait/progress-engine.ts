/**
 * progress-engine.ts
 *
 * Clinical rehabilitation progress analytics for Creative Motion.
 * All computations are deterministic, rule-based, and explainable.
 * No LLM, no external API.
 *
 * Output is labelled "decision-support only — not a clinical diagnosis".
 */

import type { SessionRecord } from "../session-store";
import type { BiomechanicsData } from "./biomechanics";
import { calculateMovementQualityScore } from "./biomechanics";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */

export type Trend = "improving" | "stable" | "declining";

/**
 * Five-level clinical classification.
 *
 * Rules (evaluated in priority order):
 *   1. n === 1                                       → Baseline
 *   2. symmetryPct < 75 OR movementQuality < 60      → Needs Attention
 *   3. latest score > previous by > 10%              → Improving
 *   4. latest score < previous by > 10%              → Declining
 *   5. change within ±10%                            → Stable
 */
export type Classification =
  | "Baseline"
  | "Improving"
  | "Stable"
  | "Declining"
  | "Needs Attention";

/** One node in the progress flowchart. */
export interface ProgressPhase {
  label: string;
  sessionRange: string;
  avgSteps: number;
  avgScore: number;
  isCurrent: boolean;
  isTarget: boolean;
}

/** Clinical risk flag surfaced to the clinician / patient. */
export interface RiskWarning {
  id: string;
  severity: "warning" | "caution";
  title: string;
  detail: string;
}

/** Per-session data point for the progress timeline chart. */
export interface ChartPoint {
  sessionNumber: number;
  date: string;
  score: number;
  totalSteps: number;
  symmetryPct: number;
  romScore: number | null;
  movementQuality: number | null;
}

/**
 * Statistical projection based on ≥ 3 sessions of OLS trend data.
 *
 * The range [projectedLow, projectedHigh] is a ±1 prediction-SE interval
 * (~68 % coverage).  It accounts for regression noise AND extrapolation
 * distance, so small-n ranges are intentionally wide.
 * R-squared and stabilityNote disclose fit quality to the consumer.
 */
export interface Prediction {
  available: boolean;
  /** OLS point estimate (midpoint of the range). */
  projectedSteps: number;
  /** Lower bound of ±1 SE prediction interval (clamped to 0). */
  projectedLow: number;
  /** Upper bound of ±1 SE prediction interval. */
  projectedHigh: number;
  projectedScore: number;
  targetSteps: number;
  sessionsToTarget: number | null;
  /** Number of sessions the regression was fitted on. */
  sessionCount: number;
  /** Coefficient of determination (0–1). 1 = perfect linear fit. */
  rSquared: number;
  /**
   * Non-empty when the trend is too short or too noisy to be reliable.
   * Should be shown prominently in the UI.
   */
  stabilityNote: string;
  summary: string;
}

/**
 * Rule-generated session analysis (decision-support only, not a clinical diagnosis).
 * Generated deterministically from classification, trend, and biomechanics rules —
 * not from a machine-learning model or AI inference.
 */
export interface AISummary {
  overview: string;
  progressNote: string;
  strongestArea: string;
  weakestArea: string;
  nextFocus: string[];
}

/** Full aggregated progress report for one patient. */
export interface AggregatedData {
  patientId: string;
  sessionCount: number;
  firstDate: string;
  latestDate: string;
  totalReps: number;
  avgScore: number;
  avgSteps: number;
  avgSymmetry: number;
  leftTotal: number;
  rightTotal: number;
  bestSession: SessionRecord;
  latestSession: SessionRecord;
  trend: Trend;
  consistencyScore: number;
  classification: Classification;
  classificationReason: string;
  timeline: ProgressPhase[];
  riskWarnings: RiskWarning[];
  prediction: Prediction;
  chartData: ChartPoint[];
  /** Average biomechanics across sessions that include this data (may be undefined). */
  biomechanicsAvg: BiomechanicsData | undefined;
  /** Number of sessions that contributed to biomechanicsAvg (≤ sessionCount). */
  biomechanicsSessionCount: number;
  aiSummary: AISummary;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Internal maths helpers
═══════════════════════════════════════════════════════════════════════════ */

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length);
}

/** Simple Ordinary Least Squares on the y-values (x = 0, 1, 2, …). */
function linearRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = y.reduce((a, b) => a + b, 0);
  const sumXY = y.reduce((acc, yi, i) => acc + i * yi, 0);
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trend  (first-half vs second-half step output)
═══════════════════════════════════════════════════════════════════════════ */

function computeTrend(sessions: SessionRecord[]): Trend {
  if (sessions.length < 3) return "stable";
  const steps = sessions.map((s) => s.totalSteps);
  const half  = Math.max(1, Math.floor(steps.length / 2));
  const delta = (mean(steps.slice(-half)) - mean(steps.slice(0, half))) / (mean(steps.slice(0, half)) + 1);
  if (delta >  0.12) return "improving";
  if (delta < -0.12) return "declining";
  return "stable";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Consistency  (100 − coefficient-of-variation of step counts)
═══════════════════════════════════════════════════════════════════════════ */

function computeConsistency(sessions: SessionRecord[]): number {
  if (sessions.length < 2) return 100;
  const steps = sessions.map((s) => s.totalSteps);
  const m = mean(steps);
  if (m === 0) return 0;
  return Math.max(0, Math.round(100 - (stdDev(steps) / m) * 100));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Classification
═══════════════════════════════════════════════════════════════════════════ */

const CLASSIFICATION_REASONS: Record<Classification, string> = {
  Baseline:
    "First recorded session — establishing the patient's initial movement baseline.",
  Improving:
    "Score increased by more than 10% compared to the previous session.",
  Stable:
    "Score is within ±10% of the previous session — consistent performance.",
  Declining:
    "Score decreased by more than 10% compared to the previous session.",
  "Needs Attention":
    "Symmetry below 75% or movement quality below 60 — clinical review advised.",
};

function classify(
  sessions: SessionRecord[],
  avgSymmetry: number,
  latestBio: BiomechanicsData | undefined,
): Classification {
  if (sessions.length <= 1) return "Baseline";

  // Needs Attention always takes priority
  const movQuality = latestBio?.movementQualityScore;
  if (avgSymmetry < 75 || (movQuality !== undefined && movQuality < 60)) {
    return "Needs Attention";
  }

  // Score comparison: latest session vs previous session
  const latest   = sessions[sessions.length - 1].score;
  const previous = sessions[sessions.length - 2].score;
  if (previous === 0) return "Stable";
  const delta = (latest - previous) / previous;
  if (delta >  0.10) return "Improving";
  if (delta < -0.10) return "Declining";
  return "Stable";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Risk warnings
═══════════════════════════════════════════════════════════════════════════ */

function computeRiskWarnings(
  sessions: SessionRecord[],
  avgSymmetry: number,
  latestSession: SessionRecord,
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const bio = latestSession.biomechanics;

  /* Step-count symmetry imbalance (derived from step tallies, not joint angles) */
  if (avgSymmetry < 75) {
    const diff = latestSession.leftSteps > 0 && latestSession.rightSteps > 0
      ? Math.abs(latestSession.leftSteps - latestSession.rightSteps) /
        Math.max(latestSession.leftSteps, latestSession.rightSteps) * 100
      : 0;
    const weakerSide = latestSession.leftSteps < latestSession.rightSteps ? "left" : "right";
    warnings.push({
      id: "symmetry_low",
      severity: "warning",
      title: "Possible Left/Right Step Imbalance Detected",
      detail: diff > 5
        ? `The ${weakerSide} side produced ${Math.round(diff)}% fewer steps than the opposite side (avg step-count symmetry ${Math.round(avgSymmetry)}%). This may indicate compensatory movement patterns.`
        : `Average step-count symmetry is ${Math.round(avgSymmetry)}%, below the 75% reference. Encourage equal bilateral contribution.`,
    });
  }

  /* Biomechanics-based warnings — only for sessions that have the data */
  if (bio) {
    // Posture warning: only fire when postureScore is not null (≥3 samples)
    if (bio.postureScore !== null && bio.postureScore < 70) {
      warnings.push({
        id: "posture_low",
        severity: "warning",
        title: "Lateral Pelvic Displacement Elevated",
        detail: `Left and right hip landmarks showed uneven vertical positions during marching (pelvic level estimate score ${bio.postureScore}/100). This is a 2D projection proxy — not a physical displacement measurement. Focus on keeping hips level and trunk stable during knee lifts.`,
      });
    }

    if (bio.controlScore < 70) {
      warnings.push({
        id: "control_low",
        severity: "caution",
        title: "Step-Height Consistency Reduced",
        detail: `Step heights were variable across the session (step-height consistency score ${bio.controlScore}/100). Slow down and prioritise quality over quantity — aim for even, deliberate knee lifts.`,
      });
    }

    // ROM warning: only fire when romScore is not null (≥3 samples)
    if (bio.romScore !== null && bio.romScore < 60) {
      warnings.push({
        id: "rom_low",
        severity: "caution",
        title: "Knee Flexion at Peak Lift Below Target",
        detail: `Knee flexion angle at peak lift appears limited (ROM score ${bio.romScore}/100). If pain-free, encourage lifting the knee higher with each step.`,
      });
    }

    /* Bilateral knee-height asymmetry (from lift-height data) */
    const lh = bio.avgLeftKneeHeight, rh = bio.avgRightKneeHeight;
    if (lh > 0 && rh > 0) {
      const heightDiffPct = Math.abs(lh - rh) / Math.max(lh, rh) * 100;
      if (heightDiffPct > 20) {
        const weakerSide = lh < rh ? "left" : "right";
        warnings.push({
          id: "height_asymmetry",
          severity: "caution",
          title: `${weakerSide === "left" ? "Left" : "Right"} Side Knee Lift Lower`,
          detail: `${weakerSide === "left" ? "Left" : "Right"} knee lift height is ${Math.round(heightDiffPct)}% lower than the opposite side. This may indicate unilateral weakness or guarding.`,
        });
      }
    }
  }

  /* Declining trend — persistent */
  if (sessions.length >= 3) {
    const last3 = sessions.slice(-3).map((s) => s.totalSteps);
    if (last3[2] < last3[1] && last3[1] < last3[0]) {
      warnings.push({
        id: "declining_trend",
        severity: "caution",
        title: "Consecutive Declining Sessions",
        detail: "Step output has decreased across the last three sessions. Consider reviewing session load, rest intervals, or discussing fatigue and motivation with the clinical team.",
      });
    }
  }

  return warnings;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Prediction  (requires ≥ 3 sessions)
═══════════════════════════════════════════════════════════════════════════ */

const PTS_PER_STEP_EQUIV = 10; // must match page.tsx PTS_PER_STEP

/**
 * OLS residual standard error and R² for a set of y-values fitted with
 * x = 0, 1, …, n−1.  Returns RSE=0 / R²=0 when n < 3.
 */
function regressionQuality(
  y: number[],
  slope: number,
  intercept: number,
): { rse: number; rSquared: number } {
  const n = y.length;
  if (n < 3) return { rse: 0, rSquared: 0 };

  const ssRes = y.reduce((acc, yi, i) => {
    const residual = yi - (intercept + slope * i);
    return acc + residual ** 2;
  }, 0);

  const yMean = mean(y);
  const ssTot = y.reduce((acc, yi) => acc + (yi - yMean) ** 2, 0);

  const rse      = Math.sqrt(ssRes / (n - 2));
  const rSquared = ssTot < 1e-6 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { rse, rSquared };
}

/**
 * One-step-ahead prediction-interval SE for OLS with x = 0…n−1.
 * Accounts for regression-line uncertainty AND extrapolation distance.
 *
 *   se_pred = RSE · √(1 + 1/n + (x_new − x̄)² / Sxx)
 *
 * where x_new = n, x̄ = (n−1)/2, Sxx = n(n²−1)/12.
 */
function predictionSE(rse: number, n: number): number {
  if (rse <= 0 || n < 2) return 0;
  const xBar = (n - 1) / 2;
  const sxx  = (n * (n ** 2 - 1)) / 12;
  const xNew = n;
  return rse * Math.sqrt(1 + 1 / n + (xNew - xBar) ** 2 / sxx);
}

function computePrediction(sessions: SessionRecord[]): Prediction {
  const unavailable: Prediction = {
    available:       false,
    projectedSteps:  0,
    projectedLow:    0,
    projectedHigh:   0,
    projectedScore:  0,
    targetSteps:     0,
    sessionsToTarget: null,
    sessionCount:    sessions.length,
    rSquared:        0,
    stabilityNote:   "",
    summary: "At least 3 sessions are needed to generate a projection.",
  };
  if (sessions.length < 3) return unavailable;

  const steps = sessions.map((s) => s.totalSteps);
  const n     = steps.length;
  const { slope, intercept } = linearRegression(steps);

  // Point estimate
  const projectedSteps = Math.max(0, Math.round(intercept + slope * n));
  const projectedScore = projectedSteps * PTS_PER_STEP_EQUIV;

  // Uncertainty range (±1 prediction SE ≈ 68 % coverage)
  const { rse, rSquared } = regressionQuality(steps, slope, intercept);
  const sePred    = predictionSE(rse, n);
  const projectedLow  = Math.max(0, Math.round(projectedSteps - sePred));
  const projectedHigh = Math.max(0, Math.round(projectedSteps + sePred));

  // Target = current average + 15 %, minimum +5 steps
  const currentAvg  = mean(steps);
  const targetSteps = Math.min(
    120,
    Math.max(Math.round(currentAvg * 1.15), Math.round(currentAvg) + 5),
  );

  // Sessions needed to reach target (only when slope is clearly positive)
  let sessionsToTarget: number | null = null;
  if (slope > 0.5) {
    const k = (targetSteps - intercept - slope * (n - 1)) / slope;
    if (k > 0 && k <= 20) sessionsToTarget = Math.ceil(k);
  }

  // Stability note — shown when data is thin or fit is poor
  let stabilityNote = "";
  if (n < 5) {
    stabilityNote = `Early estimate — only ${n} sessions recorded. The range will narrow as more sessions are completed.`;
  } else if (rSquared < 0.35) {
    stabilityNote = `Session-to-session variability is high (R² ${rSquared.toFixed(2)}). Treat this range as approximate.`;
  }

  // Summary sentence — references the range, not a single number
  const rangeStr = projectedLow === projectedHigh
    ? `~${projectedLow} steps`
    : `${projectedLow}–${projectedHigh} steps`;

  let summary: string;
  if (slope > 0.5) {
    summary = sessionsToTarget
      ? `The trend suggests ${rangeStr} next session. At this pace, the patient may reach ${targetSteps} steps in approximately ${sessionsToTarget} session${sessionsToTarget === 1 ? "" : "s"}.`
      : `The trend suggests ${rangeStr} next session. Progress is improving — maintain the current training frequency.`;
  } else if (slope < -0.5) {
    summary = `The trend suggests ${rangeStr} next session, indicating a declining pattern. Early clinical review may help identify and address the underlying cause.`;
  } else {
    summary = `Performance is stable around ${Math.round(currentAvg)} steps per session (trend suggests ${rangeStr} next session). Adjusting session structure or progressive challenge may help sustain motivation.`;
  }

  return {
    available: true,
    projectedSteps,
    projectedLow,
    projectedHigh,
    projectedScore,
    targetSteps,
    sessionsToTarget,
    sessionCount: n,
    rSquared:     parseFloat(rSquared.toFixed(2)),
    stabilityNote,
    summary,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Progress timeline  (up to 5 phase nodes)
═══════════════════════════════════════════════════════════════════════════ */

function buildTimeline(sessions: SessionRecord[]): ProgressPhase[] {
  if (sessions.length === 0) return [];
  const phases: ProgressPhase[] = [];

  phases.push({
    label: "Baseline",
    sessionRange: "Session 1",
    avgSteps: sessions[0].totalSteps,
    avgScore: sessions[0].score,
    isCurrent: sessions.length === 1,
    isTarget: false,
  });

  if (sessions.length >= 2) {
    const slice = sessions.slice(1, Math.min(3, sessions.length));
    phases.push({
      label: "Early Phase",
      sessionRange: slice.length === 1 ? "Session 2" : `Sessions 2–${1 + slice.length}`,
      avgSteps: Math.round(mean(slice.map((s) => s.totalSteps))),
      avgScore: Math.round(mean(slice.map((s) => s.score))),
      isCurrent: sessions.length <= 3,
      isTarget: false,
    });
  }

  if (sessions.length >= 5) {
    const slice = sessions.slice(3, sessions.length - 1);
    if (slice.length > 0) {
      phases.push({
        label: "Mid Progress",
        sessionRange: `Sessions 4–${sessions.length - 1}`,
        avgSteps: Math.round(mean(slice.map((s) => s.totalSteps))),
        avgScore: Math.round(mean(slice.map((s) => s.score))),
        isCurrent: false,
        isTarget: false,
      });
    }
  }

  if (sessions.length >= 2) {
    const latest = sessions[sessions.length - 1];
    phases.push({
      label: "Current",
      sessionRange: `Session ${sessions.length}`,
      avgSteps: latest.totalSteps,
      avgScore: latest.score,
      isCurrent: true,
      isTarget: false,
    });
  }

  const latestSteps = sessions[sessions.length - 1].totalSteps;
  const targetSteps = Math.min(120, Math.max(latestSteps + 8, Math.round(latestSteps * 1.15)));
  phases.push({
    label: "Next Target",
    sessionRange: "Goal",
    avgSteps: targetSteps,
    avgScore: targetSteps * PTS_PER_STEP_EQUIV,
    isCurrent: false,
    isTarget: true,
  });

  return phases;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Chart data (one point per session)
═══════════════════════════════════════════════════════════════════════════ */

function buildChartData(sessions: SessionRecord[]): ChartPoint[] {
  return sessions.map((s, i) => ({
    sessionNumber: i + 1,
    date: s.date,
    score: s.score,
    totalSteps: s.totalSteps,
    symmetryPct: s.symmetryPct,
    romScore: s.biomechanics?.romScore ?? null,
    movementQuality: s.biomechanics?.movementQualityScore ?? null,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Average biomechanics across sessions that have this data
═══════════════════════════════════════════════════════════════════════════ */

function averageBiomechanics(sessions: SessionRecord[]): { avg: BiomechanicsData | undefined; count: number } {
  const bio = sessions.map((s) => s.biomechanics).filter((b): b is BiomechanicsData => !!b);
  if (bio.length === 0) return { avg: undefined, count: 0 };

  const avgNum = (key: keyof BiomechanicsData) =>
    Math.round(bio.reduce((sum, b) => sum + (b[key] as number), 0) / bio.length);
  const avgFloat = (key: keyof BiomechanicsData) =>
    parseFloat((bio.reduce((sum, b) => sum + (b[key] as number), 0) / bio.length).toFixed(3));

  // For nullable scores, only average sessions that have a non-null value
  const avgNullable = (key: "romScore" | "postureScore" | "symmetryScore"): number | null => {
    const vals = bio.map((b) => b[key]).filter((v): v is number => v !== null);
    return vals.length > 0
      ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
      : null;
  };

  const romScore      = avgNullable("romScore");
  const postureScore  = avgNullable("postureScore");
  const symmetryScore = avgNullable("symmetryScore");
  const controlScore  = avgNum("controlScore");

  // Recompute composite from averaged components (don't average a composite of composites)
  const movementQualityScore = calculateMovementQualityScore(
    romScore, postureScore, controlScore, symmetryScore,
  );

  // avgBodySpan: only average sessions that have valid body-span data
  const validSpans = bio.map((b) => b.avgBodySpan ?? 0).filter((s) => s > 0);
  const avgBodySpan = validSpans.length > 0
    ? parseFloat((validSpans.reduce((s, v) => s + v, 0) / validSpans.length).toFixed(3))
    : 0;

  // bodySpanConfidence and landmarkQuality: average across sessions that have the field
  const avgBodySpanConfidence = parseFloat(
    (bio.reduce((s, b) => s + (b.bodySpanConfidence ?? 0), 0) / bio.length).toFixed(2),
  );
  const avgLandmarkQuality = parseFloat(
    (bio.map((b) => b.landmarkQuality ?? 0).filter((v) => v > 0).reduce((s, v, _, arr) =>
      s + v / arr.length, 0,
    ) || 0).toFixed(2),
  );

  return {
    avg: {
      avgLeftKneeAngle:    avgNum("avgLeftKneeAngle"),
      avgRightKneeAngle:   avgNum("avgRightKneeAngle"),
      avgLeftHipAngle:     avgNum("avgLeftHipAngle"),
      avgRightHipAngle:    avgNum("avgRightHipAngle"),
      avgLeftKneeHeight:   avgFloat("avgLeftKneeHeight"),
      avgRightKneeHeight:  avgFloat("avgRightKneeHeight"),
      romScore,
      postureScore,
      controlScore,
      symmetryScore,
      movementQualityScore,
      stepCount:           avgNum("stepCount"),
      avgBodySpan,
      bodySpanConfidence:  avgBodySpanConfidence,
      landmarkQuality:     avgLandmarkQuality,
    },
    count: bio.length,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI Summary — data-driven, deterministic, biomechanics-aware
═══════════════════════════════════════════════════════════════════════════ */

function buildNextFocus(
  sessions: SessionRecord[],
  avgSteps: number,
  avgSymmetry: number,
  trend: Trend,
  avgCombo: number,
  bio: BiomechanicsData | undefined,
): string[] {
  const items: string[] = [];

  if (bio?.romScore != null && bio.romScore < 60)
    items.push("ROM is below target. Focus on controlled knee lifts — aim to bring the knee toward hip height with each step, if pain-free.");

  if (avgSymmetry < 75) {
    const lh = bio?.avgLeftKneeHeight ?? 0;
    const rh = bio?.avgRightKneeHeight ?? 0;
    const weakerSide = (lh > 0 && rh > 0 && lh < rh) ? "left" : (lh > rh ? "right" : null);
    items.push(
      weakerSide
        ? `${weakerSide === "left" ? "Left" : "Right"} side appears weaker. Practise single-leg stance and deliberate ${weakerSide}-side knee raises to restore bilateral balance.`
        : "Focus on equal left–right contribution. Practise alternating knee raises with conscious attention to both sides.",
    );
  }

  if (bio?.controlScore != null && bio.controlScore < 70)
    items.push("Step-height consistency is reduced. Slow down and prioritise quality over speed — aim for even, repeatable knee lifts before increasing pace.");

  if (trend === "declining")
    items.push("Review session load and rest periods. A brief step-down phase may help rebuild stamina before gradually increasing intensity.");

  if (avgSteps < 40)
    items.push("Target 40 steps per session as the near-term milestone. Increase pace gradually over 2–3 sessions.");
  else if (avgSteps < 70)
    items.push("Work toward 70+ steps per session. Consistent daily practice will consolidate current gains.");

  if (avgCombo < 5)
    items.push("Focus on maintaining a continuous marching rhythm — aim for 5 or more consecutive steps without stopping.");

  if (sessions.length < 5)
    items.push("Complete at least 5 sessions to enable more reliable trend analysis and classification.");

  if (avgSteps >= 80 && avgSymmetry >= 80 && (bio?.movementQualityScore ?? 0) >= 75)
    items.push("Excellent baseline established. Consider extending session duration to 90 seconds or introducing side-step variations.");

  return items.length > 0
    ? items.slice(0, 3)
    : ["Maintain current training frequency and gradually increase session intensity."];
}

function generateAISummary(
  sessions: SessionRecord[],
  avgSteps: number,
  avgSymmetry: number,
  trend: Trend,
  classification: Classification,
  bio: BiomechanicsData | undefined,
): AISummary {
  const first  = sessions[0];
  const latest = sessions[sessions.length - 1];
  const avgCombo = mean(sessions.map((s) => s.bestCombo));

  /* ── Overview — classification-driven ── */
  const overviewMap: Record<Classification, string> = {
    Baseline:
      `This is the first recorded session, establishing the patient's baseline at ${first.totalSteps} steps.`,
    Improving:
      "Performance is improving — step output is trending upward across sessions.",
    Stable:
      "Performance is consistent across sessions, indicating a steady and well-managed recovery pace.",
    Declining:
      "Recent sessions show reduced output compared to earlier sessions. Consider discussing load, fatigue, or motivation factors with the clinical team.",
    "Needs Attention":
      "Clinical metrics indicate areas requiring attention — review the risk warnings in this report before the next session.",
  };

  /* ── Progress note: first vs latest ── */
  const stepDelta = latest.totalSteps - first.totalSteps;
  const progressNote =
    sessions.length === 1
      ? `Baseline established at ${first.totalSteps} steps with a symmetry of ${first.symmetryPct}%.`
      : `Starting from ${first.totalSteps} steps in the first session, the patient reached ${latest.totalSteps} steps in the most recent session — ${
          stepDelta >= 0
            ? `a +${stepDelta}-step improvement`
            : `a ${Math.abs(stepDelta)}-step reduction`
        } over ${sessions.length} sessions.`;

  /* ── Strongest area: data-driven ── */
  let strongestArea: string;
  if (bio && bio.symmetryScore != null && bio.symmetryScore >= 85)
    strongestArea = `Bilateral symmetry is strong at ${bio.symmetryScore}/100 — both limbs are contributing evenly.`;
  else if (avgSymmetry >= 85)
    strongestArea = `Symmetry is strong at ${Math.round(avgSymmetry)}%, indicating balanced bilateral contribution.`;
  else if (bio && bio.controlScore >= 80)
    strongestArea = `Step-height consistency is strong (${bio.controlScore}/100) — repeatable lift heights indicate solid motor control.`;
  else if (bio && bio.romScore != null && bio.romScore >= 75)
    strongestArea = `Range of motion is strong (ROM score ${bio.romScore}/100) — the patient achieves good knee elevation at peak lift.`;
  else if (avgSteps >= 60)
    strongestArea = `Step output is solid at an average of ${Math.round(avgSteps)} steps per session.`;
  else
    strongestArea = `Session engagement is consistent across ${sessions.length} completed sessions, showing reliable participation.`;

  /* ── Weakest area: biomechanics-informed ── */
  let weakestArea: string;
  if (bio) {
    const lh = bio.avgLeftKneeHeight, rh = bio.avgRightKneeHeight;
    const heightDiffPct = (lh > 0 && rh > 0)
      ? Math.abs(lh - rh) / Math.max(lh, rh) * 100
      : 0;
    if (heightDiffPct > 18) {
      const ws = lh < rh ? "left" : "right";
      weakestArea = `${ws === "left" ? "Left" : "Right"} side appears weaker: ${ws} knee lift height is ${Math.round(heightDiffPct)}% lower than the opposite side.`;
    } else if (bio.romScore != null && bio.romScore < 60) {
      weakestArea = `ROM is below target (${bio.romScore}/100). Encourage higher knee lift at peak if pain-free.`;
    } else if (bio.controlScore < 70) {
      weakestArea = `Step-height consistency is reduced (${bio.controlScore}/100). Slower, more deliberate repetitions are recommended.`;
    } else if (avgSymmetry < 70) {
      weakestArea = `Symmetry is below target at ${Math.round(avgSymmetry)}% — one side may need additional therapeutic focus.`;
    } else {
      weakestArea = `Performance is broadly on track. Fine-tuning pacing and symmetry will support continued progress.`;
    }
  } else {
    // No biomechanics data — fall back to step-based assessment
    if (avgSymmetry < 65)
      weakestArea = `Bilateral symmetry is below target at ${Math.round(avgSymmetry)}% — one side may need additional focus.`;
    else if (avgSteps < 45)
      weakestArea = `Step count per session (avg ${Math.round(avgSteps)}) has meaningful room for gradual increase.`;
    else
      weakestArea = `Performance is on track. Save future sessions with biomechanics data for more specific insights.`;
  }

  return {
    overview: overviewMap[classification],
    progressNote,
    strongestArea,
    weakestArea,
    nextFocus: buildNextFocus(sessions, avgSteps, avgSymmetry, trend, avgCombo, bio),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Public export — aggregate all sessions into a clinical progress report
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aggregate a chronologically sorted list of sessions into a full
 * AggregatedData report. Returns null when the input is empty.
 *
 * Sessions MUST be sorted oldest-first — `loadPatientSessions()` guarantees this.
 */
export function aggregate(sessions: SessionRecord[]): AggregatedData | null {
  if (sessions.length === 0) return null;

  const patientId     = sessions[0].patientId;
  const totalReps     = sessions.reduce((s, r) => s + r.totalSteps, 0);
  const avgScore      = Math.round(mean(sessions.map((s) => s.score)));
  const avgSteps      = Math.round(mean(sessions.map((s) => s.totalSteps)));
  const avgSymmetry   = Math.round(mean(sessions.map((s) => s.symmetryPct)));
  const leftTotal     = sessions.reduce((s, r) => s + r.leftSteps, 0);
  const rightTotal    = sessions.reduce((s, r) => s + r.rightSteps, 0);
  const bestSession   = [...sessions].sort((a, b) => b.score - a.score)[0];
  const latestSession = sessions[sessions.length - 1];

  const trend            = computeTrend(sessions);
  const consistencyScore = computeConsistency(sessions);
  const { avg: biomechanicsAvg, count: biomechanicsSessionCount } = averageBiomechanics(sessions);
  const classification   = classify(sessions, avgSymmetry, latestSession.biomechanics);
  const timeline         = buildTimeline(sessions);
  const riskWarnings     = computeRiskWarnings(sessions, avgSymmetry, latestSession);
  const prediction       = computePrediction(sessions);
  const chartData        = buildChartData(sessions);
  const aiSummary        = generateAISummary(
    sessions, avgSteps, avgSymmetry, trend, classification, biomechanicsAvg,
  );

  return {
    patientId,
    sessionCount:  sessions.length,
    firstDate:     sessions[0].date,
    latestDate:    latestSession.date,
    totalReps,
    avgScore,
    avgSteps,
    avgSymmetry,
    leftTotal,
    rightTotal,
    bestSession,
    latestSession,
    trend,
    consistencyScore,
    classification,
    classificationReason: CLASSIFICATION_REASONS[classification],
    timeline,
    riskWarnings,
    prediction,
    chartData,
    biomechanicsAvg,
    biomechanicsSessionCount,
    aiSummary,
  };
}
