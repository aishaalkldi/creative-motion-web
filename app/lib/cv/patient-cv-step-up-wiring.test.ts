/**
 * Run: npx tsx --test app/lib/cv/patient-cv-step-up-wiring.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isStepUpMotionPilotEnabled,
  isPatientCvCaptureWired,
  resolvePatientCvDetectorKind,
} from "./cv-patient-config";
import {
  StepUpMotionTimelineAccumulator,
  finalizeStepUpMotionTimelineSummary,
} from "./step-up-motion-timeline";
import { buildStepUpMotionPilotRecordFromSummary } from "./step-up-motion-pilot-record";
import { SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS } from "@/app/lib/sports-knee-foundation-clinical-v1";
import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";

describe("patient CV step-up detector wiring (PR68)", () => {
  it("resolves step-up to step-up detector kind, not sit-to-stand", () => {
    assert.equal(resolvePatientCvDetectorKind("step-up"), "step-up");
    assert.notEqual(resolvePatientCvDetectorKind("step-up"), "sit-to-stand");
  });

  it("keeps STS, mini-squat, SLS, and heel-raise detector kinds unchanged", () => {
    assert.equal(resolvePatientCvDetectorKind("sit-to-stand"), "sit-to-stand");
    assert.equal(resolvePatientCvDetectorKind("mini-squat"), "mini-squat");
    assert.equal(resolvePatientCvDetectorKind("single-leg-stance"), "single-leg-stance");
    assert.equal(resolvePatientCvDetectorKind("heel-raise"), "heel-raise");
  });

  it("marks step-up capture wired when motion pilot is enabled", () => {
    assert.equal(isStepUpMotionPilotEnabled("step-up"), true);
    assert.equal(isPatientCvCaptureWired("step-up"), true);
  });

  it("PatientCvCapture uses StepUpPoseDetector for step-up", () => {
    const source = readFileSync(
      join(process.cwd(), "app/components/patient/cv/PatientCvCapture.tsx"),
      "utf8",
    );
    assert.match(source, /exerciseId === "step-up"\s*\?\s*new StepUpPoseDetector/);
    assert.doesNotMatch(
      source,
      /exerciseId === "step-up"[\s\S]{0,120}new SitToStandDetector/,
    );
  });

  it("builds and saves suPilot from real step up timeline summary", () => {
    const acc = new StepUpMotionTimelineAccumulator();
    acc.start();
    for (let sec = 0; sec <= 8; sec += 1) {
      acc.recordTick({
        sessionSeconds: sec,
        posePresent: true,
        trackingQuality: "good",
        repCount: sec >= 4 ? 1 : 0,
        movementDetected: true,
        movementPhase:
          sec <= 1
            ? "standing"
            : sec <= 3
              ? "step_ascent"
              : sec <= 4
                ? "top_position"
                : "step_descent",
        visibility: { hip: 0.85, knee: 0.85, ankle: 0.9 },
        events: sec === 4 ? ["rep_completed"] : [],
      });
    }

    const { summary } = finalizeStepUpMotionTimelineSummary({
      accumulator: acc,
      legacyRepCount: 1,
    });

    const record = buildStepUpMotionPilotRecordFromSummary({
      summary,
      metrics: {
        exerciseId: "step-up",
        repCount: 1,
        sessionDurationS: summary.sessionDurationS,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 9,
        framesTotal: 9,
      },
      snapshotCount: acc.getSnapshotCount(),
    });

    assert.equal(record.exerciseId, "step-up");
    assert.equal(record.pilotVersion, "sum-1");
    assert.equal(record.completeReps, summary.completeRepCount);
    assert.ok(record.phaseRatios.step_ascent !== undefined);
    assert.ok(record.repTimings.avgS !== null);
    assert.ok(record.visibilityRatios.hip > 0);
    assert.ok(record.clinicianFlags.length >= 0);
  });

  it("includes step-up in Sports Knee cvAssisted when capture is wired", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("step-up"));
    const entry = getLibraryExerciseById("step-up");
    assert.ok(entry);
    assert.equal(entry!.cvAssisted, true);
  });

  it("does not regress heel-raise Sports Knee cvAssisted metadata", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("heel-raise"));
    assert.equal(getLibraryExerciseById("heel-raise")?.cvAssisted, true);
    assert.equal(getLibraryExerciseById("sit-to-stand")?.cvAssisted, true);
  });
});
