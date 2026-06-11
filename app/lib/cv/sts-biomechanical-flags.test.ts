/**
 * Run: npx tsx --test app/lib/cv/sts-biomechanical-flags.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStsBiomechanicalFlags,
  STS_BIOMECH_FLAG_DISCLAIMER,
} from "@/app/lib/cv/sts-biomechanical-flags";
import { evaluateCvEvidenceIntegrity } from "@/app/lib/cv/cv-evidence-integrity-gate";
import { buildMovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";

const SUFFICIENT_INTEGRITY = evaluateCvEvidenceIntegrity({
  exerciseId: "sit-to-stand",
  completedReps: 3,
  motionPilot: {
    snapshotCount: 8,
    completeReps: 3,
    unclearReps: 0,
    trackingSignal: "good",
    showReviewBanner: false,
    phaseRatios: {
      seated: 15,
      rising: 25,
      standing: 45,
      returning: 10,
      rest: 5,
    },
    repTimings: { avgS: 2.5, fastestS: 2, slowestS: 3 },
    visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
    clinicianFlags: [],
  },
});

const LIMITED_INTEGRITY = evaluateCvEvidenceIntegrity({
  exerciseId: "sit-to-stand",
  completedReps: 3,
  motionPilot: {
    snapshotCount: 0,
    completeReps: 3,
    unclearReps: 0,
    trackingSignal: "good",
    showReviewBanner: false,
    phaseRatios: null,
    repTimings: null,
    visibilityRatios: { hip: 0, knee: 0, ankle: 0 },
    clinicianFlags: [],
  },
});

function movementQuality(
  overrides: Parameters<typeof buildMovementQualitySignals>[0] = {},
) {
  return buildMovementQualitySignals({
    exerciseId: "sit-to-stand",
    completeReps: 3,
    unclearReps: 0,
    trackingQuality: "good",
    phaseRatios: {
      seated: 15,
      rising: 25,
      standing: 45,
      returning: 10,
      rest: 5,
    },
    repTimings: { avgS: 2.5, fastestS: 2, slowestS: 3 },
    ...overrides,
  });
}

describe("buildStsBiomechanicalFlags", () => {
  it("returns null for non-STS exercises", () => {
    assert.equal(
      buildStsBiomechanicalFlags({
        exerciseId: "heel-raise",
        evidenceIntegrity: SUFFICIENT_INTEGRITY,
      }),
      null,
    );
  });

  it("returns no flags when evidence integrity is insufficient", () => {
    assert.equal(
      buildStsBiomechanicalFlags({
        exerciseId: "sit-to-stand",
        evidenceIntegrity: LIMITED_INTEGRITY,
        smtPilot: {
          snapshotCount: 0,
          completeReps: 3,
          unclearReps: 0,
          trackingSignal: "good",
          showReviewBanner: false,
          phaseRatios: { rising: 30, standing: 70 },
          repTimings: null,
          visibilityRatios: null,
          clinicianFlags: [],
        },
        movementQuality: movementQuality(),
      }),
      null,
    );
  });

  it("flags possible fast or uncontrolled lowering when returning phase is low", () => {
    const result = buildStsBiomechanicalFlags({
      exerciseId: "sit-to-stand",
      evidenceIntegrity: SUFFICIENT_INTEGRITY,
      smtPilot: SUFFICIENT_INTEGRITY.sufficientForBiomechanicalInterpretation
        ? {
            snapshotCount: 8,
            completeReps: 3,
            unclearReps: 0,
            trackingSignal: "good",
            showReviewBanner: false,
            phaseRatios: {
              seated: 15,
              rising: 25,
              standing: 50,
              returning: 8,
              rest: 2,
            },
            repTimings: { avgS: 2.8, fastestS: 1.4, slowestS: 4 },
            visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
            clinicianFlags: [],
          }
        : null,
      movementQuality: movementQuality({
        phaseRatios: {
          seated: 15,
          rising: 25,
          standing: 50,
          returning: 8,
          rest: 2,
        },
        repTimings: { avgS: 2.8, fastestS: 1.4, slowestS: 4 },
      }),
    });

    assert.ok(result);
    assert.ok(
      result!.flags.some((f) => f.id === "possible_fast_uncontrolled_lowering"),
    );
    assert.ok(
      result!.flags.every((f) => f.disclaimer === STS_BIOMECH_FLAG_DISCLAIMER),
    );
    assert.ok(
      result!.flags.every((f) => f.clinicianReviewRequired === true),
    );
  });

  it("flags possible forward trunk flexion for brief rising phase", () => {
    const result = buildStsBiomechanicalFlags({
      exerciseId: "sit-to-stand",
      evidenceIntegrity: SUFFICIENT_INTEGRITY,
      smtPilot: {
        snapshotCount: 8,
        completeReps: 3,
        unclearReps: 0,
        trackingSignal: "good",
        showReviewBanner: false,
        phaseRatios: {
          seated: 20,
          rising: 10,
          standing: 55,
          returning: 12,
          rest: 3,
        },
        repTimings: { avgS: 2.5, fastestS: 2.2, slowestS: 2.8 },
        visibilityRatios: { hip: 90, knee: 88, ankle: 86 },
        clinicianFlags: [],
      },
      movementQuality: movementQuality({
        phaseRatios: {
          seated: 20,
          rising: 10,
          standing: 55,
          returning: 12,
          rest: 3,
        },
      }),
    });

    assert.ok(
      result?.flags.some((f) => f.id === "possible_forward_trunk_flexion"),
    );
    assert.match(
      result!.flags.find((f) => f.id === "possible_forward_trunk_flexion")!
        .observedPattern,
      /forward trunk flexion/i,
    );
  });

  it("flags possible lateral shift when pacing is variable across cycles", () => {
    const result = buildStsBiomechanicalFlags({
      exerciseId: "sit-to-stand",
      evidenceIntegrity: SUFFICIENT_INTEGRITY,
      smtPilot: {
        snapshotCount: 10,
        completeReps: 3,
        unclearReps: 0,
        trackingSignal: "fair",
        showReviewBanner: false,
        phaseRatios: {
          seated: 12,
          rising: 22,
          standing: 48,
          returning: 14,
          rest: 4,
        },
        repTimings: { avgS: 2.6, fastestS: 1.2, slowestS: 4.1 },
        visibilityRatios: { hip: 85, knee: 82, ankle: 80 },
        clinicianFlags: [],
      },
      movementQuality: movementQuality({
        repTimings: { avgS: 2.6, fastestS: 1.2, slowestS: 4.1 },
      }),
    });

    assert.ok(
      result?.flags.some((f) => f.id === "possible_lateral_trunk_shift"),
    );
  });

  it("uses safe wording only", () => {
    const result = buildStsBiomechanicalFlags({
      exerciseId: "sit-to-stand",
      evidenceIntegrity: SUFFICIENT_INTEGRITY,
      smtPilot: {
        snapshotCount: 8,
        completeReps: 3,
        unclearReps: 1,
        trackingSignal: "good",
        showReviewBanner: true,
        phaseRatios: {
          seated: 15,
          rising: 8,
          standing: 52,
          returning: 6,
          rest: 19,
        },
        repTimings: { avgS: 2.5, fastestS: 1.1, slowestS: 3.8 },
        visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
        clinicianFlags: ["pose_tracking_interrupted"],
      },
      movementQuality: movementQuality({
        unclearReps: 1,
        phaseRatios: {
          seated: 15,
          rising: 8,
          standing: 52,
          returning: 6,
          rest: 19,
        },
        repTimings: { avgS: 2.5, fastestS: 1.1, slowestS: 3.8 },
      }),
    });

    const text = JSON.stringify(result).toLowerCase();
    for (const forbidden of [
      "weakness confirmed",
      "incorrect movement",
      "failed exercise",
      "treatment recommendation",
      "non-compliant",
    ]) {
      assert.equal(text.includes(forbidden), false, `forbidden: ${forbidden}`);
    }
  });
});
