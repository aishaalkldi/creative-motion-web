/**
 * MQ-SIGNAL-1B — session visibility summary unit tests (node:test).
 * Run: npx tsx --test app/lib/cv/session-visibility-summary.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STS_CONFIG,
} from "@/app/lib/cv/bio-0-contracts";
import {
  evaluateTrackingQualityFromHipVisSum,
  median,
  SESSION_VISIBILITY_MIN_POSE_FRAMES,
  summarizeSessionVisibility,
  type VisibilityLabelCounts,
} from "./session-visibility-summary";

const { visibilityGood, visibilityFair } = DEFAULT_STS_CONFIG;

function counts(good: number, fair: number, poor: number): VisibilityLabelCounts {
  return { good, fair, poor };
}

function samplesFromCounts(c: VisibilityLabelCounts): number[] {
  const out: number[] = [];
  for (let i = 0; i < c.good; i += 1) out.push(1.5);
  for (let i = 0; i < c.fair; i += 1) out.push(1.0);
  for (let i = 0; i < c.poor; i += 1) out.push(0.5);
  return out;
}

describe("evaluateTrackingQualityFromHipVisSum", () => {
  it("uses existing visibilityGood / visibilityFair thresholds", () => {
    assert.equal(evaluateTrackingQualityFromHipVisSum(1.5, visibilityGood, visibilityFair), "good");
    assert.equal(evaluateTrackingQualityFromHipVisSum(1.0, visibilityGood, visibilityFair), "fair");
    assert.equal(evaluateTrackingQualityFromHipVisSum(0.5, visibilityGood, visibilityFair), "poor");
  });
});

describe("median", () => {
  it("returns null for empty input", () => {
    assert.equal(median([]), null);
  });

  it("handles odd and even lengths", () => {
    assert.equal(median([3]), 3);
    assert.equal(median([1, 3]), 2);
    assert.equal(median([1, 2, 3]), 2);
  });
});

describe("summarizeSessionVisibility", () => {
  it("returns unknown when framesWithPose is below minimum", () => {
    const result = summarizeSessionVisibility({
      hipVisSamples: samplesFromCounts(counts(20, 5, 0)),
      labelCounts: counts(20, 5, 0),
      framesWithPose: SESSION_VISIBILITY_MIN_POSE_FRAMES - 1,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "unknown");
  });

  it("returns fair when most frames were fair despite poor last-frame median spike", () => {
    const labelCounts = counts(5, 40, 5);
    const result = summarizeSessionVisibility({
      hipVisSamples: samplesFromCounts(labelCounts),
      labelCounts,
      framesWithPose: 50,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "fair");
  });

  it("returns good when session was mostly good and goodPct gate passes", () => {
    const labelCounts = counts(40, 8, 2);
    const result = summarizeSessionVisibility({
      hipVisSamples: samplesFromCounts(labelCounts),
      labelCounts,
      framesWithPose: 50,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "good");
  });

  it("downgrades good to fair when goodPct is below 0.25", () => {
    const labelCounts = counts(10, 35, 5);
    const result = summarizeSessionVisibility({
      hipVisSamples: samplesFromCounts(labelCounts),
      labelCounts,
      framesWithPose: 50,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "fair");
  });

  it("forces poor when fairOrBetterPct is below 0.50", () => {
    const labelCounts = counts(5, 15, 30);
    const result = summarizeSessionVisibility({
      hipVisSamples: samplesFromCounts(labelCounts),
      labelCounts,
      framesWithPose: 50,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "poor");
  });

  it("forces poor when poorPct exceeds 0.50", () => {
    const labelCounts = counts(10, 10, 35);
    const result = summarizeSessionVisibility({
      hipVisSamples: samplesFromCounts(labelCounts),
      labelCounts,
      framesWithPose: 55,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "poor");
  });

  it("returns unknown when pose frame count passes but samples are missing", () => {
    const result = summarizeSessionVisibility({
      hipVisSamples: [],
      labelCounts: counts(0, 0, 0),
      framesWithPose: 40,
      visibilityGood,
      visibilityFair,
    });
    assert.equal(result, "unknown");
  });
});
