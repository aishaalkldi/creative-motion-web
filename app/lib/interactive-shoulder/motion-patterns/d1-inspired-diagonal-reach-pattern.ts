import type { MotionPattern } from "./motion-pattern-types";

/**
 * D1-Inspired Diagonal Reach — visual path inspired by a diagonal D1 line.
 * This is not presented or validated as clinically accurate PNF.
 */
export const D1_INSPIRED_DIAGONAL_REACH_PATTERN: MotionPattern = {
  id: "d1-inspired-diagonal-reach",
  nameEn: "D1-Inspired Diagonal Reach",
  nameAr: "الوصول القطري المستوحى من D1",
  feedbackProfileKey: "d1-inspired-diagonal-reach",
  waypoints: [
    { label: "start", x: 0.34, y: 0.66 },
    { label: "mid-low", x: 0.42, y: 0.54 },
    { label: "mid", x: 0.5, y: 0.42 },
    { label: "mid-high", x: 0.58, y: 0.32 },
    { label: "end", x: 0.66, y: 0.22 },
  ],
  progression: {
    startAcquisitionMaxProgress: 0.18,
    maxForwardProgressWindow: 0.1,
    reacquisitionProgressWindow: 0.08,
    minimumAcceptedSamples: 8,
    pathTolerance: 0.085,
    completionProgress: 0.93,
    minAdvanceDelta: 0.004,
    reverseTolerance: 0.02,
  },
  supportedSides: ["left", "right"],
};

export const D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE =
  D1_INSPIRED_DIAGONAL_REACH_PATTERN.feedbackProfileKey;
