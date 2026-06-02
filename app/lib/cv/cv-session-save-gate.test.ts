/**
 * Run: npx tsx --test app/lib/cv/cv-session-save-gate.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { CV_MIN_SAVE_DURATION_S, PATIENT_SLS_HOLD_CONFIG } from "@/app/lib/cv/cv-patient-config";
import { isCvMetricsEligibleForSave } from "@/app/lib/cv/cv-session-save-gate";

function stsMetrics(
  overrides: Partial<PatientCvDerivedMetrics> = {},
): PatientCvDerivedMetrics {
  return {
    exerciseId: "sit-to-stand",
    repCount: 2,
    sessionDurationS: CV_MIN_SAVE_DURATION_S,
    trackingQuality: "good",
    movementDetected: true,
    framesWithPose: 100,
    framesTotal: 120,
    ...overrides,
  } as PatientCvDerivedMetrics;
}

function slsMetrics(
  overrides: Partial<PatientCvDerivedMetrics> = {},
): PatientCvDerivedMetrics {
  return {
    exerciseId: "single-leg-stance",
    repCount: 0,
    sessionDurationS: 0,
    trackingQuality: "fair",
    movementDetected: false,
    framesWithPose: 50,
    framesTotal: 60,
    ...overrides,
  } as PatientCvDerivedMetrics;
}

describe("isCvMetricsEligibleForSave", () => {
  it("STS allows save at wall-clock CV_MIN_SAVE_DURATION_S", () => {
    assert.equal(isCvMetricsEligibleForSave(stsMetrics({ sessionDurationS: CV_MIN_SAVE_DURATION_S })), true);
    assert.equal(
      isCvMetricsEligibleForSave(stsMetrics({ sessionDurationS: CV_MIN_SAVE_DURATION_S - 1 })),
      false,
    );
  });

  it("mini-squat uses wall-clock threshold like STS", () => {
    const metrics = stsMetrics({
      exerciseId: "mini-squat",
      sessionDurationS: CV_MIN_SAVE_DURATION_S,
    });
    assert.equal(isCvMetricsEligibleForSave(metrics), true);
    assert.equal(
      isCvMetricsEligibleForSave({ ...metrics, sessionDurationS: CV_MIN_SAVE_DURATION_S - 1 }),
      false,
    );
  });

  it("SLS allows save when movementDetected is true", () => {
    assert.equal(
      isCvMetricsEligibleForSave(
        slsMetrics({
          sessionDurationS: 0,
          movementDetected: true,
        }),
      ),
      true,
    );
  });

  it("SLS rejects save when hold under threshold and movement not detected", () => {
    assert.equal(
      isCvMetricsEligibleForSave(
        slsMetrics({
          sessionDurationS: PATIENT_SLS_HOLD_CONFIG.minSaveHoldS - 1,
          movementDetected: false,
        }),
      ),
      false,
    );
  });

  it("SLS allows save when accumulated hold meets minSaveHoldS even if movementDetected is false", () => {
    assert.equal(
      isCvMetricsEligibleForSave(
        slsMetrics({
          sessionDurationS: PATIENT_SLS_HOLD_CONFIG.minSaveHoldS,
          movementDetected: false,
        }),
      ),
      true,
    );
  });
});
