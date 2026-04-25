/**
 * patient-memory.ts
 *
 * Patient-specific longitudinal memory, delta tracking, automated risk
 * detection, and online (incremental) feature-weight personalisation.
 *
 * Architecture
 * ────────────
 * • PatientMemory is DERIVED from the session store on every call —
 *   no separate cache needed except for OnlineWeights, which are
 *   incremental and cannot be recomputed from raw sessions alone.
 *
 * • Online weights update only when the therapist saves a label.
 *   The update algorithm is a light Perceptron-style gradient:
 *   correct prediction → no change; wrong prediction → shift weights
 *   toward the features that distinguish the actual label class.
 *   Learning rate α = 0.05 to prevent catastrophic forgetting.
 *
 * Safety
 * ──────
 * Decision-support only · Not a clinical diagnosis.
 * All recommendations require human (therapist) approval.
 */

import type { SessionRecord, TherapistLabel } from "../session-store";
import {
  extractFeatures,
  wDistCustom,
  DEFAULT_WEIGHTS,
  type FeatureVector,
} from "./ml-engine";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */

/** Key performance metrics captured at a single point in time. */
export interface PerformanceSnapshot {
  sessionId:      string;
  date:           string;
  totalSteps:     number;
  symmetryPct:    number;
  movementQuality: number;  // biomechanics.movementQualityScore, or 0 if unavailable
  romScore:       number;
  fatigueIndex:   number;
  therapistLabel: TherapistLabel | undefined;
}

/** Change between two consecutive sessions. */
export interface SessionDelta {
  fromSessionId:  string;
  toSessionId:    string;
  date:           string;
  sessionIndex:   number;          // 1-based number of the "to" session
  deltaSteps:     number;
  deltaSymmetry:  number;
  deltaQuality:   number | null;
  deltaFatigue:   number | null;
  deltaROM:       number | null;
  stepsChangePct: number;
  isImprovement:  boolean;
  isConcerning:   boolean;
}

/** Automated risk flag detected from session patterns. */
export interface RiskFlag {
  id:                   string;
  type:                 "asymmetry_increase" | "fatigue_increase" | "performance_drop" | "quality_decline" | "consecutive_poor";
  severity:             "low" | "medium" | "high";
  detectedAt:           string;   // ISO date
  description:          string;
  deltaValue:           number;   // magnitude of the change
  requiresImmediateReview: boolean;
}

/** Linear regression slope + direction of key metrics. */
export interface TrendAnalysis {
  stepsSlope:        number;
  symmetrySlope:     number;
  qualitySlope:      number | null;
  fatigueSlope:      number | null;
  emaSteps:          number | null;   // exponential moving average
  emaQuality:        number | null;
  overallDirection:  "improving" | "stable" | "declining";
  consistency:       number;          // 0–100
  trendConfidence:   number;          // 0–1 (grows with session count)
}

/**
 * Per-patient personalised feature weights, updated incrementally after
 * each therapist label via a Perceptron-style online update.
 */
export interface OnlineWeights {
  patientId:          string;
  weights:            Record<keyof FeatureVector, number>;
  correctPredictions: number;
  totalPredictions:   number;
  updateCount:        number;
  lastSessionId:      string | null;
}

