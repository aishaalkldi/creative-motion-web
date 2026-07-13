/**
 * Run: npx tsx --test app/lib/cv/sts-shadow-log.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  createStsShadowSessionLog,
  recordStsShadowComparison,
  runStsShadowSessionComparison,
  summarizeStsShadowSessionLog,
} from "@/app/lib/cv/sts-shadow-log";
import { compareStsShadowFrame } from "@/app/lib/cv/sts-shadow-comparison";

function fullSyntheticLandmarks(overrides: Partial<Record<number, PoseLandmark>> = {}): PoseLandmark[] {
  const landmarks: PoseLandmark[] = [];
  for (let index = 0; index < 33; index += 1) {
    landmarks.push(overrides[index] ?? { x: 0.5, y: 0.5, visibility: 0.9 });
  }
  return landmarks;
}

function agreementLandmarks(): PoseLandmark[] {
  return fullSyntheticLandmarks({
    23: { x: 0.45, y: 0.55, visibility: 0.9 },
    24: { x: 0.55, y: 0.55, visibility: 0.9 },
  });
}

function divergentLandmarks(): PoseLandmark[] {
  return fullSyntheticLandmarks({
    23: { x: -0.05, y: 0.55, visibility: 0.9 },
    24: { x: 1.2, y: 0.55, visibility: 0.9 },
  });
}

describe("createStsShadowSessionLog / recordStsShadowComparison", () => {
  it("starts empty", () => {
    const log = createStsShadowSessionLog();
    assert.equal(log.frameCount, 0);
    assert.equal(log.divergentFrameCount, 0);
    assert.deepEqual(log.divergenceReasonCounts, {});
    assert.deepEqual(log.sampleDivergences, []);
  });

  it("counts an agreeing frame without marking it divergent", () => {
    const log = createStsShadowSessionLog();
    const comparison = compareStsShadowFrame(agreementLandmarks(), { frameIndex: 0, capturedAtMs: 0 });

    recordStsShadowComparison(log, comparison);

    assert.equal(log.frameCount, 1);
    assert.equal(log.divergentFrameCount, 0);
    assert.deepEqual(log.sampleDivergences, []);
  });

  it("counts a divergent frame and tallies its reasons", () => {
    const log = createStsShadowSessionLog();
    const comparison = compareStsShadowFrame(divergentLandmarks(), { frameIndex: 1, capturedAtMs: 100 });

    recordStsShadowComparison(log, comparison);

    assert.equal(log.frameCount, 1);
    assert.equal(log.divergentFrameCount, 1);
    assert.equal(log.sampleDivergences.length, 1);
    assert.equal(log.sampleDivergences[0], comparison);
    for (const reason of comparison.divergenceReasons) {
      assert.equal(log.divergenceReasonCounts[reason], 1);
    }
  });

  it("caps the sample of divergent comparisons at 20", () => {
    const log = createStsShadowSessionLog();
    for (let i = 0; i < 25; i += 1) {
      const comparison = compareStsShadowFrame(divergentLandmarks(), { frameIndex: i, capturedAtMs: i * 33 });
      recordStsShadowComparison(log, comparison);
    }

    assert.equal(log.frameCount, 25);
    assert.equal(log.divergentFrameCount, 25);
    assert.equal(log.sampleDivergences.length, 20);
  });
});

describe("summarizeStsShadowSessionLog", () => {
  it("computes a zero divergence rate for an empty log", () => {
    const summary = summarizeStsShadowSessionLog(createStsShadowSessionLog());
    assert.equal(summary.frameCount, 0);
    assert.equal(summary.divergenceRate, 0);
  });

  it("computes the divergence rate across a mixed session", () => {
    const log = createStsShadowSessionLog();
    recordStsShadowComparison(
      log,
      compareStsShadowFrame(agreementLandmarks(), { frameIndex: 0, capturedAtMs: 0 }),
    );
    recordStsShadowComparison(
      log,
      compareStsShadowFrame(agreementLandmarks(), { frameIndex: 1, capturedAtMs: 33 }),
    );
    recordStsShadowComparison(
      log,
      compareStsShadowFrame(divergentLandmarks(), { frameIndex: 2, capturedAtMs: 66 }),
    );

    const summary = summarizeStsShadowSessionLog(log);
    assert.equal(summary.frameCount, 3);
    assert.equal(summary.divergentFrameCount, 1);
    assert.ok(Math.abs(summary.divergenceRate - 1 / 3) < 1e-9);
  });
});

describe("runStsShadowSessionComparison", () => {
  it("runs a full synthetic session and returns a matching log and summary", () => {
    const frames = [
      { landmarks: agreementLandmarks(), context: { frameIndex: 0, capturedAtMs: 0 } },
      { landmarks: agreementLandmarks(), context: { frameIndex: 1, capturedAtMs: 33 } },
      { landmarks: divergentLandmarks(), context: { frameIndex: 2, capturedAtMs: 66 } },
      { landmarks: divergentLandmarks(), context: { frameIndex: 3, capturedAtMs: 99 } },
    ];

    const { log, summary } = runStsShadowSessionComparison(frames);

    assert.equal(log.frameCount, 4);
    assert.equal(log.divergentFrameCount, 2);
    assert.equal(summary.frameCount, 4);
    assert.equal(summary.divergentFrameCount, 2);
    assert.equal(summary.divergenceRate, 0.5);
  });

  it("returns a fully clean summary for an all-agreement session", () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({
      landmarks: agreementLandmarks(),
      context: { frameIndex: i, capturedAtMs: i * 33 },
    }));

    const { summary } = runStsShadowSessionComparison(frames);

    assert.equal(summary.frameCount, 10);
    assert.equal(summary.divergentFrameCount, 0);
    assert.equal(summary.divergenceRate, 0);
  });

  it("handles an empty session without throwing", () => {
    const { log, summary } = runStsShadowSessionComparison([]);
    assert.equal(log.frameCount, 0);
    assert.equal(summary.divergenceRate, 0);
  });
});
