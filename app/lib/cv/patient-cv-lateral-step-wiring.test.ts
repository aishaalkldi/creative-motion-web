/**
 * Run: npx tsx --test app/lib/cv/patient-cv-lateral-step-wiring.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isLateralStepMotionPilotEnabled,
  isPatientCvCaptureWired,
  resolvePatientCvDetectorKind,
} from "./cv-patient-config";
import {
  LateralStepMotionTimelineAccumulator,
  finalizeLateralStepMotionTimelineSummary,
} from "./lateral-step-motion-timeline";
import { buildLateralStepMotionPilotRecordFromSummary } from "./lateral-step-motion-pilot-record";
import { SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS } from "@/app/lib/sports-knee-foundation-clinical-v1";
import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";

describe("patient CV lateral-step detector wiring (PR69)", () => {
  it("resolves lateral-step to lateral-step detector kind, not sit-to-stand", () => {
    assert.equal(resolvePatientCvDetectorKind("lateral-step"), "lateral-step");
    assert.notEqual(resolvePatientCvDetectorKind("lateral-step"), "sit-to-stand");
  });

  it("keeps STS, mini-squat, SLS, heel-raise, and step-up detector kinds unchanged", () => {
    assert.equal(resolvePatientCvDetectorKind("sit-to-stand"), "sit-to-stand");
    assert.equal(resolvePatientCvDetectorKind("mini-squat"), "mini-squat");
    assert.equal(resolvePatientCvDetectorKind("single-leg-stance"), "single-leg-stance");
    assert.equal(resolvePatientCvDetectorKind("heel-raise"), "heel-raise");
    assert.equal(resolvePatientCvDetectorKind("step-up"), "step-up");
  });

  it("marks lateral-step capture wired when motion pilot is enabled", () => {
    assert.equal(isLateralStepMotionPilotEnabled("lateral-step"), true);
    assert.equal(isPatientCvCaptureWired("lateral-step"), true);
  });

  it("PatientCvCapture uses LateralStepPoseDetector for lateral-step", () => {
    const source = readFileSync(
      join(process.cwd(), "app/components/patient/cv/PatientCvCapture.tsx"),
      "utf8",
    );
    assert.match(source, /exerciseId === "lateral-step"\s*\?\s*new LateralStepPoseDetector/);
    assert.doesNotMatch(
      source,
      /exerciseId === "lateral-step"[\s\S]{0,120}new SitToStandDetector/,
    );
  });

  it("builds and saves lsPilot from real lateral step timeline summary", () => {
    const acc = new LateralStepMotionTimelineAccumulator();
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
              ? "lateral_shift"
              : sec <= 4
                ? "step_out"
                : "return_to_center",
        visibility: { hip: 0.85, knee: 0.85, ankle: 0.9 },
        events: sec === 4 ? ["rep_completed"] : [],
      });
    }

    const { summary } = finalizeLateralStepMotionTimelineSummary({
      accumulator: acc,
      legacyRepCount: 1,
    });

    const record = buildLateralStepMotionPilotRecordFromSummary({
      summary,
      metrics: {
        exerciseId: "lateral-step",
        repCount: 1,
        sessionDurationS: summary.sessionDurationS,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 9,
        framesTotal: 9,
      },
      snapshotCount: acc.getSnapshotCount(),
    });

    assert.equal(record.exerciseId, "lateral-step");
    assert.equal(record.pilotVersion, "lsm-1");
    assert.equal(record.completeReps, summary.completeRepCount);
    assert.ok(record.phaseRatios.lateral_shift !== undefined);
    assert.ok(record.repTimings.avgS !== null);
    assert.ok(record.visibilityRatios.hip > 0);
    assert.ok(record.clinicianFlags.length >= 0);
  });

  it("includes lateral-step in Sports Knee cvAssisted when capture is wired", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("lateral-step"));
    const entry = getLibraryExerciseById("lateral-step");
    assert.ok(entry);
    assert.equal(entry!.cvAssisted, true);
  });

  it("does not regress heel-raise or step-up Sports Knee cvAssisted metadata", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("heel-raise"));
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("step-up"));
    assert.equal(getLibraryExerciseById("heel-raise")?.cvAssisted, true);
    assert.equal(getLibraryExerciseById("step-up")?.cvAssisted, true);
    assert.equal(getLibraryExerciseById("sit-to-stand")?.cvAssisted, true);
  });
});
