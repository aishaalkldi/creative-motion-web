/**
 * ml-engine.ts
 *
 * Lightweight movement-quality prediction for Creative Motion rehabilitation.
 *
 * Algorithm: Weighted k-Nearest Neighbours (kNN)
 * ─────────────────────────────────────────────
 * • No external ML library — pure TypeScript, zero bundle overhead.
 * • Works with as few as MIN_LABELED_SESSIONS labelled sessions.
 * • Fully interpretable: every prediction comes with a feature explanation.
 * • Inverse-distance weighting reduces sensitivity to outliers.
 *
 * Upgrade path to TensorFlow.js
 * ─────────────────────────────
 * When the dataset reaches 50+ therapist-approved sessions, `extractFeatures`
 * already produces the normalised input vectors needed for a dense neural
 * network. Replace `predictQuality` with a TF.js model trained offline and
 * loaded via `tf.loadLayersModel(url)`. Keep `extractFeatures` unchanged.
 *
 * Safety
 * ──────
 * All predictions are decision-support only. The system must NEVER replace
 * clinical judgment. `MLPrediction.disclaimer` carries this text in every
 * prediction object to make accidental misuse harder.
 */

import type { SessionRecord, TherapistLabel } from "../session-store";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */

/** Normalised feature vector — all values in [0, 1]. */
export interface FeatureVector {
  steps:      number; // totalSteps / 120
  symmetry:   number; // symmetryPct / 100
  rom:        number; // romScore / 100
  posture:    number; // postureScore / 100
  control:    number; // controlScore / 100
  quality:    number; // movementQualityScore / 100
  noFatigue:  number; // 1 − fatigueIndex  (higher = less fatigued)
  visibility: number; // cameraVisibilityScore / 100
  balance:    number; // min(L, R) / max(L, R)
}

/** Feature-level explanation attached to every prediction. */
export interface FeatureExplanation {
  key:             keyof FeatureVector;
  displayName:     string;
  rawValue:        number;
  normalizedValue: number;
  impact:          "positive" | "negative" | "neutral";
  description:     string;
}

