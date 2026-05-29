/**
 * MQ-SIGNAL-1B — Session-level camera visibility summary (in-memory only).
 * Landmark visibility only — not movement quality or clinical scoring.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";

export type VisibilityLabel = "good" | "fair" | "poor";

export type VisibilityLabelCounts = Record<VisibilityLabel, number>;

export const SESSION_VISIBILITY_MIN_POSE_FRAMES = 30;

export function emptyVisibilityLabelCounts(): VisibilityLabelCounts {
  return { good: 0, fair: 0, poor: 0 };
}

/** Map combined left+right hip visibility sum to a per-frame label. */
export function evaluateTrackingQualityFromHipVisSum(
  hipVisSum: number,
  visibilityGood: number,
  visibilityFair: number,
): VisibilityLabel {
  if (hipVisSum > visibilityGood) return "good";
  if (hipVisSum > visibilityFair) return "fair";
  return "poor";
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export type SessionVisibilitySummaryInput = {
  hipVisSamples: readonly number[];
  labelCounts: VisibilityLabelCounts;
  framesWithPose: number;
  visibilityGood: number;
  visibilityFair: number;
};

/**
 * Derive saved trackingQuality from the whole session (not the last frame).
 * Uses median hip visibility plus conservative downgrade gates.
 */
export function summarizeSessionVisibility(
  input: SessionVisibilitySummaryInput,
): CvTrackingQuality {
  const { hipVisSamples, labelCounts, framesWithPose, visibilityGood, visibilityFair } = input;

  if (framesWithPose < SESSION_VISIBILITY_MIN_POSE_FRAMES) {
    return "unknown";
  }

  const medianHipVis = median(hipVisSamples);
  if (medianHipVis === null) {
    return "unknown";
  }

  let quality = evaluateTrackingQualityFromHipVisSum(
    medianHipVis,
    visibilityGood,
    visibilityFair,
  );

  const fairOrBetterPct = (labelCounts.good + labelCounts.fair) / framesWithPose;
  const goodPct = labelCounts.good / framesWithPose;
  const poorPct = labelCounts.poor / framesWithPose;

  if (fairOrBetterPct < 0.5) {
    quality = "poor";
  } else if (quality === "good" && goodPct < 0.25) {
    quality = "fair";
  } else if (poorPct > 0.5) {
    quality = "poor";
  }

  return quality;
}
