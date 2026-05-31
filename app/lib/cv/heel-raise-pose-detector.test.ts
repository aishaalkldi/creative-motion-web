/**
 * Run: npx tsx --test app/lib/cv/heel-raise-pose-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PATIENT_HEEL_RAISE_READINESS_MS,
  PATIENT_HEEL_RAISE_REP_CONFIG,
} from "@/app/lib/cv/cv-patient-config";
import { HeelRaisePoseDetector } from "@/app/lib/cv/heel-raise-pose-detector";
import { LAB_HEEL_RAISE_REP_CONFIG } from "@/app/lib/cv/heel-raise-detector";

describe("HeelRaisePoseDetector", () => {
  it("uses patient rep config separate from lab defaults", () => {
    const detector = new HeelRaisePoseDetector({ onSnapshot: () => {} });
    assert.notEqual(
      PATIENT_HEEL_RAISE_REP_CONFIG.minMsBetweenReps,
      LAB_HEEL_RAISE_REP_CONFIG.minMsBetweenReps,
    );

    const internals = detector as unknown as {
      repConfig: { minMsBetweenReps?: number; minSaveDurationS?: number };
    };
    assert.equal(internals.repConfig.minMsBetweenReps, 800);
    assert.equal(internals.repConfig.minSaveDurationS, 3);
  });

  it("getDerivedMetrics returns heel-raise exercise id", () => {
    const detector = new HeelRaisePoseDetector({ onSnapshot: () => {} });
    assert.equal(detector.getDerivedMetrics().exerciseId, "heel-raise");
    assert.equal(detector.getDerivedMetrics().repCount, 0);
  });

  it("starts with checking readiness before rep engine", () => {
    const detector = new HeelRaisePoseDetector({ onSnapshot: () => {} });
    const snap = detector.getSnapshot();
    assert.equal(snap.poseReadiness, "checking");
    assert.equal(snap.repCount, 0);
    assert.equal(PATIENT_HEEL_RAISE_READINESS_MS, 2_000);
  });
});
