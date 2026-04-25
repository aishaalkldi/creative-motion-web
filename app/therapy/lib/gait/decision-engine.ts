/**
 * decision-engine.ts
 *
 * Hybrid prediction and clinical decision support for Creative Motion.
 *
 * Combines two complementary predictors:
 *  1. kNN (ml-engine.ts) — instance-based, data-driven, uses labelled sessions
 *  2. Memory predictor   — rule-based, uses EMA + trend from patient-memory.ts
 *
 * The hybrid confidence model:
 *  • kNN weight grows with labelled-session count (max 70%)
 *  • Memory weight provides a prior when labels are sparse
 *  • Agreement bonus: +10% if both predictors agree on the label
 *  • Session-count penalty: confidence ×0.75 when fewer than 5 sessions
 *
 * Decision Engine:
 *  Generates one of four actions based on hybrid prediction + risk flags.
 *  All actions require clinician approval before being communicated to
 *  the patient as a programme change.
 *
 * Safety
 * ──────
 * Decision-support only · Not a clinical diagnosis.
 * No treatment is prescribed. All outputs are labelled with this disclaimer.
 * "Unsafe" prediction or any high-severity risk flag triggers
 * flag_clinician_review regardless of other signals.
 */

import type { SessionRecord, TherapistLabel } from "../session-store";
import {
  predictQuality,
  extractFeatures,
  MIN_LABELED_SESSIONS,
  type MLPrediction,
  type FeatureVector,
} from "./ml-engine";
import type {
  PatientMemory,
  RiskFlag,
  OnlineWeights,
} from "./patient-memory";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */

/** Memory-based (rule / EMA / trend) quality prediction. */
export interface MemoryPrediction {
  predictedLabel: Exclude<TherapistLabel, "unlabeled">;
  confidence:     number;   // 0–1
  reasoning:      string;
  basedOn:        "risk_override" | "ema" | "trend" | "delta" | "insufficient_data";
}

/** Combined output of kNN + memory predictor. */
export interface HybridPrediction {
  knn:         MLPrediction | null;
  memory:      MemoryPrediction | null;
  finalLabel:  Exclude<TherapistLabel, "unlabeled">;
  finalConfidence: number;  // 0–1
  confidenceBreakdown: {
    knnWeight:        number;
    memoryWeight:     number;
    knnConfidence:    number;
    memoryConfidence: number;
    agreement:        boolean;
  };
  disclaimer: string;
  usingPersonalizedWeights: boolean;
}

/** Recommended action from the decision engine. */
export type DecisionAction =
  | "increase_difficulty"
  | "decrease_difficulty"
  | "maintain_current"
  | "maintain_corrective_focus"
  | "flag_clinician_review"
  | "pause_advancement";

