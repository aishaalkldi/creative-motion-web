/**
 * PR118 — Activity/keyword biomechanical review rules.
 * Therapist review prompts only. No diagnosis or pathology labels.
 */

export type BiomechanicalRegionTag =
  | "Knee"
  | "Shoulder"
  | "Neck"
  | "Ankle / foot"
  | "Hip"
  | "Balance and gait"
  | "Upper limb"
  | "Low back"
  | "General MSK";

export type BiomechanicalReviewRule = {
  id: string;
  patterns: RegExp[];
  regionTags?: BiomechanicalRegionTag[];
  movementForReview: string[];
  muscleForReview: string[];
  objectiveForReview: string[];
};

export const BIOMECHANICAL_REVIEW_RULES: BiomechanicalReviewRule[] = [
  {
    id: "shoulder-overhead",
    patterns: [
      /\b(comb\s*(?:my\s*)?hair|wash\s*(?:my\s*)?hair|overhead|above\s*(?:the\s*)?head)\b/i,
      /\b(reach(?:ing)?\s*(?:up|over|above)|arm\s*over\s*head)\b/i,
    ],
    regionTags: ["Shoulder"],
    movementForReview: [
      "shoulder flexion",
      "shoulder abduction",
      "shoulder external rotation",
      "scapulohumeral coordination",
    ],
    muscleForReview: ["deltoid", "rotator cuff", "scapular stabilizers"],
    objectiveForReview: [
      "active range of motion observation",
      "passive range of motion observation",
      "overhead reach task observation",
    ],
  },
  {
    id: "shoulder-behind-back",
    patterns: [
      /\b(behind\s*(?:the\s*)?back|hand\s*behind\s*back)\b/i,
      /\b(bra\s*clasp|do\s*(?:my\s*)?bra|put\s*on\s*(?:a\s*)?bra)\b/i,
      /\b(jacket|coat)\b/i,
    ],
    regionTags: ["Shoulder"],
    movementForReview: [
      "shoulder internal rotation",
      "shoulder extension",
      "hand-behind-back movement",
    ],
    muscleForReview: ["rotator cuff", "posterior deltoid", "scapular stabilizers"],
    objectiveForReview: [
      "hand-behind-back task observation",
      "active range of motion observation",
      "passive range of motion observation",
    ],
  },
  {
    id: "stairs-overlap",
    patterns: [/\b(stairs?|step(?:s)?\s*up|climb(?:ing)?\s*(?:the\s*)?stairs?)\b/i],
    regionTags: ["Knee", "Hip"],
    movementForReview: [
      "knee flexion",
      "knee extension",
      "stair negotiation",
      "hip flexion",
      "single-leg loading",
    ],
    muscleForReview: ["quadriceps", "hamstrings", "gluteus medius", "hip flexors"],
    objectiveForReview: [
      "step-up or stair negotiation observation",
      "single-leg stance observation",
      "functional stair task observation",
    ],
  },
  {
    id: "walking-tolerance",
    patterns: [/\b(walk(?:ing)?|gait|march(?:ing)?)\b/i],
    regionTags: ["Balance and gait"],
    movementForReview: ["walking tolerance", "step length symmetry", "turning"],
    muscleForReview: ["quadriceps", "gluteus medius", "calf complex"],
    objectiveForReview: ["timed walking observation", "gait observation"],
  },
  {
    id: "low-back-transfers",
    patterns: [
      /\b(sitting(?:\s*for|\s*to)?|prolonged\s*sit)\b/i,
      /\b(getting\s*up|get\s*up|rising\s*from|stand(?:ing)?\s*from\s*(?:a\s*)?(?:chair|seat))\b/i,
      /\b(sit[\s-]*to[\s-]*stand)\b/i,
    ],
    regionTags: ["Low back"],
    movementForReview: [
      "functional trunk control",
      "lumbopelvic coordination",
      "sit-to-stand mechanics",
    ],
    muscleForReview: ["core stabilizers", "lumbar extensors", "hip extensors"],
    objectiveForReview: [
      "sit-to-stand observation",
      "functional task tolerance observation",
      "transfers observation",
    ],
  },
];

export function matchBiomechanicalRules(corpus: string): BiomechanicalReviewRule[] {
  const normalized = corpus.trim();
  if (!normalized) return [];
  return BIOMECHANICAL_REVIEW_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalized)),
  );
}
