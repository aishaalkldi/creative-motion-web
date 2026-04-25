/**
 * gait-progression.ts
 *
 * Structured Gait Progression Framework — Creative Motion Rehabilitation
 * ────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE
 * ───────
 * This file is the single source of truth for the gait exercise progression
 * system. It defines:
 *   • The progression table (exercises, clinical goals, CV metrics, rules)
 *   • Derived metric computation from raw SessionRecord data
 *   • Rule evaluation (success, progression eligibility)
 *   • A recommendation engine that reads current report findings and returns
 *     the most appropriate next exercise with clinical reasoning
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * 1. Exercise order is not strictly linear — each exercise has its own
 *    "recommended when" conditions so the system can branch to a corrective
 *    exercise at any point if a specific deficit appears.
 * 2. Every rule is measurable from existing CV metrics (SessionRecord +
 *    BiomechanicsData). No manual assessment required.
 * 3. All recommendations are decision-support only — therapist approval
 *    is required before any programme change.
 * 4. Obstacle March is registered but marked available: false until
 *    implemented.
 *
 * CURRENT PROGRESSION MAP
 * ───────────────────────
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  1. High Knee March  ──▶  2. Rhythm March  ──▶  3. Side Stepping   │
 *  │        │                        │                       │           │
 *  │        └────────────────────────┴───────────────────────┤           │
 *  │                                                          ▼           │
 *  │                                          4. Targeted Correction Mode│
 *  │                                                          │           │
 *  │                                             (feeds back to 1–3)     │
 *  │                                                                      │
 *  │  5. Obstacle March  (not yet available)                              │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 * Safety
 * ──────
 * Decision-support only · Not a clinical diagnosis.
 * All progression changes require clinician review and approval.
 */

import type { SessionRecord } from "../session-store";
import type { Classification } from "./progress-engine";
import type { RiskFlag } from "./patient-memory";

/* ═══════════════════════════════════════════════════════════════════════════
   Metric keys
═══════════════════════════════════════════════════════════════════════════ */

/**
 * All CV metrics that can be referenced in success rules and recommendation
 * conditions. Direct fields come from SessionRecord / BiomechanicsData.
 * Derived fields are computed by extractDerivedMetrics().
 */
export type CVMetricKey =
  // ── Direct session metrics ──
  | "totalSteps"           // absolute step count
  | "symmetryPct"          // bilateral symmetry 0–100
  | "stepsPerMin"          // cadence
  | "fatigueIndex"         // 0 = no fatigue, 1 = severe
  | "cameraVisibilityScore"
  // ── Biomechanics scores ──
  | "romScore"             // range of motion 0–100
  | "postureScore"         // postural stability 0–100
  | "controlScore"         // movement control 0–100
  | "symmetryScore"        // biomechanical symmetry 0–100
  | "movementQualityScore" // composite 0–100
  // ── Derived / computed ──
  | "avgKneeAngle"         // (L + R knee angle) / 2, degrees
  | "kneeAngleAsymmetry"   // |L − R knee angle|, degrees
  | "avgHipAngle"          // (L + R hip angle) / 2, degrees
  | "hipAngleAsymmetry"    // |L − R hip angle|, degrees
  | "avgKneeHeight"        // (L + R normalised knee height) / 2 × 100
  | "kneeHeightAsymmetry"; // |L − R normalised knee height| × 100

/* ═══════════════════════════════════════════════════════════════════════════
   Rule types
═══════════════════════════════════════════════════════════════════════════ */

export type RuleOperator = ">=" | "<=" | "range" | "<" | ">";

/**
 * A single measurable condition on a CV metric.
 * `range` requires both threshold (min) and thresholdMax (max).
 */
export interface SuccessRule {
  metric:        CVMetricKey;
  operator:      RuleOperator;
  threshold:     number;
  thresholdMax?: number;   // used with "range" operator
  description:   string;   // human-readable explanation
}

/**
 * Defines how many consecutive sessions must meet all successRules before the
 * patient is considered ready to progress to the next exercise.
 */