/** Complete patient memory object — recomputed on each dashboard load. */
export interface PatientMemory {
  patientId:     string;
  sessionCount:  number;
  baseline:      PerformanceSnapshot;
  best:          PerformanceSnapshot;
  worst:         PerformanceSnapshot;
  latest:        PerformanceSnapshot;
  trend:         TrendAnalysis;
  deltas:        SessionDelta[];
  riskFlags:     RiskFlag[];           // current active flags
  onlineWeights: OnlineWeights;
  lastUpdated:   string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Internal maths
═══════════════════════════════════════════════════════════════════════════ */

function meanOf(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Ordinary Least Squares slope on y[0..n-1] (x = 0,1,2,…).
 * Returns 0 for series shorter than 2.
 */
function slope(y: number[]): number {
  const n = y.length;
  if (n < 2) return 0;
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = y.reduce((a, b) => a + b, 0);
  const sumXY = y.reduce((acc, yi, i) => acc + i * yi, 0);
  const denom = n * sumX2 - sumX ** 2;
  return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
}

/** Exponential moving average with α = 0.3. */
function ema(values: number[], alpha = 0.3): number | null {
  if (values.length === 0) return null;
  let v = values[0];
  for (let i = 1; i < values.length; i++) v = alpha * values[i] + (1 - alpha) * v;
  return Math.round(v * 10) / 10;
}

function snapshotFromSession(s: SessionRecord): PerformanceSnapshot {
  return {
    sessionId:       s.id,
    date:            s.date,
    totalSteps:      s.totalSteps,
    symmetryPct:     s.symmetryPct,
    movementQuality: s.biomechanics?.movementQualityScore ?? 0,
    romScore:        s.biomechanics?.romScore ?? 0,
    fatigueIndex:    s.fatigueIndex ?? 0,
    therapistLabel:  s.therapistLabel,
  };
}

/** Centroid (mean) of a list of feature vectors. */
function centroid(feats: FeatureVector[]): FeatureVector {
  const keys = Object.keys(feats[0]) as Array<keyof FeatureVector>;
  // Object.fromEntries returns { [k: string]: number } — cast to FeatureVector
  // which has exactly the same shape.
  return Object.fromEntries(
    keys.map((k) => [k, meanOf(feats.map((f) => f[k]))]),
  ) as unknown as FeatureVector;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Session deltas
═══════════════════════════════════════════════════════════════════════════ */

/** Compute session-over-session change vectors for every consecutive pair. */
export function computeSessionDeltas(sessions: SessionRecord[]): SessionDelta[] {
  const deltas: SessionDelta[] = [];
  for (let i = 1; i < sessions.length; i++) {
    const prev = sessions[i - 1];
    const curr = sessions[i];

    const dSteps    = curr.totalSteps - prev.totalSteps;
    const dSym      = curr.symmetryPct - prev.symmetryPct;
    const prevQ     = prev.biomechanics?.movementQualityScore;
    const currQ     = curr.biomechanics?.movementQualityScore;
    const dQuality  = prevQ !== undefined && currQ !== undefined ? currQ - prevQ : null;
    const dFatigue  = prev.fatigueIndex !== undefined && curr.fatigueIndex !== undefined
      ? Math.round((curr.fatigueIndex - prev.fatigueIndex) * 100) / 100
      : null;
    const prevROM = prev.biomechanics?.romScore;
    const currROM = curr.biomechanics?.romScore;
    const dROM = prevROM != null && currROM != null
      ? currROM - prevROM
      : null;

    const stepsPct = prev.totalSteps > 0 ? (dSteps / prev.totalSteps) * 100 : 0;

    deltas.push({
      fromSessionId:  prev.id,
      toSessionId:    curr.id,
      date:           curr.date,
      sessionIndex:   i + 1,
      deltaSteps:     dSteps,
      deltaSymmetry:  dSym,
      deltaQuality:   dQuality,
      deltaFatigue:   dFatigue,
      deltaROM:       dROM,
      stepsChangePct: Math.round(stepsPct),
      isImprovement:  dSteps >= 0 && dSym >= -5 && (dQuality === null || dQuality >= 0),
      isConcerning:   stepsPct < -15 || dSym < -10 || (dQuality !== null && dQuality < -15),
    });
  }
  return deltas;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Risk flags
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Detect six risk patterns from session history.
 * Each flag is idempotent across calls — only the latest detection is returned.
 *
 * Patterns detected:
 *  1. Asymmetry increase  — symmetryPct trending down over last 3 sessions
 *  2. Fatigue increase    — fatigueIndex trending up
 *  3. Performance drop    — latest steps < 85% of recent best
 *  4. Quality decline     — movementQualityScore trending down
 *  5. Consecutive poor    — ≥2 poor/unsafe therapist labels in last 3 sessions
 */
export function detectRiskFlags(sessions: SessionRecord[]): RiskFlag[] {
  const n = sessions.length;
  if (n < 2) return [];

  const flags: RiskFlag[] = [];
  const recent3 = sessions.slice(-Math.min(3, n));
  const latest  = sessions[n - 1];

  /* ── 1. Asymmetry increase ── */
  if (n >= 3) {
    const syms = recent3.map((s) => s.symmetryPct);
    const sl   = slope(syms);
    if (sl < -4) {
      flags.push({
        id: "asymmetry_increase",
        type: "asymmetry_increase",
        severity: sl < -10 ? "high" : "medium",
        detectedAt: latest.date,
        description: `Symmetry declining ${syms[0]}% → ${syms[syms.length - 1]}% across last ${recent3.length} sessions (${sl.toFixed(1)}%/session).`,
        deltaValue: sl,
        requiresImmediateReview: sl < -10,
      });
    }
  }

  /* ── 2. Fatigue increase ── */
  const fatigueVals = recent3.map((s) => s.fatigueIndex ?? 0).filter((v) => v > 0);
  if (fatigueVals.length >= 2) {
    const sl = slope(fatigueVals);
    if (sl > 0.08) {
      flags.push({
        id: "fatigue_increase",
        type: "fatigue_increase",
        severity: sl > 0.20 ? "medium" : "low",
        detectedAt: latest.date,
        description: `Fatigue index rising: ${fatigueVals.map((v) => v.toFixed(2)).join(" → ")} (+${sl.toFixed(2)}/session).`,
        deltaValue: sl,
        requiresImmediateReview: sl > 0.30,
      });
    }
  }

  /* ── 3. Performance drop from recent best ── */
  const recentBest  = Math.max(...sessions.slice(-5).map((s) => s.totalSteps));
  const latestSteps = latest.totalSteps;
  if (recentBest > 10 && latestSteps < recentBest * 0.85) {
    const dropPct = Math.round(((recentBest - latestSteps) / recentBest) * 100);
    flags.push({
      id: "performance_drop",
      type: "performance_drop",
      severity: dropPct > 30 ? "high" : dropPct > 15 ? "medium" : "low",
      detectedAt: latest.date,
      description: `Step output dropped ${dropPct}% from recent best (${recentBest} → ${latestSteps} steps).`,
      deltaValue: -dropPct,
      requiresImmediateReview: dropPct > 30,
    });
  }

  /* ── 4. Quality decline ── */
  const quals = recent3
    .map((s) => s.biomechanics?.movementQualityScore)
    .filter((v): v is number => v !== undefined);
  if (quals.length >= 2) {
    const sl = slope(quals);
    if (sl < -7) {
      flags.push({
        id: "quality_decline",
        type: "quality_decline",
        severity: sl < -15 ? "high" : "medium",
        detectedAt: latest.date,
        description: `Movement quality declining: ${quals.join(" → ")} (${sl.toFixed(1)}/session).`,
        deltaValue: sl,
        requiresImmediateReview: sl < -20,
      });
    }
  }

  /* ── 5. Consecutive poor / unsafe labels ── */
  const recentLabels = recent3
    .map((s) => s.therapistLabel)
    .filter((l): l is TherapistLabel => !!l && l !== "unlabeled");
  const poorCount = recentLabels.filter((l) => l === "poor" || l === "unsafe").length;
  if (poorCount >= 2) {
    const hasUnsafe = recentLabels.some((l) => l === "unsafe");
    flags.push({
      id: "consecutive_poor",
      type: "consecutive_poor",
      severity: hasUnsafe ? "high" : "medium",
      detectedAt: latest.date,
      description: `${poorCount} out of last ${recentLabels.length} labelled sessions rated Poor or Unsafe.`,
      deltaValue: poorCount,
      requiresImmediateReview: hasUnsafe,
    });
  }

  return flags;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trend analysis
═══════════════════════════════════════════════════════════════════════════ */

function computeTrendAnalysis(sessions: SessionRecord[]): TrendAnalysis {
  const steps   = sessions.map((s) => s.totalSteps);
  const syms    = sessions.map((s) => s.symmetryPct);
  const quals   = sessions.map((s) => s.biomechanics?.movementQualityScore).filter((v): v is number => v !== undefined);
  const fatigues = sessions.map((s) => s.fatigueIndex).filter((v): v is number => v !== undefined);

  const slopeSteps  = slope(steps);
  const slopeSym    = slope(syms);
  const slopeQual   = quals.length >= 2    ? slope(quals)    : null;
  const slopeFat    = fatigues.length >= 2 ? slope(fatigues) : null;

  const emaSteps   = ema(steps);
  const emaQuality = quals.length > 0 ? ema(quals) : null;

  // Combined direction score
  const stepVote = slopeSteps >  1.5 ? 1 : slopeSteps < -1.5 ? -1 : 0;
  const qualVote = slopeQual !== null ? (slopeQual > 2 ? 1 : slopeQual < -2 ? -1 : 0) : 0;
  const combined = stepVote + qualVote;

  const overallDirection: TrendAnalysis["overallDirection"] =
    combined > 0 ? "improving" : combined < 0 ? "declining" : "stable";

  const mean = meanOf(steps);
  const sd   = mean > 0
    ? Math.sqrt(steps.reduce((acc, s) => acc + (s - mean) ** 2, 0) / steps.length)
    : 0;
  const consistency = mean > 0 ? Math.max(0, Math.round(100 - (sd / mean) * 100)) : 50;

  return {
    stepsSlope:       Math.round(slopeSteps * 10) / 10,
    symmetrySlope:    Math.round(slopeSym   * 10) / 10,
    qualitySlope:     slopeQual !== null  ? Math.round(slopeQual  * 10) / 10 : null,
    fatigueSlope:     slopeFat !== null   ? Math.round(slopeFat   * 100) / 100 : null,
    emaSteps,
    emaQuality,
    overallDirection,
    consistency,
    trendConfidence: Math.min(1, Math.round((sessions.length / 8) * 100) / 100),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main builder
═══════════════════════════════════════════════════════════════════════════ */

/** Build the full patient memory object from a chronologically sorted session list. */
export function buildPatientMemory(sessions: SessionRecord[], patientId: string): PatientMemory | null {
  if (sessions.length === 0) return null;

  // Score proxy: prefer movementQualityScore, fall back to steps
  const scoreOf = (s: SessionRecord) =>
    s.biomechanics?.movementQualityScore ?? s.totalSteps / 2;

  const bestSession  = sessions.reduce((b, s) => scoreOf(s) > scoreOf(b) ? s : b, sessions[0]);
  const worstSession = sessions.reduce((w, s) => scoreOf(s) < scoreOf(w) ? s : w, sessions[0]);

  const onlineWeights = loadOnlineWeights(patientId);

  return {
    patientId,
    sessionCount:  sessions.length,
    baseline:      snapshotFromSession(sessions[0]),
    best:          snapshotFromSession(bestSession),
    worst:         snapshotFromSession(worstSession),
    latest:        snapshotFromSession(sessions[sessions.length - 1]),
    trend:         computeTrendAnalysis(sessions),
    deltas:        computeSessionDeltas(sessions),
    riskFlags:     detectRiskFlags(sessions),
    onlineWeights,
    lastUpdated:   new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Online weights  (localStorage-backed, incremental)
═══════════════════════════════════════════════════════════════════════════ */

const OW_PREFIX = "cm_ow_v1_";

function isClient(): boolean {
  return typeof window !== "undefined";
}

/** Load persisted online weights, or return defaults if none exist yet. */
export function loadOnlineWeights(patientId: string): OnlineWeights {
  const defaults: OnlineWeights = {
    patientId,
    weights:            { ...DEFAULT_WEIGHTS } as Record<keyof FeatureVector, number>,
    correctPredictions: 0,
    totalPredictions:   0,
    updateCount:        0,
    lastSessionId:      null,
  };
  if (!isClient()) return defaults;
  try {
    const raw = localStorage.getItem(`${OW_PREFIX}${patientId}`);
    return raw ? (JSON.parse(raw) as OnlineWeights) : defaults;
  } catch {
    return defaults;
  }
}

/** Persist online weights to localStorage. */
export function saveOnlineWeights(patientId: string, ow: OnlineWeights): void {
  if (!isClient()) return;
  localStorage.setItem(`${OW_PREFIX}${patientId}`, JSON.stringify(ow));
}

/**
 * Online weight update — called after the therapist saves a label.
 *
 * Algorithm (Perceptron-style):
 *  1. Run kNN with the CURRENT personalised weights.
 *  2. If prediction == actual → increment correctPredictions, no weight change.
 *  3. If prediction != actual:
 *     • Compute centroid of actual-class sessions and predicted-class sessions.
 *     • For each feature, determine whether the current session was
 *       "on the correct side" of the class boundary.
 *     • Nudge weights toward features that discriminate the actual class.
 *     • Learning rate α = 0.05 · weights clamped to [0.1, 5.0].
 *     • Re-normalise total weight magnitude to match the original sum.
 *
 * Safety: this only modifies per-patient weights stored in localStorage.
 * It has no effect on the global DEFAULT_WEIGHTS shared across patients.
 */
export function updateOnlineWeights(
  patientId:   string,
  session:     SessionRecord,
  actualLabel: Exclude<TherapistLabel, "unlabeled">,
  allSessions: SessionRecord[],
): OnlineWeights {
  const ow       = loadOnlineWeights(patientId);
  const labelled = allSessions.filter(
    (s) => s.therapistLabel && s.therapistLabel !== "unlabeled" && s.id !== session.id,
  );

  ow.totalPredictions++;

  if (labelled.length < 3) {
    saveOnlineWeights(patientId, ow);
    return ow;
  }

  const cf = extractFeatures(session);

  /* ── Run kNN with current weights ── */
  const ranked = labelled
    .map((s) => ({
      label: s.therapistLabel as Exclude<TherapistLabel, "unlabeled">,
      dist:  wDistCustom(cf, extractFeatures(s), ow.weights),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  const votes: Record<string, number> = {};
  for (const { label, dist } of ranked) {
    const w = 1 / (dist + 1e-9);
    votes[label] = (votes[label] ?? 0) + w;
  }
  const predictedLabel = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0] as TherapistLabel;

  if (predictedLabel === actualLabel) {
    /* Correct — no weight change needed */
    ow.correctPredictions++;
    ow.lastSessionId = session.id;
    saveOnlineWeights(patientId, ow);
    return ow;
  }

  /* Wrong prediction — update weights */
  const ALPHA = 0.05;

  const actualGroup = labelled
    .filter((s) => s.therapistLabel === actualLabel)
    .map((s) => extractFeatures(s));
  const predGroup = labelled
    .filter((s) => s.therapistLabel === predictedLabel)
    .map((s) => extractFeatures(s));

  if (actualGroup.length === 0 || predGroup.length === 0) {
    saveOnlineWeights(patientId, ow);
    return ow;
  }

  const actualCent = centroid(actualGroup);
  const predCent   = centroid(predGroup);

  const keys = Object.keys(cf) as Array<keyof FeatureVector>;
  const newW = { ...ow.weights };

  for (const k of keys) {
    const discriminationPower = Math.abs(actualCent[k] - predCent[k]);
    const distToActual        = Math.abs(cf[k] - actualCent[k]);
    const distToPred          = Math.abs(cf[k] - predCent[k]);

    if (distToActual < distToPred) {
      // Feature pulls toward correct class — amplify it
      newW[k] = newW[k] * (1 + ALPHA * discriminationPower);
    } else {
      // Feature was misleading — slightly dampen
      newW[k] = newW[k] * (1 - ALPHA * 0.5 * discriminationPower);
    }
    newW[k] = Math.max(0.1, Math.min(5.0, newW[k]));
  }

  // Re-normalise total weight magnitude
  const origSum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  const newSum  = Object.values(newW).reduce((a, b) => a + b, 0);
  if (newSum > 0) {
    const scale = origSum / newSum;
    for (const k of keys) newW[k] *= scale;
  }

  ow.weights       = newW;
  ow.updateCount++;
  ow.lastSessionId = session.id;

  saveOnlineWeights(patientId, ow);
  return ow;
}
