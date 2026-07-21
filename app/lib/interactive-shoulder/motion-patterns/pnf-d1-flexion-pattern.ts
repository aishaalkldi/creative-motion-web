import type { MotionPattern } from "./motion-pattern-types";

/**
 * PNF D1 Flexion — first production clinical motion pattern.
 * Diagonal path from contralateral hip toward ipsilateral overhead reach.
 * Waypoints only; Bezier smoothing is derived at runtime.
 */
export const PNF_D1_FLEXION_PATTERN: MotionPattern = {
  id: "pnf-d1-flexion",
  nameEn: "PNF D1 Flexion",
  nameAr: "ثنى D1 PNF",
  feedbackProfileKey: "pnf-d1-flexion",
  waypoints: [
    { label: "start", x: 0.34, y: 0.66 },
    { label: "mid-low", x: 0.42, y: 0.54 },
    { label: "mid", x: 0.5, y: 0.42 },
    { label: "mid-high", x: 0.58, y: 0.32 },
    { label: "end", x: 0.66, y: 0.22 },
  ],
  pathTolerance: 0.085,
  completionProgress: 0.93,
  minAdvanceDelta: 0.004,
  supportedSides: ["left", "right"],
};

export const PNF_D1_FLEXION_FEEDBACK_PROFILE = PNF_D1_FLEXION_PATTERN.feedbackProfileKey;
