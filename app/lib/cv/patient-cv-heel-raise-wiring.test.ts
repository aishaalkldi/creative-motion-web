/**
 * Run: npx tsx --test app/lib/cv/patient-cv-heel-raise-wiring.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isHeelRaiseMotionPilotEnabled,
  isPatientCvCaptureWired,
  resolvePatientCvDetectorKind,
} from "./cv-patient-config";
import {
  HeelRaiseMotionTimelineAccumulator,
  finalizeHeelRaiseMotionTimelineSummary,
} from "./heel-raise-motion-timeline";
import { buildHeelRaiseMotionPilotRecordFromSummary } from "./heel-raise-motion-pilot-record";
import { SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS } from "@/app/lib/sports-knee-foundation-clinical-v1";
import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";

describe("patient CV heel-raise detector wiring (PR67b)", () => {
  it("resolves heel-raise to heel-raise detector kind, not sit-to-stand", () => {
    assert.equal(resolvePatientCvDetectorKind("heel-raise"), "heel-raise");
    assert.notEqual(resolvePatientCvDetectorKind("heel-raise"), "sit-to-stand");
  });

  it("keeps STS, mini-squat, and SLS detector kinds unchanged", () => {
    assert.equal(resolvePatientCvDetectorKind("sit-to-stand"), "sit-to-stand");
    assert.equal(resolvePatientCvDetectorKind("mini-squat"), "mini-squat");
    assert.equal(resolvePatientCvDetectorKind("single-leg-stance"), "single-leg-stance");
  });

  it("marks heel-raise capture wired when motion pilot is enabled", () => {
    assert.equal(isHeelRaiseMotionPilotEnabled("heel-raise"), true);
    assert.equal(isPatientCvCaptureWired("heel-raise"), true);
  });

  it("PatientCvCapture uses HeelRaisePoseDetector for heel-raise", () => {
    const source = readFileSync(
      join(process.cwd(), "app/components/patient/cv/PatientCvCapture.tsx"),
      "utf8",
    );
    assert.match(source, /exerciseId === "heel-raise"\s*\?\s*new HeelRaisePoseDetector/);
    assert.doesNotMatch(
      source,
      /exerciseId === "heel-raise"[\s\S]{0,120}new SitToStandDetector/,
    );
  });

  it("builds and saves hrPilot from real heel raise timeline summary", () => {
    const acc = new HeelRaiseMotionTimelineAccumulator();
    acc.start();
    for (let sec = 0; sec <= 8; sec += 1) {
      acc.recordTick({
        sessionSeconds: sec,
        posePresent: true,
        trackingQuality: "good",
        repCount: sec >= 4 ? 1 : 0,
        movementDetected: true,
        movementPhase:
          sec <= 1 ? "standing" : sec <= 3 ? "rising" : sec <= 4 ? "peak_raise" : "lowering",
        visibility: { hip: 0.85, knee: 0.85, ankle: 0.9 },
        events: sec === 4 ? ["rep_completed"] : [],
      });
    }

    const { summary } = finalizeHeelRaiseMotionTimelineSummary({
      accumulator: acc,
      legacyRepCount: 1,
    });

    const record = buildHeelRaiseMotionPilotRecordFromSummary({
      summary,
      metrics: {
        exerciseId: "heel-raise",
        repCount: 1,
        sessionDurationS: summary.sessionDurationS,
        trackingQuality: "good",
        movementDetected: true,
        framesWithPose: 9,
        framesTotal: 9,
      },
      snapshotCount: acc.getSnapshotCount(),
    });

    assert.equal(record.exerciseId, "heel-raise");
    assert.equal(record.pilotVersion, "hrm-1");
    assert.equal(record.completeReps, summary.completeRepCount);
    assert.ok(record.phaseRatios.rising !== undefined);
    assert.ok(record.repTimings.avgS !== null);
    assert.ok(record.visibilityRatios.ankle > 0);
    assert.ok(record.clinicianFlags.length >= 0);
  });

  it("includes heel-raise in Sports Knee cvAssisted when capture is wired", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("heel-raise"));
    const entry = getLibraryExerciseById("heel-raise");
    assert.ok(entry);
    assert.equal(entry!.cvAssisted, true);
  });

  it("does not regress STS Sports Knee cvAssisted metadata", () => {
    assert.ok(SPORTS_KNEE_CV_ASSISTED_EXERCISE_IDS.includes("sit-to-stand"));
    assert.equal(getLibraryExerciseById("sit-to-stand")?.cvAssisted, true);
    assert.equal(getLibraryExerciseById("mini-squat")?.cvAssisted, true);
    assert.equal(getLibraryExerciseById("single-leg-stance")?.cvAssisted, true);
  });
});
