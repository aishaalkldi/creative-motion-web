/**
 * Run: npx tsx --test app/lib/cv/single-leg-stance-pose-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PATIENT_SLS_HOLD_CONFIG } from "@/app/lib/cv/cv-patient-config";
import {
  mockSingleLegStanceLandmarks,
  SingleLegStanceHoldDetector,
} from "@/app/lib/cv/single-leg-stance-detector";
import { SingleLegStancePoseDetector } from "@/app/lib/cv/single-leg-stance-pose-detector";

describe("SingleLegStancePoseDetector", () => {
  it("getDerivedMetrics returns single-leg-stance exercise id with repCount 0", () => {
    const detector = new SingleLegStancePoseDetector({ onSnapshot: () => {} }, "left");
    const metrics = detector.getDerivedMetrics();
    assert.equal(metrics.exerciseId, "single-leg-stance");
    assert.equal(metrics.repCount, 0);
  });

  it("getSnapshot maps accumulated hold to sessionSeconds", () => {
    const hold = new SingleLegStanceHoldDetector(PATIENT_SLS_HOLD_CONFIG, {
      stanceLeg: "left",
      useReadinessGates: false,
    });
    hold.startSession(0);
    for (let t = 0; t <= 2_000; t += 100) {
      hold.driveFrame(
        mockSingleLegStanceLandmarks("left", {
          liftAnkleY: 0.75,
          stanceAnkleY: 0.75,
        }),
        t,
      );
    }
    for (let t = 2_100; t <= 2_700; t += 50) {
      hold.driveFrame(
        mockSingleLegStanceLandmarks("left", {
          liftAnkleY: 0.55,
          stanceAnkleY: 0.75,
        }),
        t,
      );
    }
    for (let t = 2_800; t <= 6_000; t += 100) {
      hold.driveFrame(
        mockSingleLegStanceLandmarks("left", {
          liftAnkleY: 0.55,
          stanceAnkleY: 0.75,
        }),
        t,
      );
    }

    const detector = new SingleLegStancePoseDetector({ onSnapshot: () => {} }, "left");
    const internals = detector as unknown as { holdEngine: SingleLegStanceHoldDetector };
    internals.holdEngine = hold;

    const snap = detector.getSnapshot();
    assert.equal(snap.repCount, 0);
    assert.ok(snap.sessionSeconds >= 3);
    assert.equal(snap.movementDetected, true);
  });

  it("canSaveMetrics requires min hold seconds", () => {
    const detector = new SingleLegStancePoseDetector({ onSnapshot: () => {} }, "right");
    assert.equal(detector.canSaveMetrics(), false);
  });
});
