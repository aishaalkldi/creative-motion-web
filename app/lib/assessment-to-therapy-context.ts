/**
 * Maps assessment / clinical review signals to therapy deep-link context (program, phase, session type).
 * Used by Results Review → Recommended therapy URL and documentation in saved logs.
 */

import type { AssessmentSignals } from "./clinical-decision";
import {
  DEFAULT_THERAPY_PHASE,
  DEFAULT_THERAPY_PROGRAM_ID,
  DEFAULT_THERAPY_SESSION_TYPE,
} from "./therapy-sessions-store";

export type RecommendedTherapyContext = {
  programId: string;
  phase: string;
  sessionType: string;
  reason: string;
};

const SYMMETRY_01_THRESHOLD = 0.75;
const SYMMETRY_PCT_THRESHOLD = 75;
const TRUNK_SWAY_DEG_POOR_CONTROL = 4;
const OVERALL_SCORE_POOR_CONTROL = 60;

function toSymmetry01(s: AssessmentSignals): number | null {
  if (s.symmetry01 != null && Number.isFinite(s.symmetry01)) {
    return Math.max(0, Math.min(1, s.symmetry01));
  }
  if (s.symmetryPct != null && Number.isFinite(s.symmetryPct)) {
    return Math.max(0, Math.min(1, s.symmetryPct / 100));
  }
  return null;
}

function fatiguePercentFromMetrics(
  movementMetrics: Record<string, unknown> | null | undefined,
): number | null {
  if (!movementMetrics || typeof movementMetrics !== "object") return null;
  const m = movementMetrics;
  const raw =
    m.fatigue_pct ??
    m.fatiguePct ??
    m.fatigue_index ??
    m.fatigueIndex ??
    m.fatigue;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw >= 0 && raw <= 1) return raw * 100;
  return Math.min(100, Math.max(0, raw));
}

export function inferSeverityFromScore(
  analysisScore: number | null | undefined,
): "Mild" | "Moderate" | "Needs Attention" | null {
  if (analysisScore == null || !Number.isFinite(analysisScore)) return null;
  if (analysisScore >= 85) return "Mild";
  if (analysisScore >= 70) return "Moderate";
  return "Needs Attention";
}

/**
 * Rule-based prescription of therapy URL context from assessment outcome.
 * Priority: fatigue → symmetry → control → gait severity band → default gait.
 */
export function deriveRecommendedTherapyContextFromAssessment(params: {
  testName: string | null | undefined;
  analysisScore: number | null;
  severity: "Mild" | "Moderate" | "Needs Attention" | null;
  signals: AssessmentSignals;
  movementMetrics: Record<string, unknown> | null | undefined;
}): RecommendedTherapyContext {
  const testKey = String(params.testName ?? "").toLowerCase().trim();
  const severity =
    params.severity ?? inferSeverityFromScore(params.analysisScore);

  const sym01 = toSymmetry01(params.signals);
  const lowSymmetry = sym01 != null && sym01 < SYMMETRY_01_THRESHOLD;
  const lowSymmetryPct =
    params.signals.symmetryPct != null &&
    Number.isFinite(params.signals.symmetryPct) &&
    params.signals.symmetryPct < SYMMETRY_PCT_THRESHOLD;
  const asymmetryFlag = lowSymmetry || lowSymmetryPct;

  const poorControl =
    (params.signals.trunkSwayDeg != null &&
      Number.isFinite(params.signals.trunkSwayDeg) &&
      params.signals.trunkSwayDeg > TRUNK_SWAY_DEG_POOR_CONTROL) ||
    (params.signals.overallScore != null &&
      Number.isFinite(params.signals.overallScore) &&
      params.signals.overallScore < OVERALL_SCORE_POOR_CONTROL);

  const fatiguePct = fatiguePercentFromMetrics(params.movementMetrics);
  const highFatigue = fatiguePct != null && fatiguePct >= 70;

  if (highFatigue) {
    return {
      programId: "gait-training",
      phase: "1",
      sessionType: "lower-intensity-session",
      reason:
        "Assessment suggests elevated fatigue — use a lower-intensity stepping session until tolerance improves.",
    };
  }

  if (asymmetryFlag) {
    return {
      programId: "gait-training",
      phase: "2",
      sessionType: "symmetry-correction-session",
      reason: "Assessment shows reduced bilateral symmetry — prioritize symmetry correction in stepping.",
    };
  }

  if (poorControl) {
    return {
      programId: "gait-training",
      phase: "2",
      sessionType: "movement-control-training",
      reason: "Assessment indicates reduced movement control — emphasize guided motor control.",
    };
  }

  if (testKey === "gait" && severity === "Moderate") {
    return {
      programId: "gait-training",
      phase: "3",
      sessionType: "strength-activation-session",
      reason: "Moderate gait limitation on assessment — progress strength-activation stepping.",
    };
  }

  if (testKey === "gait" && severity === "Needs Attention") {
    return {
      programId: "gait-training",
      phase: "2",
      sessionType: "strength-activation-session",
      reason: "Notable gait limitation — structured activation session recommended.",
    };
  }

  return {
    programId: DEFAULT_THERAPY_PROGRAM_ID,
    phase: DEFAULT_THERAPY_PHASE,
    sessionType: DEFAULT_THERAPY_SESSION_TYPE,
    reason: "Continue structured camera-based gait therapy from assessment review.",
  };
}
