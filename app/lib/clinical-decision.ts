/**
 * Mock clinical decision support — rule-based program suggestions from assessment signals.
 *
 * TODO: Replace with ML / rules engine fed by gait AI + EHR, persisted prescriptions,
 *       and therapist override workflow via backend API.
 */

export type ProgramSuggestionId = "side_stepping" | "balance_training" | "maintenance_gait";

export type ProgramSuggestion = {
  id: ProgramSuggestionId;
  title: string;
  rationale: string;
  href: string;
};

export type ClinicalDecision = {
  /** Short bullets for the Clinical Summary panel */
  summaryLines: string[];
  programs: ProgramSuggestion[];
  /** Highest-priority action for primary CTA */
  primaryProgram: ProgramSuggestion;
};

/** Symmetry on 0–1 scale (e.g. MediaPipe / gait AI `symmetry_score`). */
const SYMMETRY_01_THRESHOLD = 0.75;
/** Alternative: symmetry already as percent 0–100 */
const SYMMETRY_PCT_THRESHOLD = 75;
/** Trunk sway SD (°) above this → mock “control” concern */
const TRUNK_SWAY_DEG_POOR_CONTROL = 4;
/** Overall score below this (0–100) → mock “control” concern */
const OVERALL_SCORE_POOR_CONTROL = 60;

export type AssessmentSignals = {
  symmetry01?: number | null;
  symmetryPct?: number | null;
  trunkSwayDeg?: number | null;
  overallScore?: number | null;
};

function toSymmetry01(s: AssessmentSignals): number | null {
  if (s.symmetry01 != null && Number.isFinite(s.symmetry01)) {
    return Math.max(0, Math.min(1, s.symmetry01));
  }
  if (s.symmetryPct != null && Number.isFinite(s.symmetryPct)) {
    return Math.max(0, Math.min(1, s.symmetryPct / 100));
  }
  return null;
}

/**
 * Derive mock program recommendations. Safe to call with partial inputs.
 */
export function getMockClinicalDecision(signals: AssessmentSignals): ClinicalDecision {
  const sym01 = toSymmetry01(signals);
  const lowSymmetry = sym01 != null && sym01 < SYMMETRY_01_THRESHOLD;
  const lowSymmetryPct =
    signals.symmetryPct != null &&
    Number.isFinite(signals.symmetryPct) &&
    signals.symmetryPct < SYMMETRY_PCT_THRESHOLD;
  const asymmetryFlag = lowSymmetry || lowSymmetryPct;

  const poorControl =
    (signals.trunkSwayDeg != null &&
      Number.isFinite(signals.trunkSwayDeg) &&
      signals.trunkSwayDeg > TRUNK_SWAY_DEG_POOR_CONTROL) ||
    (signals.overallScore != null &&
      Number.isFinite(signals.overallScore) &&
      signals.overallScore < OVERALL_SCORE_POOR_CONTROL);

  const summaryLines: string[] = [];

  if (sym01 != null) {
    summaryLines.push(
      `Step symmetry index ${(sym01 * 100).toFixed(1)}% — ${asymmetryFlag ? "below mock target (75%)" : "at or above mock target"}.`
    );
  } else if (signals.symmetryPct != null && Number.isFinite(signals.symmetryPct)) {
    summaryLines.push(
      `Step symmetry ${signals.symmetryPct.toFixed(0)}% — ${lowSymmetryPct ? "below mock target" : "at or above mock target"}.`
    );
  } else {
    summaryLines.push("Step symmetry: not available from this assessment — using other signals or defaults.");
  }

  if (signals.trunkSwayDeg != null && Number.isFinite(signals.trunkSwayDeg)) {
    summaryLines.push(
      `Trunk sway variability ${signals.trunkSwayDeg.toFixed(1)}° — ${signals.trunkSwayDeg > TRUNK_SWAY_DEG_POOR_CONTROL ? "elevated (mock control concern)" : "within mock tolerance"}.`
    );
  }

  if (signals.overallScore != null && Number.isFinite(signals.overallScore)) {
    summaryLines.push(
      `Overall score ${signals.overallScore}% — ${signals.overallScore < OVERALL_SCORE_POOR_CONTROL ? "suggests closer motor control follow-up in mock rules" : "acceptable under mock rules"}.`
    );
  }

  const programs: ProgramSuggestion[] = [];

  if (asymmetryFlag) {
    programs.push({
      id: "side_stepping",
      title: "Side stepping therapy",
      rationale:
        "Mock rule: bilateral symmetry under threshold → prescribe lateral stepping / weight-shift loading (in-app session).",
      href: "/therapy",
    });
  }

  if (poorControl) {
    programs.push({
      id: "balance_training",
      title: "Balance & postural control",
      rationale:
        "Mock rule: trunk sway or overall score indicates reduced control → balance-focused protocol in rehabilitation library.",
      href: "/library/sports",
    });
  }

  if (programs.length === 0) {
    programs.push({
      id: "maintenance_gait",
      title: "Structured gait therapy",
      rationale:
        "Mock default: no strong asymmetry or control flags — continue structured stepping / gait work or maintenance load.",
      href: "/therapy",
    });
  }

  const primaryProgram: ProgramSuggestion = asymmetryFlag
    ? programs.find((p) => p.id === "side_stepping")!
    : poorControl
      ? programs.find((p) => p.id === "balance_training")!
      : programs[0]!;

  return { summaryLines, programs, primaryProgram };
}

/** Build query string to pass patient + return path + optional mock signals into therapy/library */
export function clinicalFlowQuery(params: {
  patientId?: string;
  assessmentId?: string;
  returnTo?: string;
  recommended?: ProgramSuggestionId;
  symmetry01?: number | null;
  trunkSwayDeg?: number | null;
  overallScore?: number | null;
}): string {
  const q = new URLSearchParams();
  if (params.patientId && params.patientId !== "—") q.set("patientId", params.patientId);
  if (params.assessmentId && params.assessmentId !== "—") q.set("assessmentId", params.assessmentId);
  if (params.returnTo) q.set("returnTo", params.returnTo);
  if (params.recommended) q.set("recommended", params.recommended);
  if (params.symmetry01 != null && Number.isFinite(params.symmetry01)) {
    q.set("symmetry", String(params.symmetry01));
  }
  if (params.trunkSwayDeg != null && Number.isFinite(params.trunkSwayDeg)) {
    q.set("trunkSway", String(params.trunkSwayDeg));
  }
  if (params.overallScore != null && Number.isFinite(params.overallScore)) {
    q.set("score", String(params.overallScore));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
