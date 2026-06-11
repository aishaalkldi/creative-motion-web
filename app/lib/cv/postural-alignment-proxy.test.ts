/**
 * Run: npx tsx --test app/lib/cv/postural-alignment-proxy.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALIGNMENT_PROXY_EXERCISE_IDS,
  buildPosturalAlignmentProxy,
  isAlignmentProxyExercise,
  POSTURAL_ALIGNMENT_OBSERVATION_DISCLAIMER,
  POSTURAL_ALIGNMENT_PROXY_DISCLAIMER,
  rollupPosturalAlignmentSamples,
  samplePosturalAlignmentFromLandmarks,
} from "@/app/lib/cv/postural-alignment-proxy";
import { evaluateCvEvidenceIntegrity } from "@/app/lib/cv/cv-evidence-integrity-gate";
import { buildMovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";
import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";

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
      rising: 8,
      standing: 55,
      returning: 6,
      rest: 16,
    },
    repTimings: { avgS: 2.6, fastestS: 1.2, slowestS: 4.1 },
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

function landmark(
  x: number,
  y: number,
  visibility = 0.9,
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function syntheticLandmarks(forwardShift = 0.15): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () =>
    landmark(0.5, 0.5, 0),
  );
  landmarks[11] = landmark(0.5 + forwardShift, 0.35);
  landmarks[12] = landmark(0.5 + forwardShift, 0.35);
  landmarks[23] = landmark(0.5 + forwardShift * 0.5, 0.55);
  landmarks[24] = landmark(0.5 + forwardShift * 0.5, 0.55);
  landmarks[27] = landmark(0.48, 0.9);
  landmarks[28] = landmark(0.52, 0.9);
  return landmarks;
}

describe("isAlignmentProxyExercise", () => {
  it("includes supported CV exercises", () => {
    for (const id of ALIGNMENT_PROXY_EXERCISE_IDS) {
      assert.equal(isAlignmentProxyExercise(id), true);
    }
    assert.equal(isAlignmentProxyExercise("quad-set"), false);
  });
});

describe("samplePosturalAlignmentFromLandmarks", () => {
  it("derives proxy scalars without persisting raw landmarks", () => {
    const sample = samplePosturalAlignmentFromLandmarks(syntheticLandmarks(0.14));
    assert.ok(sample);
    assert.ok(sample!.shoulderMidpoint);
    assert.ok(sample!.hipMidpoint);
    assert.ok(sample!.ankleBaseMidpoint);
    assert.ok(sample!.trunkLine);
    assert.equal(typeof sample!.forwardAlignmentShiftProxy, "number");
    assert.equal(typeof sample!.baseOfSupportProxy, "number");
    assert.ok(sample!.sampleConfidence >= 45);
  });

  it("returns null when landmarks are insufficient", () => {
    assert.equal(samplePosturalAlignmentFromLandmarks(null), null);
    assert.equal(samplePosturalAlignmentFromLandmarks([]), null);
  });
});

describe("rollupPosturalAlignmentSamples", () => {
  it("rolls up capture samples into session proxy scalars", () => {
    const samples = [
      samplePosturalAlignmentFromLandmarks(syntheticLandmarks(0.12))!,
      samplePosturalAlignmentFromLandmarks(syntheticLandmarks(0.18))!,
    ];
    const rollup = rollupPosturalAlignmentSamples(samples);
    assert.ok(rollup);
    assert.ok(rollup!.forwardAlignmentShiftProxy != null);
    assert.ok(rollup!.posturalSwayProxy != null);
  });
});

describe("buildPosturalAlignmentProxy", () => {
  it("returns null for unsupported exercises", () => {
    assert.equal(
      buildPosturalAlignmentProxy({
        exerciseId: "quad-set",
        evidenceIntegrity: SUFFICIENT_INTEGRITY,
      }),
      null,
    );
  });

  it("suppresses when evidence integrity is insufficient", () => {
    assert.equal(
      buildPosturalAlignmentProxy({
        exerciseId: "sit-to-stand",
        evidenceIntegrity: LIMITED_INTEGRITY,
        motionPilot: {
          snapshotCount: 0,
          completeReps: 3,
          unclearReps: 0,
          trackingSignal: "good",
          showReviewBanner: false,
          phaseRatios: { rising: 30, standing: 70 },
          repTimings: null,
          visibilityRatios: { hip: 0, knee: 0, ankle: 0 },
          clinicianFlags: [],
        },
      }),
      null,
    );
  });

  it("emits forward-shift observation with safe clinician wording for STS", () => {
    const movementQuality = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 3,
      unclearReps: 0,
      trackingQuality: "good",
      phaseRatios: {
        seated: 15,
        rising: 8,
        standing: 55,
        returning: 6,
        rest: 16,
      },
      repTimings: { avgS: 2.6, fastestS: 1.2, slowestS: 4.1 },
    });

    const result = buildPosturalAlignmentProxy({
      exerciseId: "sit-to-stand",
      evidenceIntegrity: SUFFICIENT_INTEGRITY,
      motionPilot: {
        snapshotCount: 8,
        completeReps: 3,
        unclearReps: 0,
        trackingSignal: "good",
        showReviewBanner: false,
        phaseRatios: {
          seated: 15,
          rising: 8,
          standing: 55,
          returning: 6,
          rest: 16,
        },
        repTimings: { avgS: 2.6, fastestS: 1.2, slowestS: 4.1 },
        visibilityRatios: { hip: 88, knee: 85, ankle: 82 },
        clinicianFlags: [],
      },
      movementQuality,
      captureRollup: samplePosturalAlignmentFromLandmarks(syntheticLandmarks(0.14)),
    });

    assert.ok(result);
    assert.equal(result!.suppressed, false);
    assert.equal(result!.label, "Camera-estimated postural alignment proxy");
    assert.match(result!.sectionNote, /not center of mass/i);
    assert.ok(
      result!.observations.some((o) => o.id === "possible_forward_shifted_trunk"),
    );
    const forwardObs = result!.observations.find(
      (o) => o.id === "possible_forward_shifted_trunk",
    );
    assert.ok(forwardObs);
    assert.match(forwardObs!.rationale, /Camera-assisted postural alignment estimate/i);
    assert.match(forwardObs!.rationale, /clinician/i);
    assert.ok(forwardObs!.rationale.includes(POSTURAL_ALIGNMENT_OBSERVATION_DISCLAIMER));
    assert.doesNotMatch(forwardObs!.pattern, /center of mass|center of pressure|diagnosis/i);
  });

  it("uses capture rollup for heel-raise lateral shift proxy", () => {
    const landmarks = syntheticLandmarks(0);
    landmarks[23] = landmark(0.58, 0.55);
    landmarks[24] = landmark(0.58, 0.55);

    const result = buildPosturalAlignmentProxy({
      exerciseId: "heel-raise",
      evidenceIntegrity: evaluateCvEvidenceIntegrity({
        exerciseId: "heel-raise",
        completedReps: 4,
        motionPilot: {
          snapshotCount: 6,
          completeReps: 4,
          unclearReps: 0,
          trackingSignal: "good",
          showReviewBanner: false,
          phaseRatios: { rising: 30, standing: 50, returning: 20 },
          repTimings: { avgS: 2, fastestS: 1.8, slowestS: 2.4 },
          visibilityRatios: { hip: 90, knee: 88, ankle: 86 },
          clinicianFlags: [],
        },
      }),
      motionPilot: {
        snapshotCount: 6,
        completeReps: 4,
        unclearReps: 0,
        trackingSignal: "good",
        showReviewBanner: false,
        phaseRatios: { rising: 30, standing: 50, returning: 20 },
        repTimings: { avgS: 2, fastestS: 1.8, slowestS: 2.4 },
        visibilityRatios: { hip: 90, knee: 88, ankle: 86 },
        clinicianFlags: [],
      },
      captureRollup: samplePosturalAlignmentFromLandmarks(landmarks),
    });

    assert.ok(result);
    assert.ok(
      result!.observations.some((o) => o.id === "possible_lateral_shift"),
    );
    assert.match(POSTURAL_ALIGNMENT_PROXY_DISCLAIMER, /not a diagnostic measurement/i);
  });
});
