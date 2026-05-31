/**
 * Run: npx tsx --test app/lib/cv/mini-squat-pose-detector.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PATIENT_MINI_SQUAT_CONFIG, PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import { MiniSquatDetector } from "@/app/lib/cv/mini-squat-pose-detector";
import { SitToStandDetector } from "@/app/lib/cv/sit-to-stand-detector";

describe("MiniSquatDetector", () => {
  it("uses drop polarity config separate from STS", () => {
    const detector = new MiniSquatDetector({ onSnapshot: () => {} });
    assert.notEqual(PATIENT_MINI_SQUAT_CONFIG.minMsBetweenReps, PATIENT_STS_CONFIG.minMsBetweenReps);

    const internals = detector as unknown as {
      config: { repPolarity?: string; metricsExerciseId?: string };
    };
    assert.equal(internals.config.repPolarity, "drop");
    assert.equal(internals.config.metricsExerciseId, "mini-squat");
  });

  it("getDerivedMetrics returns mini-squat exercise id", () => {
    const sts = new SitToStandDetector({ onSnapshot: () => {} }, PATIENT_STS_CONFIG);
    const mini = new MiniSquatDetector({ onSnapshot: () => {} });

    assert.equal(sts.getDerivedMetrics().exerciseId, "sit-to-stand");
    assert.equal(mini.getDerivedMetrics().exerciseId, "mini-squat");
  });
});
