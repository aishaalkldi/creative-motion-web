/**
 * Derive 0–1 joint visibility scores from landmarks (RAM only — never persisted).
 */

import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";

function pairVisibility(a: PoseLandmark | undefined, b: PoseLandmark | undefined): number {
  return ((a?.visibility ?? 0) + (b?.visibility ?? 0)) / 2;
}

export function deriveJointVisibilityScores(landmarks: PoseLandmark[]): {
  hip: number;
  knee: number;
  ankle: number;
} {
  return {
    hip: pairVisibility(landmarks[23], landmarks[24]),
    knee: pairVisibility(landmarks[25], landmarks[26]),
    ankle: pairVisibility(landmarks[27], landmarks[28]),
  };
}

export function mapStandPhaseToMotionPhase(standPhase: "up" | "down"): "rest" | "peak" {
  return standPhase === "up" ? "peak" : "rest";
}

export function mapTrackingLabelToMotionQuality(
  label: "good" | "fair" | "poor" | null,
): "good" | "fair" | "poor" | "lost" {
  if (label === null) return "lost";
  return label;
}