export interface ProgressionRule {
  consecutiveSessions: number;
  rules:               SuccessRule[];
  /** Plain English summary for the therapist / report. */
  description:         string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Recommendation condition types
═══════════════════════════════════════════════════════════════════════════ */

export type RecommendationTriggerType =
  | "first_session"       // no prior sessions for this patient
  | "metric_below"        // a CV metric is below a threshold
  | "metric_above"        // a CV metric is above a threshold
  | "metric_asymmetry"    // left/right asymmetry exceeds threshold
  | "classification"      // progress-engine classification matches
  | "risk_flag"           // a patient-memory risk flag is active
  | "ml_prediction"       // ml-engine predicted label matches
  | "after_exercise"      // current exercise has been passed
  | "regression";         // classification = "Declining" after a specific exercise

export interface RecommendationTrigger {
  type:           RecommendationTriggerType;
  /** CV metric key (for metric_* triggers). */
  metric?:        CVMetricKey;
  threshold?:     number;
  /** Classification label (for classification/regression triggers). */
  classification?: Classification;
  /** Risk flag type string (for risk_flag trigger). */
  riskFlagType?:  RiskFlag["type"];
  /** Exercise id that must have been passed (for after_exercise trigger). */
  exerciseId?:    string;
  /** ML prediction label (for ml_prediction trigger). */
  mlLabel?:       string;
  /** Human-readable explanation of this trigger. */
  description:    string;
}

export interface RecommendationCondition {
  /** If "any", one trigger is enough. If "all", every trigger must be true. */
  logic:    "any" | "all";
  triggers: RecommendationTrigger[];
  /** Clinical priority: primary = default progression; corrective = override. */
  priority: "primary" | "corrective" | "recovery";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Core exercise type
═══════════════════════════════════════════════════════════════════════════ */

export interface GaitExercise {
  id:                   string;
  name:                 string;
  /** Ordered position in the standard progression (1 = first). */
  order:                number;
  /** Whether this exercise is available in the current build. */
  available:            boolean;

  /* ── Clinical framework ── */
  gaitComponent:        string;
  /** Full clinical rationale for this exercise. */
  clinicalGoal:         string;

  /* ── Metrics ── */
  primaryMetric:        CVMetricKey;
  supportingMetrics:    CVMetricKey[];

  /* ── Session success criteria (must ALL pass) ── */
  successRules:         SuccessRule[];

  /* ── Coaching ── */
  /** Full instruction shown in the report / therapist view. */
  clinicalCue:          string;
  /** Short version shown in-game during exercise. */
  clinicalCueShort:     string;

  /* ── Progression ── */
  progressionRule:      ProgressionRule;

