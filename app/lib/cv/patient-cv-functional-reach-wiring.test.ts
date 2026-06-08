/**
 * Run: npx tsx --test app/lib/cv/patient-cv-functional-reach-wiring.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isFunctionalReachMotionPilotEnabled,
  isPatientCvCaptureWired,
  resolvePatientCvDetectorKind,
} from "./cv-patient-config";
import {
  FunctionalReachMotionTimelineAccumulator,
  finalizeFunctionalReachMotionTimelineSummary,
} from "./functional-reach-motion-timeline";
import { buildFunctionalReachMotionPilotRecordFromSummary } from "./functional-reach-motion-pilot-record";
import { SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS } from "@/app/lib/sports-knee-foundation-clinical-v1";
import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";

describe("patient CV functional-reach detector wiring (PR70)", () => {
  it("resolves functional-reach to functional-reach detector kind, not sit-to-stand", () => {
    assert.equal(resolvePatientCvDetectorKind("functional-reach"), "functional-reach");
    assert.notEqual(resolvePatientCvDetectorKind("functional-reach"), "sit-to-stand");
  });

  it("keeps STS, mini-squat, SLS, heel-raise, and step-up detector kinds unchanged", () => {
    assert.equal(resolvePatientCvDetectorKind("sit-to-stand"), "sit-to-stand");
    assert.equal(resolvePatientCvDetectorKind("mini-squat"), "mini-squat");
    assert.equal(resolvePatientCvDetectorKind("single-leg-stance"), "single-leg-stance");
    assert.equal(resolvePatientCvDetectorKind("heel-raise"), "heel-raise");
    assert.equal(resolvePatientCvDetectorKind("step-up"), "step-up");
  });

  it("marks functional-reach capture wired when motion pilot is enabled", () => {
    assert.equal(isFunctionalReachMotionPilotEnabled("functional-reach"), true);
    assert.equal(isPatientCvCaptureWired("functional-reach"), true);
  });

  it("PatientCvCapture uses FunctionalReachPoseDetector for functional-reach", () => {
    const source = readFileSync(
      join(process.cwd(), "app/components/patient/cv/PatientCvCapture.tsx"),
      "utf8",
    );
    assert.match(source, /exerciseId === "functional-reach"\s*\?\s*new FunctionalReachPoseDetector/);
    assert.doesNotMatch(
      source,
      /exerciseId === "functional-reach"[\s\S]{0,120}new SitToStandDetector/,
    );
  });

  it("builds and saves frPilot from real Functional Reach timeline summary", () => {
    const acc = new FunctionalReachMotionTimelineAccumulator();
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
              ? "reaching_forward"
              : sec <= 4
                ? "peak_reach"
                : "returning",
        visibility: { hip: 0.85, knee: 0.85, ankle: 0.9 },
        events: sec === 4 ? ["rep_completed"] : [],
      });
    }

    const { summary } = finalizeFunctionalReachMotionTimelineSummary({
      accumulator: acc,
      legacyRepCount: 1,
    });

    const record = buildFunctionalReachMotionPilotRecordFromSummary({
      summary,
      metrics: {
        exerciseId: "functional-reach",
        repCount: 1,
        sessionDurationS: summary.sessionDurationS,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 9,
        framesTotal: 9,
      },
      snapshotCount: acc.getSnapshotCount(),
    });

    assert.equal(record.exerciseId, "functional-reach");
    assert.equal(record.pilotVersion, "frm-1");
    assert.equal(record.completeReps, summary.completeRepCount);
    assert.ok(record.phaseRatios.reaching_forward !== undefined);
    assert.ok(record.repTimings.avgS !== null);
    assert.ok(record.visibilityRatios.hip > 0);
    assert.ok(record.clinicianFlags.length >= 0);
  });

  it("includes functional-reach in Sports Knee cvAssisted when capture is wired", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("functional-reach"));
    const entry = getLibraryExerciseById("functional-reach");
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
