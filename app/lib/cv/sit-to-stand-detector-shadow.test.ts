/**
 * MQ-REP-1 SHADOW-0 — RepQualityFsm shadow integration tests (node:test).
 * Run: npx tsx --test app/lib/cv/sit-to-stand-detector-shadow.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STS_CONFIG,
  type PatientCvMetricsPayload,
  type SitToStandDerivedMetrics,
} from "@/app/lib/cv/bio-0-contracts";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import type { CaptureFlag } from "@/app/lib/cv/rep-quality-fsm";
import {
  evaluateHipTrackingQuality,
  SitToStandDetector,
  type PoseReadiness,
  type SitToStandTrackingQuality,
} from "./sit-to-stand-detector";

type PoseLandmark = { x: number; y: number; visibility?: number };

type DetectorInternals = SitToStandDetector & {
  baselineHipY: number | null;
  repCount: number;
  poseReadiness: PoseReadiness;
  trackingQuality: SitToStandTrackingQuality | null;
  framesWithPose: number;
  framesTotal: number;
  sessionSeconds: number;
  updateRepCountFromHipY: (hipY: number, nowMs: number, torsoSpan: number | null) => void;
  tickRepQualityFsm: (
    landmarks: PoseLandmark[],
    hipY: number,
    nowMs: number,
    torsoSpan: number | null,
  ) => void;
  updatePoseReadiness: (nowMs: number, landmarks: PoseLandmark[]) => void;
  recordVisibilityFrame: (landmarks: PoseLandmark[]) => void;
};

const BASELINE_HIP = 0.55;
const TORSO_SPAN = 0.25;

const ALLOWED_CAPTURE_FLAGS: CaptureFlag[] = [
  "complete_rep",
  "incomplete_stand",
  "incomplete_return",
  "too_fast",
  "unclear_visibility",
];

const DERIVED_METRICS_KEYS: (keyof SitToStandDerivedMetrics)[] = [
  "exerciseId",
  "repCount",
  "sessionDurationS",
  "trackingQuality",
  "movementDetected",
  "framesWithPose",
  "framesTotal",
];

const API_PAYLOAD_KEYS: (keyof PatientCvMetricsPayload)[] = [
  "token",
  "sessionId",
  "exerciseId",
  "repCount",
  "sessionDurationS",
  "trackingQuality",
  "movementDetected",
  "framesWithPose",
  "framesTotal",
];

function shadowTestConfig() {
  return {
    ...DEFAULT_STS_CONFIG,
    repCountingMode: "baseline" as const,
    repQualityEnabled: true,
    repQualityShadowMode: true,
    baselineStandDelta: 0.06,
    baselineResetDelta: 0.03,
    minMsBetweenReps: 800,
    fallbackSeatedHipY: BASELINE_HIP,
    minRepDurationMs: 1200,
    repTimeoutMs: 5_000,
    readinessEnabled: false,
  };
}

function mockLandmarks(hipY: number, vis = 0.6): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: vis,
  }));
  landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.9 };
  landmarks[12] = { x: 0.6, y: 0.3, visibility: 0.9 };
  landmarks[23] = { x: 0.4, y: hipY, visibility: vis };
  landmarks[24] = { x: 0.6, y: hipY, visibility: vis };
  return landmarks;
}

function asInternals(detector: SitToStandDetector): DetectorInternals {
  return detector as unknown as DetectorInternals;
}

function primeBaseline(detector: SitToStandDetector): DetectorInternals {
  const d = asInternals(detector);
  d.baselineHipY = BASELINE_HIP;
  return d;
}

function driveFrame(
  detector: SitToStandDetector,
  hipY: number,
  nowMs: number,
  vis = 0.6,
): void {
  const d = asInternals(detector);
  const landmarks = mockLandmarks(hipY, vis);
  d.framesTotal += 1;
  d.framesWithPose += 1;
  d.trackingQuality = evaluateHipTrackingQuality(
    landmarks,
    DEFAULT_STS_CONFIG.visibilityGood,
    DEFAULT_STS_CONFIG.visibilityFair,
  );
  d.recordVisibilityFrame(landmarks);
  d.updatePoseReadiness(nowMs, landmarks);
  d.updateRepCountFromHipY(hipY, nowMs, TORSO_SPAN);
  d.tickRepQualityFsm(landmarks, hipY, nowMs, TORSO_SPAN);
}

describe("SitToStandDetector shadow RepQualityFsm", () => {
  it("keeps repQuality disabled in production patient config", () => {
    assert.equal(PATIENT_STS_CONFIG.repQualityEnabled, undefined);
    assert.equal(PATIENT_STS_CONFIG.repQualityShadowMode, undefined);
  });

  it("enables motion timeline in production patient config", () => {
    assert.equal(PATIENT_STS_CONFIG.motionTimelineEnabled, true);
  });

  it("returns null from getRepQualitySession when shadow is off", () => {
    const detector = new SitToStandDetector({ onSnapshot: () => {} }, DEFAULT_STS_CONFIG);
    assert.equal(detector.getRepQualitySession(), null);
  });

  it("leaves legacy repCount unchanged when shadow is enabled", () => {
    const baselineConfig = shadowTestConfig();
    const shadowConfig = { ...baselineConfig, repQualityEnabled: true, repQualityShadowMode: true };
    const plainConfig = { ...baselineConfig, repQualityEnabled: false, repQualityShadowMode: false };

    const plain = new SitToStandDetector({ onSnapshot: () => {} }, plainConfig);
    const shadow = new SitToStandDetector({ onSnapshot: () => {} }, shadowConfig);
    primeBaseline(plain);
    primeBaseline(shadow);

    const frames = [
      { hipY: 0.54, nowMs: 0 },
      { hipY: 0.51, nowMs: 500 },
      { hipY: 0.48, nowMs: 1000 },
      { hipY: 0.47, nowMs: 1016 },
      { hipY: 0.46, nowMs: 1032 },
      { hipY: 0.5, nowMs: 1500 },
      { hipY: 0.53, nowMs: 2200 },
      { hipY: 0.54, nowMs: 4000 },
      { hipY: 0.51, nowMs: 4900 },
      { hipY: 0.47, nowMs: 5000 },
      { hipY: 0.46, nowMs: 5016 },
      { hipY: 0.45, nowMs: 5032 },
      { hipY: 0.5, nowMs: 5500 },
      { hipY: 0.53, nowMs: 6200 },
    ];

    for (const frame of frames) {
      driveFrame(plain, frame.hipY, frame.nowMs);
      driveFrame(shadow, frame.hipY, frame.nowMs);
    }

    assert.equal(asInternals(shadow).repCount, asInternals(plain).repCount);
    assert.equal(asInternals(shadow).repCount, 2);
    assert.ok(shadow.getRepQualitySession());
  });

  it("produces complete_rep for a full sit-to-stand cycle in shadow", () => {
    const detector = new SitToStandDetector({ onSnapshot: () => {} }, shadowTestConfig());
    primeBaseline(detector);

    driveFrame(detector, 0.54, 0);
    driveFrame(detector, 0.51, 500);
    driveFrame(detector, 0.48, 1000);
    driveFrame(detector, 0.5, 1500);
    driveFrame(detector, 0.53, 2200);

    const summary = detector.getRepQualitySession();
    assert.ok(summary);
    assert.equal(summary!.reps.length, 1);
    assert.ok(summary!.reps[0]!.captureFlags.includes("complete_rep"));
  });

  it("can produce too_fast in shadow", () => {
    const detector = new SitToStandDetector({ onSnapshot: () => {} }, shadowTestConfig());
    primeBaseline(detector);

    driveFrame(detector, 0.54, 0);
    driveFrame(detector, 0.51, 150);
    driveFrame(detector, 0.48, 300);
    driveFrame(detector, 0.5, 450);
    driveFrame(detector, 0.53, 900);

    const rep = detector.getRepQualitySession()?.reps[0];
    assert.ok(rep);
    assert.ok(rep!.captureFlags.includes("too_fast"));
    assert.ok(!rep!.captureFlags.includes("complete_rep"));
  });

  it("can produce incomplete_return in shadow", () => {
    const detector = new SitToStandDetector(
      { onSnapshot: () => {} },
      { ...shadowTestConfig(), repTimeoutMs: 2_000 },
    );
    primeBaseline(detector);

    driveFrame(detector, 0.54, 0);
    driveFrame(detector, 0.51, 400);
    driveFrame(detector, 0.48, 900);
    driveFrame(detector, 0.5, 1500);
    driveFrame(detector, 0.51, 3_500);

    const rep = detector.getRepQualitySession()?.reps[0];
    assert.ok(rep);
    assert.ok(rep!.captureFlags.includes("incomplete_return"));
  });

  it("does not affect trackingQuality in getDerivedMetrics", () => {
    const plainConfig = { ...shadowTestConfig(), repQualityEnabled: false };
    const shadowConfig = { ...shadowTestConfig(), repQualityEnabled: true, repQualityShadowMode: true };

    const plain = new SitToStandDetector({ onSnapshot: () => {} }, plainConfig);
    const shadow = new SitToStandDetector({ onSnapshot: () => {} }, shadowConfig);
    primeBaseline(plain);
    primeBaseline(shadow);

    for (let i = 0; i < 35; i += 1) {
      driveFrame(plain, 0.54, i * 100);
      driveFrame(shadow, 0.54, i * 100);
    }

    assert.equal(
      plain.getDerivedMetrics().trackingQuality,
      shadow.getDerivedMetrics().trackingQuality,
    );
  });

  it("does not affect pose readiness when shadow is enabled", () => {
    const config = {
      ...shadowTestConfig(),
      readinessEnabled: true,
      readinessCheckMs: 0,
    };
    const plain = new SitToStandDetector(
      { onSnapshot: () => {} },
      { ...config, repQualityEnabled: false },
    );
    const shadow = new SitToStandDetector({ onSnapshot: () => {} }, config);
    primeBaseline(plain);
    primeBaseline(shadow);

    const landmarks = mockLandmarks(0.54);
    asInternals(plain).updatePoseReadiness(100, landmarks);
    asInternals(shadow).updatePoseReadiness(100, landmarks);

    assert.equal(asInternals(plain).poseReadiness, asInternals(shadow).poseReadiness);
  });

  it("does not add rep flags to getDerivedMetrics or patient API payload shape", () => {
    const detector = new SitToStandDetector({ onSnapshot: () => {} }, shadowTestConfig());
    primeBaseline(detector);
    driveFrame(detector, 0.54, 0);
    driveFrame(detector, 0.48, 1000);
    driveFrame(detector, 0.53, 2200);

    const metrics = detector.getDerivedMetrics();
    assert.deepEqual(Object.keys(metrics).sort(), [...DERIVED_METRICS_KEYS].sort());

    const payload: PatientCvMetricsPayload = {
      token: "t",
      sessionId: "s",
      exerciseId: metrics.exerciseId,
      repCount: metrics.repCount,
      sessionDurationS: metrics.sessionDurationS,
      trackingQuality: metrics.trackingQuality,
      movementDetected: metrics.movementDetected,
      framesWithPose: metrics.framesWithPose,
      framesTotal: metrics.framesTotal,
    };
    assert.deepEqual(Object.keys(payload).sort(), [...API_PAYLOAD_KEYS].sort());
    assert.equal("captureFlags" in metrics, false);
    assert.equal("reps" in metrics, false);
  });

  it("uses only allowed capture flag labels", () => {
    const detector = new SitToStandDetector({ onSnapshot: () => {} }, shadowTestConfig());
    primeBaseline(detector);

    driveFrame(detector, 0.54, 0);
    driveFrame(detector, 0.51, 150);
    driveFrame(detector, 0.48, 300);
    driveFrame(detector, 0.5, 450);
    driveFrame(detector, 0.53, 900);

    const summary = detector.getRepQualitySession();
    assert.ok(summary);
    for (const rep of summary!.reps) {
      for (const flag of rep.captureFlags) {
        assert.ok(ALLOWED_CAPTURE_FLAGS.includes(flag), `unexpected flag: ${flag}`);
      }
    }
  });
});
