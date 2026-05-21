/**
 * Rule-based therapy guidance after camera-based CV sessions.
 * Clinical decision-support only — not medical diagnosis; does not replace therapist judgment.
 */

export type TherapyDecisionMetrics = {
  totalSteps?: number | null;
  leftKneeCount?: number | null;
  rightKneeCount?: number | null;
  /** Bilateral symmetry 0–100; null if not computable */
  symmetry?: number | null;
  /** Step-height consistency / control 0–100 from biomechanics when available */
  controlScore?: number | null;
  movementQuality?: number | null;
  /** Raw fatigue proxy: typically 0–1 in-app; values >1 treated as 0–100 scale */
  fatigueIndex?: number | null;
  durationSec?: number | null;
  programId?: string | null;
  phase?: string | null;
  sessionType?: string | null;
};

export type TherapyRecommendation = {
  interpretation: string[];
  nextAction: string;
  progressionStatus: string;
  intensityNote: string;
  confidence: "rule-based";
};

const DISCLAIMER =
  "This is clinical guidance for therapy planning only — not a medical diagnosis. The treating therapist remains responsible for all treatment decisions.";

/** Normalize fatigue to 0–100 for rule thresholds (spec uses 40 / 70). */
function fatigueToPercent(fatigueIndex: number | null | undefined): number | null {
  if (fatigueIndex == null || Number.isNaN(fatigueIndex)) return null;
  if (fatigueIndex >= 0 && fatigueIndex <= 1) return fatigueIndex * 100;
  return Math.min(100, Math.max(0, fatigueIndex));
}

function symmetryGuidance(symmetry: number | null | undefined): string | null {
  if (symmetry == null || Number.isNaN(symmetry)) {
    return "Symmetry: limited or insufficient rep data — use bilateral cues and reassess next session.";
  }
  if (symmetry >= 90) return "Symmetry: good left-right symmetry.";
  if (symmetry >= 80) return "Symmetry: mild asymmetry — continue bilateral control work.";
  return "Symmetry: significant asymmetry — prioritize symmetry correction.";
}

function controlGuidance(controlScore: number | null | undefined): string | null {
  if (controlScore == null || Number.isNaN(controlScore)) {
    return "Control: not estimated this session — guided correction remains appropriate.";
  }
  if (controlScore >= 80) return "Control: good movement control.";
  if (controlScore >= 60) return "Control: moderate control — continue guided correction.";
  return "Control: low control — reduce speed and focus on alignment.";
}

function fatigueGuidance(fatiguePct: number | null): string | null {
  if (fatiguePct == null || Number.isNaN(fatiguePct)) {
    return "Fatigue: pattern not estimated — monitor tolerance and adjust load conservatively.";
  }
  if (fatiguePct >= 70) return "Fatigue: high fatigue signal — reduce intensity or add rest.";
  if (fatiguePct >= 40) return "Fatigue: moderate fatigue — monitor tolerance.";
  return "Fatigue: low fatigue signal — current load appears tolerated.";
}

/**
 * Produces therapy recommendation text from available session metrics.
 * Missing inputs yield conservative, non-committal guidance.
 */
export function generateTherapyRecommendation(
  metrics: TherapyDecisionMetrics,
): TherapyRecommendation {
  const {
    totalSteps = 0,
    symmetry,
    controlScore,
    fatigueIndex,
    movementQuality,
    durationSec,
    programId,
    phase,
    sessionType,
  } = metrics;

  const fatiguePct = fatigueToPercent(fatigueIndex ?? null);

  const interpretation: string[] = [];

  if (!totalSteps || totalSteps < 1) {
    interpretation.push(
      "No reliable step data from this session — repeat when the patient is fully in frame and tracking is stable.",
    );
    interpretation.push(DISCLAIMER);
    return {
      interpretation,
      nextAction: "Repeat current session with guided feedback once camera tracking is reliable.",
      progressionStatus: "Hold progression",
      intensityNote:
        "Keep intensity conservative until valid movement data is captured. " + DISCLAIMER,
      confidence: "rule-based",
    };
  }

  const symLine = symmetryGuidance(symmetry ?? null);
  const ctrlLine = controlGuidance(controlScore ?? null);
  const fatLine = fatigueGuidance(fatiguePct);

  if (symLine) interpretation.push(symLine);
  if (ctrlLine) interpretation.push(ctrlLine);
  if (fatLine) interpretation.push(fatLine);

  if (movementQuality != null && !Number.isNaN(movementQuality)) {
    interpretation.push(`Movement quality score (this session): ${movementQuality}/100.`);
  }

  if (programId || phase || sessionType) {
    const ctx = [programId && `program ${programId}`, phase && `phase ${phase}`, sessionType && `session ${sessionType}`]
      .filter(Boolean)
      .join(", ");
    if (ctx) interpretation.push(`Context: ${ctx}.`);
  }

  if (durationSec != null && durationSec > 0) {
    interpretation.push(`Session duration recorded: ${Math.round(durationSec)}s.`);
  }

  interpretation.push(DISCLAIMER);

  const sym = symmetry ?? null;
  const ctrl = controlScore ?? null;

  const holdProgression =
    (sym != null && sym < 80) ||
    (ctrl != null && ctrl < 60) ||
    (fatiguePct != null && fatiguePct >= 70);

  const readyToProgress =
    sym != null &&
    sym >= 90 &&
    ctrl != null &&
    ctrl >= 80 &&
    fatiguePct != null &&
    fatiguePct < 60;

  let progressionStatus: string;
  if (readyToProgress) progressionStatus = "Ready to progress";
  else if (holdProgression) progressionStatus = "Hold progression";
  else progressionStatus = "Continue current phase";

  let nextAction: string;
  if (sym != null && sym < 80) {
    nextAction = "Symmetry correction session";
  } else if (ctrl != null && ctrl < 60) {
    nextAction = "Movement control training";
  } else if (fatiguePct != null && fatiguePct >= 70) {
    nextAction = "Lower intensity session";
  } else if (readyToProgress) {
    nextAction = "Progress to next phase / increase challenge";
  } else {
    nextAction = "Repeat current session with guided feedback";
  }

  const intensityParts: string[] = [];
  if (fatiguePct != null && fatiguePct >= 70) {
    intensityParts.push("Reduce volume or add rest breaks before increasing load.");
  } else if (fatiguePct != null && fatiguePct >= 40) {
    intensityParts.push("Watch for tolerance; adjust session length or density if needed.");
  }
  if (ctrl != null && ctrl < 60) {
    intensityParts.push("Favor slower tempos and alignment cues over volume.");
  }
  if (sym != null && sym < 80) {
    intensityParts.push("Prioritize even bilateral loading before advancing difficulty.");
  }
  if (intensityParts.length === 0) {
    intensityParts.push("Intensity can follow existing protocol if the therapist agrees recovery markers are met.");
  }
  intensityParts.push(DISCLAIMER);

  const intensityNote = intensityParts.join(" ");

  return {
    interpretation,
    nextAction,
    progressionStatus,
    intensityNote,
    confidence: "rule-based",
  };
}