/** Full decision with reasoning and safety metadata. */
export interface Decision {
  action:                   DecisionAction;
  confidence:               number;    // 0–1
  urgency:                  "routine" | "soon" | "immediate";
  reasoning:                string[];  // ordered list of contributing factors
  requiresClinicianApproval: boolean;
  safetyNote:               string;
  disclaimer:               string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Memory-based prediction
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Rule-based quality prediction from patient memory.
 * Acts as a prior when labelled-session count is too low for kNN.
 */
export function computeMemoryPrediction(
  current:  SessionRecord,
  memory:   PatientMemory,
): MemoryPrediction | null {
  if (memory.sessionCount < 2) return null;

  /* ── Safety override: high-severity risk flags ── */
  const highRisk = memory.riskFlags.filter((f) => f.requiresImmediateReview);
  if (highRisk.length > 0) {
    return {
      predictedLabel: "unsafe",
      confidence:     0.80,
      reasoning:      `High-severity risk flag: ${highRisk[0].description}`,
      basedOn:        "risk_override",
    };
  }

  const q     = current.biomechanics?.movementQualityScore;
  const emaQ  = memory.trend.emaQuality;
  const dir   = memory.trend.overallDirection;

  /* ── EMA-based if both values available ── */
  if (q !== undefined && emaQ !== null && emaQ > 0) {
    const ratio = q / emaQ;

    // Assess medium-severity risk flags
    const mediumRisk = memory.riskFlags.filter((f) => f.severity === "medium").length;

    if (mediumRisk > 0 && q < 65) {
      return {
        predictedLabel: "poor",
        confidence:     0.65,
        reasoning:      `Quality ${q} below EMA ${emaQ} with medium-severity risk flags.`,
        basedOn:        "ema",
      };
    }
    if (ratio >= 1.08 && q >= 70) {
      return {
        predictedLabel: "good",
        confidence:     Math.min(0.80, 0.60 + (ratio - 1) * 0.5),
        reasoning:      `Quality ${q} is ${Math.round((ratio - 1) * 100)}% above smoothed baseline ${emaQ}.`,
        basedOn:        "ema",
      };
    }
    if (ratio >= 0.88) {
      return {
        predictedLabel: "acceptable",
        confidence:     0.62,
        reasoning:      `Quality ${q} near smoothed baseline ${emaQ} (ratio ${ratio.toFixed(2)}).`,
        basedOn:        "ema",
      };
    }
    return {
      predictedLabel: "poor",
      confidence:     0.60,
      reasoning:      `Quality ${q} is ${Math.round((1 - ratio) * 100)}% below smoothed baseline ${emaQ}.`,
      basedOn:        "ema",
    };
  }

  /* ── Delta-based: compare to previous session ── */
  const lastDelta = memory.deltas[memory.deltas.length - 1];
  if (lastDelta) {
    if (!lastDelta.isImprovement && lastDelta.isConcerning) {
      return {
        predictedLabel: "poor",
        confidence:     0.55,
        reasoning:      `Concerning delta from previous session: steps ${lastDelta.deltaSteps > 0 ? "+" : ""}${lastDelta.deltaSteps}, symmetry ${lastDelta.deltaSymmetry > 0 ? "+" : ""}${lastDelta.deltaSymmetry}%.`,
        basedOn:        "delta",
      };
    }
    if (lastDelta.isImprovement) {
      return {
        predictedLabel: "acceptable",
        confidence:     0.52,
        reasoning:      `Improvement from previous session: +${lastDelta.deltaSteps} steps, symmetry ${lastDelta.deltaSymmetry > 0 ? "+" : ""}${lastDelta.deltaSymmetry}%.`,
        basedOn:        "delta",
      };
    }
  }

  /* ── Trend-based fallback ── */
  const labelMap: Record<TrendDir, Exclude<TherapistLabel, "unlabeled">> = {
    improving: "acceptable",
    stable:    "acceptable",
    declining: "poor",
  };
  type TrendDir = "improving" | "stable" | "declining";
  return {
    predictedLabel: labelMap[dir as TrendDir],
    confidence:     0.45,
    reasoning:      `Based on overall trend: ${dir}.`,
    basedOn:        "trend",
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hybrid prediction
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Combine kNN (with optional personalised weights) and memory prediction
 * into a single hybrid output with a calibrated confidence score.
 */
export function computeHybridPrediction(
  current:       SessionRecord,
  allSessions:   SessionRecord[],
  memory:        PatientMemory,
  onlineWeights?: OnlineWeights,
): HybridPrediction {
  const knn = predictQuality(
    current,
    allSessions,
    onlineWeights?.updateCount && onlineWeights.updateCount > 0
      ? onlineWeights.weights
      : undefined,
  );
  const mem = computeMemoryPrediction(current, memory);

  const usingPersonalised = !!(onlineWeights?.updateCount && onlineWeights.updateCount > 0);
  const labeledCount      = allSessions.filter((s) => s.therapistLabel && s.therapistLabel !== "unlabeled").length;

  /* ── kNN only ── */
  if (knn && !mem) {
    return {
      knn, memory: null,
      finalLabel:      knn.predictedLabel,
      finalConfidence: adjustConfidence(knn.confidence, labeledCount, allSessions.length),
      confidenceBreakdown: {
        knnWeight: 1, memoryWeight: 0,
        knnConfidence: knn.confidence, memoryConfidence: 0, agreement: false,
      },
      disclaimer:            "Decision-support only · Not a clinical diagnosis",
      usingPersonalizedWeights: usingPersonalised,
    };
  }

  /* ── Memory only ── */
  if (!knn && mem) {
    return {
      knn: null, memory: mem,
      finalLabel:      mem.predictedLabel,
      finalConfidence: adjustConfidence(mem.confidence, labeledCount, allSessions.length),
      confidenceBreakdown: {
        knnWeight: 0, memoryWeight: 1,
        knnConfidence: 0, memoryConfidence: mem.confidence, agreement: false,
      },
      disclaimer:            "Decision-support only · Not a clinical diagnosis",
      usingPersonalizedWeights: usingPersonalised,
    };
  }

  /* ── Both available — blend ── */
  if (knn && mem) {
    // kNN weight grows with labelled session count, capped at 70%
    const knnWeight    = Math.min(0.70, labeledCount / 10);
    const memoryWeight = 1 - knnWeight;
    const agreement    = knn.predictedLabel === mem.predictedLabel;

    let blended = knnWeight * knn.confidence + memoryWeight * mem.confidence;
    if (agreement) blended = Math.min(1, blended * 1.10);

    // Safety override: if either says "unsafe", final is "unsafe"
    const finalLabel: Exclude<TherapistLabel, "unlabeled"> =
      knn.predictedLabel === "unsafe" || mem.predictedLabel === "unsafe"
        ? "unsafe"
        : agreement
          ? knn.predictedLabel
          : knnWeight >= 0.5
            ? knn.predictedLabel
            : mem.predictedLabel;

    return {
      knn, memory: mem,
      finalLabel,
      finalConfidence: adjustConfidence(blended, labeledCount, allSessions.length),
      confidenceBreakdown: {
        knnWeight:        Math.round(knnWeight * 100) / 100,
        memoryWeight:     Math.round(memoryWeight * 100) / 100,
        knnConfidence:    knn.confidence,
        memoryConfidence: mem.confidence,
        agreement,
      },
      disclaimer:            "Decision-support only · Not a clinical diagnosis",
      usingPersonalizedWeights: usingPersonalised,
    };
  }

  /* ── No data ── */
  return {
    knn: null, memory: null,
    finalLabel: "acceptable",
    finalConfidence: 0.3,
    confidenceBreakdown: { knnWeight: 0, memoryWeight: 0, knnConfidence: 0, memoryConfidence: 0, agreement: false },
    disclaimer: "Decision-support only · Not a clinical diagnosis",
    usingPersonalizedWeights: false,
  };
}

/** Apply session-count and label-count penalties to raw confidence. */
function adjustConfidence(raw: number, labeledCount: number, totalSessions: number): number {
  let c = raw;
  // Penalise sparse data
  if (totalSessions < 5)   c *= 0.75;
  if (labeledCount < MIN_LABELED_SESSIONS) c *= 0.70;
  return Math.round(Math.max(0.10, Math.min(1, c)) * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Decision engine
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Generate a single clinical decision recommendation.
 *
 * Priority order (highest to lowest):
 *  1. Any high-severity risk flag OR "unsafe" prediction → flag_clinician_review
 *  2. Any high-fatigue risk + poor label → decrease_difficulty
 *  3. Medium risk flag + poor/unsafe → pause_advancement
 *  4. Two+ consecutive quality ≥ 75 + no risk + improving trend → increase_difficulty
 *  5. Poor label + declining → decrease_difficulty
 *  6. Default → maintain_current
 *
 * All actions except maintain_current set requiresClinicianApproval = true.
 */
export function generateDecision(
  sessions:  SessionRecord[],
  memory:    PatientMemory,
  hybrid:    HybridPrediction,
): Decision {
  const DISCLAIMER = "Decision-support only · Not a clinical diagnosis";
  const reasoning: string[] = [];

  const riskFlags   = memory.riskFlags;
  const highRisk    = riskFlags.filter((f) => f.severity === "high");
  const mediumRisk  = riskFlags.filter((f) => f.severity === "medium");
  // Cast to string so TypeScript control-flow narrowing does not silently drop
  // enum members as we pass through early-return guard blocks.
  const finalLabel: string = hybrid.finalLabel;
  const trend       = memory.trend.overallDirection;
  const n           = sessions.length;

  /* ── 1. Safety override: high risk or unsafe ── */
  if (highRisk.length > 0 || finalLabel === "unsafe") {
    highRisk.forEach((f) => reasoning.push(`High-severity risk: ${f.description}`));
    if (finalLabel === "unsafe") reasoning.push("Prediction label: Unsafe");
    return {
      action:                    "flag_clinician_review",
      confidence:                0.92,
      urgency:                   "immediate",
      reasoning,
      requiresClinicianApproval: true,
      safetyNote:                "Do not advance programme intensity until clinician has reviewed the session data.",
      disclaimer:                DISCLAIMER,
    };
  }

  /* ── 1.5. First/second session — insufficient history for strong conclusions ── */
  if (n <= 1) {
    reasoning.push(
      n === 0
        ? "No sessions recorded — cannot generate a recommendation."
        : "First recorded session — establishing baseline. Insufficient history for clinical conclusions.",
    );
    return {
      action:                    "maintain_current",
      confidence:                0.50,
      urgency:                   "routine",
      reasoning,
      requiresClinicianApproval: false,
      safetyNote:                "Allow 2–3 sessions before drawing clinical conclusions. Continue observing and recording.",
      disclaimer:                DISCLAIMER,
    };
  }

  /* ── 2. High fatigue + poor label ── */
  const fatigue = riskFlags.find((f) => f.type === "fatigue_increase");
  if (fatigue && (finalLabel === "poor" || finalLabel === "unsafe")) {
    reasoning.push("Fatigue trend detected alongside poor performance label.");
    reasoning.push("Consider adjusting session timing or rest intervals.");
    return {
      action:                    "decrease_difficulty",
      confidence:                0.78,
      urgency:                   "soon",
      reasoning,
      requiresClinicianApproval: true,
      safetyNote:                "Reduce session intensity by 10–15% until fatigue normalises.",
      disclaimer:                DISCLAIMER,
    };
  }

  /* ── 3. Medium risk + poor label → pause advancement ── */
  if (mediumRisk.length > 0 && finalLabel === "poor") {
    mediumRisk.forEach((f) => reasoning.push(`Medium risk: ${f.description}`));
    reasoning.push("Poor movement quality reinforces caution.");
    return {
      action:                    "pause_advancement",
      confidence:                0.72,
      urgency:                   "soon",
      reasoning,
      requiresClinicianApproval: true,
      safetyNote:                "Hold current targets and reassess in 2 sessions.",
      disclaimer:                DISCLAIMER,
    };
  }

  /* ── 3.5. Metric deficit or poor label (non-declining, no major risk) ──
     Catches cases where the label is "acceptable" but underlying mechanics
     are below clinical thresholds — avoids generic "Maintain Current" when
     control / quality / ROM are genuinely limiting factors.
     ROM is only cited when control and quality are not already the primary issue.
  ── */
  if (trend !== "declining") {
    const latestBio = sessions[sessions.length - 1]?.biomechanics;
    const metricLimits: string[] = [];

    if (latestBio) {
      if ((latestBio.controlScore ?? 100) < 65)
        metricLimits.push(`Step-height consistency ${Math.round(latestBio.controlScore)} (target ≥ 65)`);
      if ((latestBio.movementQualityScore ?? 100) < 65)
        metricLimits.push(`Movement quality ${Math.round(latestBio.movementQualityScore)} (target ≥ 65)`);
      // ROM only when control and quality are not already driving the decision,
      // and only when romScore is not null (i.e., ≥3 valid knee-angle samples)
      if (latestBio.romScore !== null && latestBio.romScore < 60 && metricLimits.length === 0)
        metricLimits.push(`ROM score ${Math.round(latestBio.romScore)} (target ≥ 60)`);
    }

    const isPoorLabel = finalLabel === "poor";

    if (metricLimits.length > 0 || isPoorLabel) {
      metricLimits.forEach((m) => reasoning.push(`Limiting factor: ${m}`));
      if (isPoorLabel)
        reasoning.push("Movement quality label: Poor — below expected performance level.");
      reasoning.push("Maintain current exercise with corrective focus before advancing.");
      return {
        action:                    "maintain_corrective_focus",
        confidence:                Math.max(0.55, hybrid.finalConfidence),
        urgency:                   isPoorLabel ? "soon" : "routine",
        reasoning,
        requiresClinicianApproval: false,
        safetyNote:                "Continue current exercise. Address identified limiting factors before increasing intensity.",
        disclaimer:                DISCLAIMER,
      };
    }
  }

  /* ── 4. Ready to advance ── */
  if (n >= 2 && finalLabel === "good" && trend !== "declining" && riskFlags.length === 0) {
    const last2Q = sessions
      .slice(-2)
      .map((s) => s.biomechanics?.movementQualityScore)
      .filter((v): v is number => v !== undefined);
    const last2Sym = sessions.slice(-2).map((s) => s.symmetryPct);

    if (last2Q.length >= 1 && last2Q.every((q) => q >= 72) && last2Sym.every((s) => s >= 65)) {
      reasoning.push(`Quality ≥ 72 in last ${last2Q.length} session(s).`);
      reasoning.push("Symmetry ≥ 65% — bilateral balance maintained.");
      reasoning.push(`Trend: ${trend}. No active risk flags.`);
      if (hybrid.confidenceBreakdown.agreement) reasoning.push("kNN and memory models agree.");
      return {
        action:                    "increase_difficulty",
        confidence:                hybrid.finalConfidence,
        urgency:                   "routine",
        reasoning,
        requiresClinicianApproval: true,
        safetyNote:                "Increase session targets by no more than 8–10%. Monitor symmetry closely in the next session.",
        disclaimer:                DISCLAIMER,
      };
    }
  }

  /* ── 5. Declining + poor ── */
  if (trend === "declining" && (finalLabel === "poor" || finalLabel === "unsafe")) {
    reasoning.push("Declining trend with poor session quality.");
    reasoning.push("Multiple sessions show reduced output.");
    return {
      action:                    "decrease_difficulty",
      confidence:                0.70,
      urgency:                   "soon",
      reasoning,
      requiresClinicianApproval: true,
      safetyNote:                "Review programme load, rest periods, and pain levels before next session.",
      disclaimer:                DISCLAIMER,
    };
  }

  /* ── 6. Default: maintain current ──
     Only reaches here when no limiting factors are present and the label is
     "acceptable" or "good" without reaching the advance threshold.
  ── */
  const sessionLabel  = finalLabel === "good" ? "Good" : "Acceptable";
  const trendLabel    = trend === "improving" ? "Improving" : trend === "stable" ? "Stable" : trend;
  reasoning.push(`${n} sessions reviewed — no limiting factors identified.`);
  reasoning.push(`Label: ${sessionLabel} — performance meets current programme threshold.`);
  if (trend !== "declining") reasoning.push(`Trend: ${trendLabel} — continue at current level.`);

  return {
    action:                    "maintain_current",
    confidence:                Math.max(0.50, hybrid.finalConfidence),
    urgency:                   "routine",
    reasoning,
    requiresClinicianApproval: false,
    safetyNote:                "Continue current programme. Re-evaluate after next session.",
    disclaimer:                DISCLAIMER,
  };
}