  /* ── Recommendation engine ── */
  recommendedWhen:      RecommendationCondition;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Recommendation output
═══════════════════════════════════════════════════════════════════════════ */

export interface ExerciseRecommendation {
  exercise:            GaitExercise;
  urgency:             "required" | "suggested" | "ready_to_advance";
  /** List of specific findings that drove this recommendation. */
  supportingFindings:  string[];
  /** Single-sentence clinical rationale. */
  clinicalRationale:   string;
  /** True if a human review should happen before this is communicated to the patient. */
  requiresClinicianReview: boolean;
  disclaimer:          string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Derived metrics
═══════════════════════════════════════════════════════════════════════════ */

/** All CV metrics as a flat record, including computed values. */
export interface DerivedMetrics extends Record<CVMetricKey, number> {}

/**
 * Compute the full flat DerivedMetrics map from a SessionRecord.
 * Fields that cannot be computed (e.g. missing biomechanics) default to −1
 * so that ">= threshold" rules safely fail for those sessions.
 */
export function extractDerivedMetrics(s: SessionRecord): DerivedMetrics {
  const b = s.biomechanics;
  const lk = b?.avgLeftKneeAngle   ?? -1;
  const rk = b?.avgRightKneeAngle  ?? -1;
  const lh = b?.avgLeftHipAngle    ?? -1;
  const rh = b?.avgRightHipAngle   ?? -1;
  const lkh = b?.avgLeftKneeHeight  ?? -1;
  const rkh = b?.avgRightKneeHeight ?? -1;

  return {
    totalSteps:            s.totalSteps,
    symmetryPct:           s.symmetryPct,
    stepsPerMin:           s.stepsPerMin,
    fatigueIndex:          s.fatigueIndex          ?? 0,
    cameraVisibilityScore: s.cameraVisibilityScore ?? 0,
    romScore:              b?.romScore              ?? -1,
    postureScore:          b?.postureScore          ?? -1,
    controlScore:          b?.controlScore          ?? -1,
    symmetryScore:         b?.symmetryScore         ?? -1,
    movementQualityScore:  b?.movementQualityScore  ?? -1,
    avgKneeAngle:
      lk >= 0 && rk >= 0 ? (lk + rk) / 2 : -1,
    kneeAngleAsymmetry:
      lk >= 0 && rk >= 0 ? Math.abs(lk - rk) : -1,
    avgHipAngle:
      lh >= 0 && rh >= 0 ? (lh + rh) / 2 : -1,
    hipAngleAsymmetry:
      lh >= 0 && rh >= 0 ? Math.abs(lh - rh) : -1,
    avgKneeHeight:
      lkh >= 0 && rkh >= 0 ? ((lkh + rkh) / 2) * 100 : -1,
    kneeHeightAsymmetry:
      lkh >= 0 && rkh >= 0 ? Math.abs(lkh - rkh) * 100 : -1,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rule evaluation
═══════════════════════════════════════════════════════════════════════════ */

/** Returns true when the metric value satisfies the rule. */
export function evaluateRule(rule: SuccessRule, metrics: DerivedMetrics): boolean {
  const v = metrics[rule.metric];
  if (v < 0) return false; // missing data — conservatively fail
  switch (rule.operator) {
    case ">=":    return v >= rule.threshold;
    case "<=":    return v <= rule.threshold;
    case ">":     return v >  rule.threshold;
    case "<":     return v <  rule.threshold;
    case "range": return v >= rule.threshold && v <= (rule.thresholdMax ?? Infinity);
    default:      return false;
  }
}

/** Returns true when ALL success rules pass for the given session. */
export function sessionPassesExercise(
  exercise: GaitExercise,
  session:  SessionRecord,
): boolean {
  const m = extractDerivedMetrics(session);
  return exercise.successRules.every((r) => evaluateRule(r, m));
}

/** Returns true when ALL success rules pass for the given metrics record. */
export function metricsPassRules(
  rules:   SuccessRule[],
  metrics: DerivedMetrics,
): boolean {
  return rules.every((r) => evaluateRule(r, metrics));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Progression eligibility check
═══════════════════════════════════════════════════════════════════════════ */

export interface ProgressionStatus {
  eligible:            boolean;
  /** How many consecutive passing sessions the patient has achieved. */
  consecutivePassing:  number;
  /** How many are required. */
  consecutiveRequired: number;
  /** The last N sessions and whether each passed. */
  sessionResults:      Array<{ date: string; passed: boolean }>;
}

/**
 * Check whether a patient has met the progression rule for an exercise.
 * Only the most recent `progressionRule.consecutiveSessions` sessions are
 * examined.
 */
export function checkProgressionEligibility(
  exercise: GaitExercise,
  sessions: SessionRecord[],
): ProgressionStatus {
  const needed = exercise.progressionRule.consecutiveSessions;
  const rules  = exercise.progressionRule.rules;
  const recent = sessions.slice(-Math.min(needed + 2, sessions.length)); // small buffer
  const results = recent.map((s) => ({
    date:   s.date,
    passed: metricsPassRules(rules, extractDerivedMetrics(s)),
  }));

  // Count trailing consecutive passes
  let consecutive = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].passed) consecutive++;
    else break;
  }

  return {
    eligible:           consecutive >= needed,
    consecutivePassing: consecutive,
    consecutiveRequired: needed,
    sessionResults:     results,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PROGRESSION TABLE
   ─────────────────────
   All clinical values (thresholds, cues, rules) are defined here.
   Game logic and the rehab report read from this table — they do not
   hard-code clinical knowledge internally.
═══════════════════════════════════════════════════════════════════════════ */

export const GAIT_PROGRESSION_TABLE: GaitExercise[] = [

  /* ══════════════════════════════════════════════════════════════════════
     1. HIGH KNEE MARCH
  ══════════════════════════════════════════════════════════════════════ */
  {
    id:        "high_knee_march",
    name:      "High Knee March",
    order:     1,
    available: true,

    gaitComponent: "Swing phase — limb clearance and knee flexion",
    clinicalGoal:
      "Restore adequate active knee flexion during the swing phase. " +
      "Establish a bilateral marching baseline (cadence, symmetry, repetition) " +
      "from which all subsequent exercises progress.",

    primaryMetric:     "romScore",
    supportingMetrics: ["symmetryPct", "totalSteps", "avgKneeAngle", "kneeAngleAsymmetry"],

    successRules: [
      {
        metric: "romScore", operator: ">=", threshold: 65,
        description: "ROM score ≥ 65 — adequate active knee flexion range achieved",
      },
      {
        metric: "symmetryPct", operator: ">=", threshold: 72,
        description: "Symmetry ≥ 72% — bilateral limb loading is acceptably balanced",
      },
      {
        metric: "totalSteps", operator: ">=", threshold: 25,
        description: "≥ 25 steps per session — minimum movement volume for clinical benefit",
      },
    ],

    clinicalCue:
      "Lift each knee toward hip height with a controlled, rhythmic motion. " +
      "Keep your core engaged and your back upright throughout. " +
      "Aim for equal height on both sides.",
    clinicalCueShort: "Lift knees high — match left and right height",

    progressionRule: {
      consecutiveSessions: 3,
      rules: [
        { metric: "romScore",      operator: ">=", threshold: 65, description: "ROM ≥ 65" },
        { metric: "symmetryPct",   operator: ">=", threshold: 75, description: "Symmetry ≥ 75%" },
        { metric: "totalSteps",    operator: ">=", threshold: 28, description: "≥ 28 steps" },
      ],
      description:
        "3 consecutive sessions with ROM ≥ 65, symmetry ≥ 75%, and ≥ 28 steps.",
    },

    recommendedWhen: {
      logic:    "any",
      priority: "primary",
      triggers: [
        {
          type: "first_session",
          description: "No prior sessions — establishing baseline with High Knee March.",
        },
        {
          type: "classification", classification: "Baseline",
          description: "Classification = Baseline — patient is at the start of their programme.",
        },
        {
          type: "metric_below", metric: "romScore", threshold: 60,
          description: "ROM score < 60 — knee flexion is below functional threshold.",
        },
        {
          type: "regression", classification: "Declining",
          exerciseId: "rhythm_march",
          description: "Performance declining after Rhythm March — return to foundational march.",
        },
        {
          type: "ml_prediction", mlLabel: "unsafe",
          description: "Unsafe session predicted — revert to simplest baseline exercise.",
        },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════════════════════
     2. RHYTHM MARCH
  ══════════════════════════════════════════════════════════════════════ */
  {
    id:        "rhythm_march",
    name:      "Rhythm March",
    order:     2,
    available: true,

    gaitComponent: "Cadence — temporal symmetry and step timing consistency",
    clinicalGoal:
      "Develop consistent bilateral step timing locked to an external rhythmic cue. " +
      "Improve cadence regularity and reduce inter-step time variability, " +
      "building automaticity of the gait pattern.",

    primaryMetric:     "controlScore",
    supportingMetrics: ["symmetryPct", "stepsPerMin", "movementQualityScore"],

    successRules: [
      {
        metric: "controlScore", operator: ">=", threshold: 72,
        description: "Control score ≥ 72 — step height is consistent across repetitions",
      },
      {
        metric: "symmetryPct", operator: ">=", threshold: 78,
        description: "Symmetry ≥ 78% — left and right cadence contribution is balanced",
      },
      {
        metric: "stepsPerMin", operator: "range", threshold: 70, thresholdMax: 110,
        description: "Cadence 70–110 steps/min — within the functional marching range",
      },
    ],

    clinicalCue:
      "March in time with the beat. Let the rhythm guide your step rate. " +
      "Keep a steady pace from start to finish — don't accelerate or slow down. " +
      "Equal weight through both legs.",
    clinicalCueShort: "Stay on the beat — keep your pace steady",

    progressionRule: {
      consecutiveSessions: 3,
      rules: [
        { metric: "controlScore",  operator: ">=", threshold: 72,  description: "Control ≥ 72"          },
        { metric: "symmetryPct",   operator: ">=", threshold: 80,  description: "Symmetry ≥ 80%"         },
        { metric: "stepsPerMin",   operator: "range", threshold: 75, thresholdMax: 108,
          description: "Cadence 75–108 spm"                                                               },
        { metric: "movementQualityScore", operator: ">=", threshold: 68, description: "Quality ≥ 68"     },
      ],
      description:
        "3 consecutive sessions with control ≥ 72, symmetry ≥ 80%, cadence 75–108 spm, quality ≥ 68.",
    },

    recommendedWhen: {
      logic:    "any",
      priority: "primary",
      triggers: [
        {
          type: "after_exercise", exerciseId: "high_knee_march",
          description: "High Knee March progression criteria met — advance to cadence training.",
        },
        {
          type: "metric_below", metric: "controlScore", threshold: 70,
          description: "Control score < 70 — step-height consistency is low; rhythm training may help.",
        },
        {
          type: "classification", classification: "Improving",
          description:
            "Patient is improving overall but may benefit from rhythm-locked cadence training.",
        },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════════════════════
     3. SIDE STEPPING
  ══════════════════════════════════════════════════════════════════════ */
  {
    id:        "side_stepping",
    name:      "Side Stepping",
    order:     3,
    available: true,

    gaitComponent: "Frontal plane stability — lateral weight shift and hip abductor control",
    clinicalGoal:
      "Improve hip abductor strength, lateral dynamic balance, and frontal plane " +
      "postural control. Address left/right asymmetry in weight-bearing that " +
      "High Knee and Rhythm March do not target.",

    primaryMetric:     "postureScore",
    supportingMetrics: ["symmetryPct", "controlScore", "kneeAngleAsymmetry", "hipAngleAsymmetry"],

    successRules: [
      {
        metric: "postureScore", operator: ">=", threshold: 72,
        description: "Posture score ≥ 72 — adequate frontal plane trunk stability",
      },
      {
        metric: "symmetryPct", operator: ">=", threshold: 76,
        description: "Symmetry ≥ 76% — bilateral weight-shift is acceptably even",
      },
      {
        metric: "controlScore", operator: ">=", threshold: 68,
        description: "Control score ≥ 68 — step-height consistency meets threshold for lateral progression",
      },
    ],

    clinicalCue:
      "Step to the side with control — do not cross your feet. " +
      "Keep your hips level and your weight evenly distributed through each step. " +
      "Return to centre before the next step.",
    clinicalCueShort: "Hips level — step wide and return to centre",

    progressionRule: {
      consecutiveSessions: 2,
      rules: [
        { metric: "postureScore",  operator: ">=", threshold: 72, description: "Posture ≥ 72"     },
        { metric: "symmetryPct",   operator: ">=", threshold: 78, description: "Symmetry ≥ 78%"   },
        { metric: "controlScore",  operator: ">=", threshold: 68, description: "Control ≥ 68"     },
        { metric: "kneeAngleAsymmetry", operator: "<=", threshold: 14,
          description: "Knee angle asymmetry ≤ 14° — L/R loading pattern is balanced"            },
      ],
      description:
        "2 consecutive sessions with posture ≥ 72, symmetry ≥ 78%, control ≥ 68, " +
        "and knee angle asymmetry ≤ 14°.",
    },

    recommendedWhen: {
      logic:    "any",
      priority: "corrective",
      triggers: [
        {
          type: "metric_below", metric: "symmetryPct", threshold: 75,
          description: "Symmetry < 75% — lateral weight-shift asymmetry is clinically significant.",
        },
        {
          type: "risk_flag", riskFlagType: "asymmetry_increase",
          description: "Asymmetry increasing across sessions — frontal plane exercise indicated.",
        },
        {
          type: "metric_below", metric: "postureScore", threshold: 70,
          description: "Posture score < 70 — frontal plane instability detected.",
        },
        {
          type: "metric_below", metric: "kneeAngleAsymmetry", threshold: 15,
          // Note: this trigger actually fires when asymmetry is HIGH (metric_above would be clearer;
          // see the recommendation engine implementation which handles this case explicitly).
          description: "Knee angle asymmetry > 15° — significant bilateral loading imbalance.",
        },
        {
          type: "after_exercise", exerciseId: "rhythm_march",
          description: "Rhythm March criteria met — progress to frontal plane stability training.",
        },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════════════════════
     4. TARGETED CORRECTION MODE
  ══════════════════════════════════════════════════════════════════════ */
  {
    id:        "targeted_correction",
    name:      "Targeted Correction Mode",
    order:     4,
    available: true,

    gaitComponent:
      "Adaptive — automatically targets the lowest-scoring gait component",
    clinicalGoal:
      "Directly address the specific deficit identified by CV metrics rather than " +
      "continuing a standard progression. Used when any single metric falls below " +
      "the critical threshold (< 60) or a high-severity risk flag is active. " +
      "The exercise protocol is selected at runtime based on the lowest metric.",

    primaryMetric:     "movementQualityScore",   // composite — captures overall deficit
    supportingMetrics: ["romScore", "postureScore", "controlScore", "symmetryScore", "symmetryPct"],

    successRules: [
      {
        metric: "movementQualityScore", operator: ">=", threshold: 65,
        description: "Movement quality ≥ 65 — overall motor pattern is functional",
      },
      {
        // No unsafe or high-risk labels in the most recent 2 sessions.
        // Evaluated outside of metric rules (see checkProgressionEligibility notes).
        metric: "fatigueIndex", operator: "<=", threshold: 0.45,
        description: "Fatigue index ≤ 0.45 — session output is sustained, not declining",
      },
    ],

    clinicalCue:
      "Focus on the specific area highlighted by your therapist. " +
      "Quality over quantity — controlled movement is more important than speed. " +
      "Listen to the in-game coaching cues for this session.",
    clinicalCueShort: "Quality over quantity — focus on control",

    progressionRule: {
      consecutiveSessions: 2,
      rules: [
        { metric: "movementQualityScore", operator: ">=", threshold: 68,
          description: "Quality ≥ 68 for 2 sessions — deficit resolved, return to main progression" },
        { metric: "symmetryPct",          operator: ">=", threshold: 72,
          description: "Symmetry ≥ 72% — bilateral loading is acceptably balanced"                  },
      ],
      description:
        "2 consecutive sessions with movement quality ≥ 68 and symmetry ≥ 72%. " +
        "On completion, the system recommends returning to the highest passed " +
        "standard exercise.",
    },

    recommendedWhen: {
      logic:    "any",
      priority: "corrective",
      triggers: [
        {
          type: "metric_below", metric: "movementQualityScore", threshold: 60,
          description: "Movement quality < 60 — critical deficit, targeted correction required.",
        },
        {
          type: "metric_below", metric: "romScore", threshold: 55,
          description: "ROM < 55 — severe knee flexion deficit; corrective protocol needed.",
        },
        {
          type: "metric_below", metric: "postureScore", threshold: 55,
          description: "Posture < 55 — significant frontal plane instability.",
        },
        {
          type: "metric_below", metric: "controlScore", threshold: 55,
          description: "Control < 55 — severe cadence/timing inconsistency.",
        },
        {
          type: "risk_flag", riskFlagType: "quality_decline",
          description: "Movement quality declining across sessions — corrective mode indicated.",
        },
        {
          type: "risk_flag", riskFlagType: "consecutive_poor",
          description: "≥2 consecutive poor or unsafe sessions — switch to corrective protocol.",
        },
        {
          type: "classification", classification: "Needs Attention",
          description: "Classification = Needs Attention — clinical intervention recommended.",
        },
        {
          type: "ml_prediction", mlLabel: "poor",
          description: "ML prediction: Poor quality for 2+ sessions — corrective mode triggered.",
        },
      ],
    },
  },

  /* ══════════════════════════════════════════════════════════════════════
     5. OBSTACLE MARCH  (not yet available — framework placeholder)
  ══════════════════════════════════════════════════════════════════════ */
  {
    id:        "obstacle_march",
    name:      "Obstacle March",
    order:     5,
    available: false,   // ← implement in a future sprint

    gaitComponent: "Adaptive gait — anticipatory postural control and obstacle clearance",
    clinicalGoal:
      "Improve step accuracy, height adaptability, and anticipatory motor planning " +
      "for real-world environments. Requires passing all prior exercises.",

    primaryMetric:     "movementQualityScore",
    supportingMetrics: ["romScore", "controlScore", "avgKneeHeight"],

    successRules: [
      {
        metric: "movementQualityScore", operator: ">=", threshold: 78,
        description: "Quality ≥ 78 — motor pattern is sufficiently automatised",
      },
      {
        metric: "romScore",    operator: ">=", threshold: 75, description: "ROM ≥ 75",
      },
      {
        metric: "controlScore", operator: ">=", threshold: 75, description: "Control ≥ 75",
      },
    ],

    clinicalCue:
      "Lift your foot clearly over each obstacle. " +
      "Look ahead — anticipate the next obstacle before your foot lands. " +
      "Maintain your normal walking rhythm.",
    clinicalCueShort: "Lift high and look ahead",

    progressionRule: {
      consecutiveSessions: 3,
      rules: [
        { metric: "movementQualityScore", operator: ">=", threshold: 78, description: "Quality ≥ 78" },
        { metric: "romScore",             operator: ">=", threshold: 75, description: "ROM ≥ 75"     },
        { metric: "controlScore",         operator: ">=", threshold: 75, description: "Control ≥ 75" },
      ],
      description: "3 consecutive sessions with quality ≥ 78, ROM ≥ 75, control ≥ 75.",
    },

    recommendedWhen: {
      logic:    "all",
      priority: "primary",
      triggers: [
        {
          type: "after_exercise", exerciseId: "side_stepping",
          description: "Side Stepping progression criteria met.",
        },
        {
          type: "metric_above", metric: "movementQualityScore", threshold: 74,
          description: "Quality > 74 — patient has functional movement quality baseline.",
        },
      ],
    },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Lookup helpers
═══════════════════════════════════════════════════════════════════════════ */

/** Get an exercise by its id. */
export function getExercise(id: string): GaitExercise | undefined {
  return GAIT_PROGRESSION_TABLE.find((e) => e.id === id);
}

/** Get all currently available exercises in progression order. */
export function getAvailableExercises(): GaitExercise[] {
  return GAIT_PROGRESSION_TABLE
    .filter((e) => e.available)
    .sort((a, b) => a.order - b.order);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Recommendation engine
   ─────────────────────
   Reads current report findings (session history, classification, risk flags,
   optional ML label) and returns the most appropriate exercise recommendation.

   Priority order:
     1. Corrective exercises (any high-severity condition met)
     2. Primary progression (standard advancement)
     3. Recovery (regression — drop back to earlier exercise)
═══════════════════════════════════════════════════════════════════════════ */

export interface RecommendationInput {
  sessions:         SessionRecord[];
  classification?:  Classification;
  riskFlags?:       RiskFlag[];
  mlPredictionLabel?: string;   // e.g. "poor", "unsafe", "good"
  /** Id of the exercise currently assigned (if any). */
  currentExerciseId?: string;
}

/**
 * Evaluate whether a single RecommendationTrigger is active given the
 * current inputs and latest session metrics.
 */
function triggerActive(
  trigger:  RecommendationTrigger,
  input:    RecommendationInput,
  latest:   DerivedMetrics | null,
): boolean {
  const { sessions, classification, riskFlags, mlPredictionLabel, currentExerciseId } = input;

  switch (trigger.type) {

    case "first_session":
      return sessions.length === 0;

    case "metric_below":
      if (!latest || !trigger.metric || trigger.threshold === undefined) return false;
      return latest[trigger.metric] >= 0 && latest[trigger.metric] < trigger.threshold;

    case "metric_above":
      if (!latest || !trigger.metric || trigger.threshold === undefined) return false;
      return latest[trigger.metric] > trigger.threshold;

    case "metric_asymmetry":
      // Fires when the asymmetry metric EXCEEDS the threshold
      if (!latest || !trigger.metric || trigger.threshold === undefined) return false;
      return latest[trigger.metric] > trigger.threshold;

    case "classification":
      return classification === trigger.classification;

    case "risk_flag":
      return !!(riskFlags?.some((f) => f.type === trigger.riskFlagType));

    case "ml_prediction":
      return mlPredictionLabel === trigger.mlLabel;

    case "after_exercise": {
      if (!trigger.exerciseId) return false;
      const ex = getExercise(trigger.exerciseId);
      if (!ex) return false;
      return checkProgressionEligibility(ex, sessions).eligible;
    }

    case "regression":
      if (classification !== "Declining") return false;
      if (trigger.exerciseId && currentExerciseId !== trigger.exerciseId) return false;
      return true;

    default:
      return false;
  }
}

/**
 * Evaluate whether ALL (or ANY) triggers in a RecommendationCondition are
 * active, according to the condition's logic setting.
 */
function conditionActive(
  condition: RecommendationCondition,
  input:     RecommendationInput,
  latest:    DerivedMetrics | null,
): boolean {
  const results = condition.triggers.map((t) => triggerActive(t, input, latest));
  return condition.logic === "all"
    ? results.every(Boolean)
    : results.some(Boolean);
}

/**
 * Collect all active trigger descriptions for a recommendation condition.
 */
function collectFindings(
  condition: RecommendationCondition,
  input:     RecommendationInput,
  latest:    DerivedMetrics | null,
): string[] {
  return condition.triggers
    .filter((t) => triggerActive(t, input, latest))
    .map((t) => t.description);
}

/* ── Internal helpers for rationale building ──────────────────────────────── */

/** Human-readable names for CV metric keys used in clinical rationale strings. */
const METRIC_DISPLAY_NAMES: Partial<Record<CVMetricKey, string>> = {
  controlScore:         "Control score",
  movementQualityScore: "Movement quality",
  romScore:             "ROM score",
  postureScore:         "Posture score",
  symmetryPct:          "Symmetry",
  symmetryScore:        "Symmetry score",
  fatigueIndex:         "Fatigue index",
  stepsPerMin:          "Cadence",
  totalSteps:           "Total steps",
  avgKneeAngle:         "Knee angle",
};

function displayMetricName(metric: CVMetricKey): string {
  return METRIC_DISPLAY_NAMES[metric] ?? String(metric);
}

/**
 * Collect the subset of triggers in a condition that are currently active.
 * Used to pass actual trigger objects (not just descriptions) to rationale builders.
 */
function collectActiveTriggers(
  condition: RecommendationCondition,
  input:     RecommendationInput,
  latest:    DerivedMetrics | null,
): RecommendationTrigger[] {
  return condition.triggers.filter((t) => triggerActive(t, input, latest));
}

/**
 * Build an explicit, metric-specific clinical rationale for a corrective exercise.
 *
 * For each active metric_below trigger, includes the actual recorded value so
 * the output reads: "Control score < 55 (recorded: 48)".
 * Non-metric triggers (risk flags, classification) are appended after metric reasons.
 * At most 2 reasons are shown to keep the rationale concise.
 *
 * ROM is naturally excluded as a primary reason if it did not trigger — the active
 * trigger filter ensures only fired conditions appear.
 */
function buildCorrectionRationale(
  exerciseName:   string,
  activeTriggers: RecommendationTrigger[],
  latest:         DerivedMetrics | null,
): string {
  // Metric-specific parts — include actual recorded value
  const metricParts = activeTriggers
    .filter((t): t is RecommendationTrigger & { metric: CVMetricKey; threshold: number } =>
      t.type === "metric_below" && !!t.metric && t.threshold !== undefined,
    )
    .map((t) => {
      const actual     = latest ? latest[t.metric] : -1;
      const actualStr  = actual >= 0 ? ` (recorded: ${Math.round(actual)})` : "";
      return `${displayMetricName(t.metric)} < ${t.threshold}${actualStr}`;
    });

  // Non-metric trigger descriptions (risk flag, classification, ml_prediction)
  const otherParts = activeTriggers
    .filter((t) => t.type !== "metric_below")
    .map((t) => t.description)
    .slice(0, 1); // cap at one non-metric reason

  const allParts = [...metricParts, ...otherParts].slice(0, 2);

  if (allParts.length === 0) {
    return `${exerciseName} selected — corrective session recommended before returning to standard progression.`;
  }

  const factorStr = allParts.join("; ");
  return `${exerciseName} selected — ${factorStr}. Corrective session recommended before returning to standard progression.`;
}

/**
 * Main recommendation function.
 *
 * Returns the single most appropriate exercise recommendation based on current
 * report findings, or null if no clear recommendation can be made.
 *
 * Safety: all recommendations carry requiresClinicianReview = true when the
 * urgency is "required" (corrective) or when any risk flag is active.
 */
export function recommendExercise(
  input: RecommendationInput,
): ExerciseRecommendation | null {
  const { sessions, riskFlags } = input;
  const DISCLAIMER = "Decision-support only · Not a clinical diagnosis · Therapist approval required";

  const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const latest: DerivedMetrics | null = latestSession
    ? extractDerivedMetrics(latestSession)
    : null;

  const available = getAvailableExercises();

  const isFirstSession = sessions.length === 0;

  // ── Corrective exercises first (priority = "corrective") ──
  for (const ex of available) {
    if (ex.recommendedWhen.priority !== "corrective") continue;
    if (!conditionActive(ex.recommendedWhen, input, latest)) continue;

    const findings       = collectFindings(ex.recommendedWhen, input, latest);
    const activeTriggers = collectActiveTriggers(ex.recommendedWhen, input, latest);
    const hasHighRisk    = riskFlags?.some((f) => f.severity === "high") ?? false;

    return {
      exercise:           ex,
      urgency:            hasHighRisk ? "required" : "suggested",
      supportingFindings: findings,
      // Build an explicit rationale that names the actual metric values that fired,
      // so the output reads e.g. "Control score < 55 (recorded: 48)" not just a
      // generic "control deficit detected".
      clinicalRationale:  buildCorrectionRationale(ex.name, activeTriggers, latest),
      requiresClinicianReview: true,
      disclaimer:         DISCLAIMER,
    };
  }

  // ── Standard primary progression ──
  for (const ex of available) {
    if (ex.recommendedWhen.priority !== "primary") continue;
    if (!conditionActive(ex.recommendedWhen, input, latest)) continue;

    const findings    = collectFindings(ex.recommendedWhen, input, latest);
    const isAdvancing = ex.recommendedWhen.triggers.some(
      (t) => t.type === "after_exercise" && triggerActive(t, input, latest),
    );

    return {
      exercise:           ex,
      urgency:            isAdvancing ? "ready_to_advance" : "suggested",
      supportingFindings: findings,
      clinicalRationale:  isFirstSession
        // Cautious baseline language — no prior data means no clinical conclusions
        ? `First session — ${ex.name} will establish baseline gait metrics. ` +
          `Results will inform future session targets and progression decisions.`
        : isAdvancing
          ? `Progression criteria met — patient is ready to advance to ${ex.name}.`
          // Default primary: acknowledge the specific trigger, not a generic statement
          : findings.length > 0
            ? `${ex.name} is recommended based on current assessment — ${findings[0]}`
            : `${ex.name} is the recommended starting exercise based on current assessment.`,
      requiresClinicianReview: isAdvancing,
      disclaimer:         DISCLAIMER,
    };
  }

  // ── Recovery / fallback ──
  for (const ex of available) {
    if (ex.recommendedWhen.priority !== "recovery") continue;
    if (!conditionActive(ex.recommendedWhen, input, latest)) continue;

    const findings = collectFindings(ex.recommendedWhen, input, latest);
    return {
      exercise:           ex,
      urgency:            "suggested",
      supportingFindings: findings,
      clinicalRationale:  `${ex.name} is suggested as a recovery step based on recent findings.`,
      requiresClinicianReview: false,
      disclaimer:         DISCLAIMER,
    };
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Progression summary (for display in the rehab report)
═══════════════════════════════════════════════════════════════════════════ */

export interface ProgressionSummary {
  currentExercise: GaitExercise | null;
  status:          ProgressionStatus | null;
  recommendation:  ExerciseRecommendation | null;
  /** Ordered list of all available exercises with pass/not-yet status. */
  ladder:          Array<{
    exercise:  GaitExercise;
    status:    "not_started" | "in_progress" | "passed" | "not_available";
  }>;
}

/**
 * Build a full progression summary for display in the report and game UI.
 */
export function buildProgressionSummary(
  input: RecommendationInput,
): ProgressionSummary {
  const available = getAvailableExercises();
  const all       = GAIT_PROGRESSION_TABLE.sort((a, b) => a.order - b.order);

  type LadderStatus = "not_started" | "in_progress" | "passed" | "not_available";
  const ladder: Array<{ exercise: GaitExercise; status: LadderStatus }> = all.map((ex) => {
    if (!ex.available) return { exercise: ex, status: "not_available" };
    const ps = checkProgressionEligibility(ex, input.sessions);
    if (ps.eligible)               return { exercise: ex, status: "passed"      };
    if (ps.consecutivePassing > 0) return { exercise: ex, status: "in_progress" };
    if (input.sessions.length === 0) return { exercise: ex, status: "not_started" };
    const hasAnyData = input.sessions.some((s) => sessionPassesExercise(ex, s));
    return { exercise: ex, status: hasAnyData ? "in_progress" : "not_started" };
  });

  const currentEx = input.currentExerciseId
    ? getExercise(input.currentExerciseId) ?? null
    : null;

  const status = currentEx
    ? checkProgressionEligibility(currentEx, input.sessions)
    : null;

  return {
    currentExercise: currentEx,
    status,
    recommendation:  recommendExercise(input),
    ladder,
  };
}