/** Full prediction result — always includes disclaimer. */
export interface MLPrediction {
  predictedLabel:      Exclude<TherapistLabel, "unlabeled">;
  confidence:          number;  // 0–1 (fraction of k nearest with same label)
  labeledSessionsUsed: number;
  kUsed:               number;
  explanations:        FeatureExplanation[];
  disclaimer:          string;
  suggestedAction:     string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
═══════════════════════════════════════════════════════════════════════════ */

/** Minimum therapist-labelled sessions before predictions are emitted. */
export const MIN_LABELED_SESSIONS = 3;

const K_NEIGHBORS = 3;

/**
 * Feature weights — reflect clinical importance.
 * Movement quality and control are highest because they directly indicate
 * rehabilitation progress and fall risk.
 */
const WEIGHTS: Record<keyof FeatureVector, number> = {
  quality:    2.0,
  control:    1.5,
  symmetry:   1.5,
  rom:        1.5,
  balance:    1.0,
  steps:      1.0,
  posture:    0.8,
  noFatigue:  0.5,
  visibility: 0.3,
};

/**
 * Exported copy of the default clinical feature weights.
 * Other modules (patient-memory, decision-engine) use this as the
 * starting point for per-patient personalised weight vectors.
 */
export const DEFAULT_WEIGHTS: Record<keyof FeatureVector, number> = { ...WEIGHTS };

const DISPLAY: Record<keyof FeatureVector, string> = {
  steps:      "Step Count",
  symmetry:   "Bilateral Symmetry",
  rom:        "Range of Motion",
  posture:    "Postural Stability",
  control:    "Movement Control",
  quality:    "Movement Quality",
  noFatigue:  "Fatigue Level",
  visibility: "Camera Visibility",
  balance:    "L/R Balance",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Feature extraction
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Extract and normalise a session's metrics into a fixed-length [0,1] vector.
 * Missing biomechanics fields map to 0.5 in feature space (explicit “unknown”
 * neutral for distance — not a claim about the patient’s true score).
 */
const FEAT_UNKNOWN = 0.5;

export function extractFeatures(s: SessionRecord): FeatureVector {
  const bio  = s.biomechanics;
  const maxS = Math.max(s.leftSteps, s.rightSteps, 1);
  const minS = Math.min(s.leftSteps, s.rightSteps);
  return {
    steps:      Math.min(s.totalSteps / 120, 1),
    symmetry:   s.symmetryPct >= 0 ? s.symmetryPct / 100 : FEAT_UNKNOWN,
    rom:        bio?.romScore != null ? bio.romScore / 100 : FEAT_UNKNOWN,
    posture:    bio?.postureScore != null ? bio.postureScore / 100 : FEAT_UNKNOWN,
    control:    bio?.controlScore != null ? bio.controlScore / 100 : FEAT_UNKNOWN,
    quality:    bio?.movementQualityScore != null ? bio.movementQualityScore / 100 : FEAT_UNKNOWN,
    noFatigue:  1 - Math.min(s.fatigueIndex ?? 0, 1),
    visibility:
      s.cameraVisibilityScore != null ? s.cameraVisibilityScore / 100 : FEAT_UNKNOWN,
    balance:    minS / maxS,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   kNN core
═══════════════════════════════════════════════════════════════════════════ */

/** Weighted Euclidean distance between two feature vectors using supplied weights. */
export function wDistCustom(
  a: FeatureVector,
  b: FeatureVector,
  w: Record<keyof FeatureVector, number>,
): number {
  return Math.sqrt(
    (Object.keys(a) as Array<keyof FeatureVector>).reduce(
      (sum, k) => sum + w[k] * (a[k] - b[k]) ** 2,
      0,
    ),
  );
}

/** Weighted Euclidean distance using the built-in default weights. */
function wDist(a: FeatureVector, b: FeatureVector): number {
  return wDistCustom(a, b, WEIGHTS);
}

function meanArr(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Prediction
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Predict the movement quality label for `current` using kNN on labelled sessions.
 *
 * Returns null when fewer than MIN_LABELED_SESSIONS therapist-labelled
 * (non-"unlabeled") sessions exist in `allSessions`.
 *
 * The prediction is purely advisory — final clinical judgment always rests
 * with the supervising therapist.
 */
/**
 * Predict movement quality using kNN.
 *
 * @param current         Session to predict for.
 * @param allSessions     All patient sessions (labelled ones used as references).
 * @param customWeights   Optional per-patient personalised weights from online learning.
 *                        Falls back to DEFAULT_WEIGHTS if omitted.
 */
export function predictQuality(
  current: SessionRecord,
  allSessions: SessionRecord[],
  customWeights?: Record<keyof FeatureVector, number>,
): MLPrediction | null {
  const labelled = allSessions.filter(
    (s) => s.therapistLabel && s.therapistLabel !== "unlabeled" && s.id !== current.id,
  );
  if (labelled.length < MIN_LABELED_SESSIONS) return null;

  const w  = customWeights ?? WEIGHTS;
  const cf = extractFeatures(current);

  // Rank by weighted distance
  const ranked = labelled
    .map((s) => ({
      s,
      label: s.therapistLabel as Exclude<TherapistLabel, "unlabeled">,
      dist:  wDistCustom(cf, extractFeatures(s), w),
    }))
    .sort((a, b) => a.dist - b.dist);

  const k          = Math.min(K_NEIGHBORS, ranked.length);
  const neighbours = ranked.slice(0, k);

  // Inverse-distance weighted vote
  const votes: Record<string, number> = {};
  for (const { label, dist } of neighbours) {
    const w = 1 / (dist + 1e-9);
    votes[label] = (votes[label] ?? 0) + w;
  }
  const predictedLabel = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0] as
    Exclude<TherapistLabel, "unlabeled">;
  const totalW   = Object.values(votes).reduce((a, b) => a + b, 0);
  const confidence = Math.round((votes[predictedLabel] / totalW) * 100) / 100;

  // Reference group for explanations = "good" sessions, fall back to all labelled
  const goodSessions = labelled.filter((s) => s.therapistLabel === "good");
  const refGroup     = goodSessions.length > 0 ? goodSessions : labelled;

  return {
    predictedLabel,
    confidence,
    labeledSessionsUsed: labelled.length,
    kUsed: k,
    explanations: buildExplanations(current, cf, refGroup),
    disclaimer: "Decision-support only · Not a clinical diagnosis",
    suggestedAction: suggestAction(predictedLabel, cf),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Feature explanations
═══════════════════════════════════════════════════════════════════════════ */

function buildExplanations(
  session: SessionRecord,
  cf: FeatureVector,
  refGroup: SessionRecord[],
): FeatureExplanation[] {
  const refFeats = refGroup.map(extractFeatures);

  // Raw (display) values for each feature
  const raw: Record<keyof FeatureVector, number> = {
    steps:      session.totalSteps,
    symmetry:   session.symmetryPct >= 0 ? session.symmetryPct : -1,
    /** −1 = not computed (display / copy only; kNN uses FEAT_UNKNOWN in cf). */
    rom:        session.biomechanics?.romScore ?? -1,
    posture:    session.biomechanics?.postureScore ?? -1,
    control:    session.biomechanics?.controlScore ?? -1,
    quality:    session.biomechanics?.movementQualityScore ?? -1,
    noFatigue:  Math.round((1 - (session.fatigueIndex ?? 0)) * 100),
    visibility: session.cameraVisibilityScore ?? -1,
    balance:    Math.round(
      (Math.min(session.leftSteps, session.rightSteps) /
        Math.max(session.leftSteps, session.rightSteps, 1)) * 100,
    ),
  };

  const keys = Object.keys(cf) as Array<keyof FeatureVector>;

  const results: FeatureExplanation[] = keys.map((k) => {
    const refMean   = meanArr(refFeats.map((f) => f[k]));
    const deviation = cf[k] - refMean;
    const impact: FeatureExplanation["impact"] =
      Math.abs(deviation) < 0.10 ? "neutral" :
      deviation > 0             ? "positive" :
                                   "negative";

    return {
      key: k,
      displayName:     DISPLAY[k],
      rawValue:        raw[k],
      normalizedValue: cf[k],
      impact,
      description:     describeFeature(k, cf[k], raw[k], refMean),
    };
  });

  // Sort by clinical weight × magnitude of deviation — top 4 most significant
  return results
    .sort((a, b) => {
      const refA = meanArr(refFeats.map((f) => f[a.key]));
      const refB = meanArr(refFeats.map((f) => f[b.key]));
      return (
        WEIGHTS[b.key] * Math.abs(b.normalizedValue - refB) -
        WEIGHTS[a.key] * Math.abs(a.normalizedValue - refA)
      );
    })
    .slice(0, 4);
}

function describeFeature(
  k: keyof FeatureVector,
  norm: number,
  raw: number,
  refMean: number,
): string {
  const below = norm < refMean - 0.10;
  const above = norm > refMean + 0.10;
  switch (k) {
    case "steps":
      return below
        ? `${raw} steps — below reference group average`
        : `${raw} steps — meets or exceeds reference group`;
    case "symmetry":
      if (raw < 0) return "Step-count symmetry — insufficient reps for a reliable percentage";
      return below
        ? `Symmetry ${raw}% — asymmetric loading may be present`
        : `Symmetry ${raw}% — balanced bilateral contribution`;
    case "rom":
      if (raw < 0) return "ROM score — not computed (need more valid knee-lift samples)";
      return below
        ? `ROM score ${raw} — knee lift height below target`
        : `ROM score ${raw} — good range of motion achieved`;
    case "posture":
      if (raw < 0) return "Posture score — not computed (insufficient hip samples)";
      return below
        ? `Posture score ${raw} — pelvic stability was inconsistent`
        : `Posture score ${raw} — stable trunk pattern`;
    case "control":
      if (raw < 0) return "Control score — not computed (need ≥2 step height samples)";
      return below
        ? `Control score ${raw} — step heights varied noticeably`
        : `Control score ${raw} — consistent movement quality`;
    case "quality":
      if (raw < 0) return "Movement quality — not computed (no composite could be formed)";
      return below
        ? `Movement quality ${raw} — composite score below target`
        : `Movement quality ${raw} — strong composite score`;
    case "noFatigue":
      return above
        ? `Low fatigue — pace maintained throughout session`
        : `Fatigue detected — output declined in second half`;
    case "visibility":
      if (raw < 0) return "Camera visibility — not recorded for this session";
      return below
        ? `Camera visibility ${raw}% — body not consistently in frame`
        : `Camera visibility ${raw}% — clear tracking`;
    case "balance":
      return below
        ? `L/R balance ${raw}% — one side may be dominant`
        : `L/R balance ${raw}% — even bilateral contribution`;
    default:
      return `${Math.round(norm * 100)}%`;
  }
}

function suggestAction(
  label: Exclude<TherapistLabel, "unlabeled">,
  f: FeatureVector,
): string {
  switch (label) {
    case "good":
      return "Session quality matches well-rated historical sessions. Consider gradually advancing targets if the therapist agrees.";
    case "acceptable":
      return f.control < 0.65
        ? "Focus on movement consistency — controlled repetitions before increasing pace."
        : "Performance is acceptable. Maintain the current programme and monitor symmetry at next session.";
    case "poor":
    case "poor_control":
      return f.noFatigue < 0.5
        ? "Fatigue may have limited output. Review rest intervals and session timing."
        : "Step-height consistency or control was reduced. Focus on controlled repetitions before increasing pace.";
    case "fatigue_limited":
      return "Session output dropped in the second half. Review rest intervals and consider a shorter session duration.";
    case "technical_error":
      return "A technical issue may have affected step counting. Validate this session against visual observation before using data for decisions.";
    case "camera_issue":
      return "Camera framing or landmark quality was reduced. Reposition the camera and ensure good lighting for future sessions.";
    case "unsafe":
      return "⚠ Clinical review is recommended before the next session. Do not advance intensity without therapist approval.";
  }
}
