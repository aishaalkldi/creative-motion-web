/**
 * STS shadow pilot validation scenarios (Input Acquisition Layer).
 *
 * Feeds representative synthetic BlazePose landmark sequences through
 * runStsShadowSessionComparison() — no live capture, no detector wiring.
 *
 * Run: npx tsx --test app/lib/cv/sts-shadow-pilot-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  runStsShadowSessionComparison,
  type StsShadowSessionFrameInput,
} from "@/app/lib/cv/sts-shadow-log";
import type { StsShadowSessionSummary } from "@/app/lib/cv/sts-shadow-log";

const FRAME_MS = 33;

const EXPECTED_DIVERGENT_SCENARIO_IDS = [
  "framing-edge-offscreen",
  "visibility-clamp-above-one",
] as const;

type PilotScenario = {
  id: string;
  label: string;
  frames: readonly StsShadowSessionFrameInput[];
};

/** 33-point BlazePose array; hips at pilot-like sagittal framing by default. */
function mockStsLandmarks({
  hipY = 0.55,
  leftHipX = 0.4,
  rightHipX = 0.6,
  visibility = 0.75,
  leftVisibility,
  rightVisibility,
}: {
  hipY?: number;
  leftHipX?: number;
  rightHipX?: number;
  visibility?: number;
  leftVisibility?: number;
  rightVisibility?: number;
} = {}): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.9,
  }));
  landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.9 };
  landmarks[12] = { x: 0.6, y: 0.3, visibility: 0.9 };
  landmarks[23] = {
    x: leftHipX,
    y: hipY,
    visibility: leftVisibility ?? visibility,
  };
  landmarks[24] = {
    x: rightHipX,
    y: hipY,
    visibility: rightVisibility ?? visibility,
  };
  return landmarks;
}

function buildFrames(
  landmarkFactory: (frameIndex: number) => PoseLandmark[],
  frameCount: number,
  startMs = 0,
): StsShadowSessionFrameInput[] {
  return Array.from({ length: frameCount }, (_, frameIndex) => ({
    landmarks: landmarkFactory(frameIndex),
    context: {
      frameIndex,
      capturedAtMs: startMs + frameIndex * FRAME_MS,
    },
  }));
}

/** One seated → stand → seated cycle over ~2 s (60 frames @ 30 fps). */
function buildNominalPilotStsFrames(): StsShadowSessionFrameInput[] {
  return buildFrames((frameIndex) => {
    const cycle = frameIndex % 60;
    let hipY = 0.55;
    if (cycle >= 15 && cycle < 35) {
      const t = (cycle - 15) / 20;
      hipY = 0.55 - t * 0.13;
    } else if (cycle >= 35 && cycle < 50) {
      const t = (cycle - 35) / 15;
      hipY = 0.42 + t * 0.13;
    }
    return mockStsLandmarks({ hipY, visibility: 0.82 });
  }, 60);
}

/** Sustained low hip visibility — typical "step back from camera" pilot edge. */
function buildPoorVisibilityFrames(): StsShadowSessionFrameInput[] {
  return buildFrames(() => mockStsLandmarks({ visibility: 0.12 }), 30);
}

/** Fair-tier hip visibility sum (~0.7) across a short hold. */
function buildFairTierFrames(): StsShadowSessionFrameInput[] {
  return buildFrames(() => mockStsLandmarks({ visibility: 0.35 }), 20);
}

/** Good framing with intermittent left-hip off-screen (expected acquisition divergence). */
function buildFramingEdgeFrames(): StsShadowSessionFrameInput[] {
  return buildFrames((frameIndex) => {
    const offScreen = frameIndex >= 25 && frameIndex < 35;
    return mockStsLandmarks({
      hipY: 0.52,
      leftHipX: offScreen ? -0.04 : 0.4,
      visibility: 0.78,
    });
  }, 40);
}

/** Raw visibility above 1.0 — expected clamp delta divergence. */
function buildVisibilityClampFrames(): StsShadowSessionFrameInput[] {
  return buildFrames(() =>
    mockStsLandmarks({ visibility: 0.9, leftVisibility: 1.25, rightVisibility: 0.95 }),
  15);
}

const PILOT_SCENARIOS: readonly PilotScenario[] = [
  {
    id: "nominal-pilot-framing",
    label: "Nominal pilot STS (seated→stand→seated)",
    frames: buildNominalPilotStsFrames(),
  },
  {
    id: "poor-visibility",
    label: "Poor hip visibility session",
    frames: buildPoorVisibilityFrames(),
  },
  {
    id: "fair-tier-hold",
    label: "Fair-tier visibility hold",
    frames: buildFairTierFrames(),
  },
  {
    id: "framing-edge-offscreen",
    label: "Intermittent off-screen left hip",
    frames: buildFramingEdgeFrames(),
  },
  {
    id: "visibility-clamp-above-one",
    label: "Raw visibility > 1.0 (clamp delta)",
    frames: buildVisibilityClampFrames(),
  },
];

function runPilotScenario(scenario: PilotScenario): {
  id: string;
  summary: StsShadowSessionSummary;
} {
  const { summary } = runStsShadowSessionComparison(scenario.frames);
  return { id: scenario.id, summary };
}

function evaluatePilotPass(
  results: Array<{ id: string; summary: StsShadowSessionSummary }>,
): boolean {
  const unexpectedDivergence = results.filter(
    (r) =>
      r.summary.divergentFrameCount > 0 &&
      !EXPECTED_DIVERGENT_SCENARIO_IDS.includes(
        r.id as (typeof EXPECTED_DIVERGENT_SCENARIO_IDS)[number],
      ),
  );

  return (
    unexpectedDivergence.length === 0 &&
    results.find((r) => r.id === "nominal-pilot-framing")?.summary.divergentFrameCount === 0 &&
    results.find((r) => r.id === "poor-visibility")?.summary.divergentFrameCount === 0 &&
    results.find((r) => r.id === "fair-tier-hold")?.summary.divergentFrameCount === 0
  );
}

describe("STS shadow pilot validation scenarios", () => {
  it("nominal pilot STS agrees across the full seated→stand→seated cycle", () => {
    const scenario = PILOT_SCENARIOS.find((s) => s.id === "nominal-pilot-framing");
    assert.ok(scenario);
    const { summary } = runStsShadowSessionComparison(scenario.frames);

    assert.equal(summary.frameCount, 60);
    assert.equal(summary.divergentFrameCount, 0);
    assert.equal(summary.divergenceRate, 0);
  });

  it("poor hip visibility session agrees with legacy path", () => {
    const scenario = PILOT_SCENARIOS.find((s) => s.id === "poor-visibility");
    assert.ok(scenario);
    const { summary } = runStsShadowSessionComparison(scenario.frames);

    assert.equal(summary.frameCount, 30);
    assert.equal(summary.divergentFrameCount, 0);
    assert.equal(summary.divergenceRate, 0);
  });

  it("fair-tier visibility hold agrees with legacy path", () => {
    const scenario = PILOT_SCENARIOS.find((s) => s.id === "fair-tier-hold");
    assert.ok(scenario);
    const { summary } = runStsShadowSessionComparison(scenario.frames);

    assert.equal(summary.frameCount, 20);
    assert.equal(summary.divergentFrameCount, 0);
    assert.equal(summary.divergenceRate, 0);
  });

  it("intermittent off-screen left hip diverges as expected (frames 25–34)", () => {
    const scenario = PILOT_SCENARIOS.find((s) => s.id === "framing-edge-offscreen");
    assert.ok(scenario);
    const { log, summary } = runStsShadowSessionComparison(scenario.frames);

    assert.equal(summary.frameCount, 40);
    assert.equal(summary.divergentFrameCount, 10);
    assert.ok(Math.abs(summary.divergenceRate - 0.25) < 1e-9);
    assert.equal(summary.divergenceReasonCounts.tracking_quality_mismatch, 10);
    assert.equal(summary.divergenceReasonCounts.hip_visibility_sum_delta_exceeds_tolerance, 10);
    assert.equal(summary.divergenceReasonCounts.new_frame_missing_hip_joint, 10);
    assert.equal(log.sampleDivergences[0]?.frameIndex, 25);
    assert.equal(log.sampleDivergences[9]?.frameIndex, 34);
  });

  it("raw visibility above 1.0 reports clamp delta divergence only", () => {
    const scenario = PILOT_SCENARIOS.find((s) => s.id === "visibility-clamp-above-one");
    assert.ok(scenario);
    const { log, summary } = runStsShadowSessionComparison(scenario.frames);

    assert.equal(summary.frameCount, 15);
    assert.equal(summary.divergentFrameCount, 15);
    assert.equal(summary.divergenceRate, 1);
    assert.equal(summary.divergenceReasonCounts.hip_visibility_sum_delta_exceeds_tolerance, 15);
    assert.equal(summary.divergenceReasonCounts.tracking_quality_mismatch, undefined);
    assert.equal(summary.divergenceReasonCounts.new_frame_missing_hip_joint, undefined);
    for (const sample of log.sampleDivergences) {
      assert.equal(sample.legacy.trackingQuality, "good");
      assert.equal(sample.next.trackingQuality, "good");
    }
  });

  it("passes aggregate pilotPass gate across all five scenarios (165 frames)", () => {
    const results = PILOT_SCENARIOS.map(runPilotScenario);

    const totalFrames = results.reduce((n, r) => n + r.summary.frameCount, 0);
    const totalDivergent = results.reduce((n, r) => n + r.summary.divergentFrameCount, 0);

    assert.equal(results.length, 5);
    assert.equal(totalFrames, 165);
    assert.equal(totalDivergent, 25);
    assert.ok(Math.abs(totalDivergent / totalFrames - 25 / 165) < 1e-9);
    assert.equal(evaluatePilotPass(results), true);
  });
});
