/**
 * Run: npx tsx --test app/lib/cv/clinician-session-camera-status.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import {
  deriveClinicianSessionCameraLine,
  indexCvMetricsByPlanSessionId,
  sessionIncludesCvExercise,
} from "./clinician-session-camera-status";

function metric(partial: Partial<CvSessionMetricPublic> & { exerciseId: string }): CvSessionMetricPublic {
  return {
    id: partial.id ?? "m1",
    exerciseId: partial.exerciseId,
    repCount: partial.repCount ?? 0,
    sessionDurationS: partial.sessionDurationS ?? 60,
    trackingQuality: partial.trackingQuality ?? "good",
    movementDetected: partial.movementDetected ?? true,
    framesWithPose: partial.framesWithPose ?? 100,
    framesTotal: partial.framesTotal ?? 100,
    source: partial.source ?? "patient_session",
    prototypeVersion: partial.prototypeVersion ?? "cv-y1b-sit-to-stand",
    recordedAt: partial.recordedAt ?? "2026-05-30T12:00:00.000Z",
    planSessionId: partial.planSessionId ?? "session-1",
    planId: partial.planId ?? "plan-1",
    patientId: partial.patientId ?? "patient-1",
  };
}

describe("clinician session camera status", () => {
  it("sessionIncludesCvExercise detects mini squat sessions", () => {
    const exercises = ["Mini Squat (0–45°)"];
    assert.equal(sessionIncludesCvExercise(exercises), true);
  });

  it("indexCvMetricsByPlanSessionId keeps all exercises per session", () => {
    const rows = [
      metric({
        id: "a",
        exerciseId: "mini-squat",
        repCount: 12,
        recordedAt: "2026-05-30T12:00:00.000Z",
      }),
      metric({
        id: "b",
        exerciseId: "sit-to-stand",
        repCount: 8,
        recordedAt: "2026-05-30T12:05:00.000Z",
      }),
    ];
    const map = indexCvMetricsByPlanSessionId(rows);
    assert.equal(map.get("session-1")?.length, 2);
    assert.equal(map.get("session-1")?.[0]?.exerciseId, "sit-to-stand");
  });

  it("deriveClinicianSessionCameraLine formats multi-exercise session", () => {
    const line = deriveClinicianSessionCameraLine({
      planSessionId: "session-1",
      sessionStatus: "completed",
      exercises: ["Mini Squat (0–45°)", "Sit-to-Stand"],
      cvMetrics: [
        metric({ exerciseId: "mini-squat", repCount: 12, trackingQuality: "fair" }),
        metric({ exerciseId: "sit-to-stand", repCount: 8, trackingQuality: "good" }),
      ],
    });
    assert.match(line ?? "", /Mini Squat reps: 12/);
    assert.match(line ?? "", /Sit-to-Stand reps: 8/);
    assert.match(line ?? "", /visibility: fair/);
  });

  it("returns manual completion when no metrics saved", () => {
    const line = deriveClinicianSessionCameraLine({
      planSessionId: "session-1",
      sessionStatus: "completed",
      exercises: ["Mini Squat (0–45°)"],
      cvMetrics: [],
    });
    assert.equal(line, "Manual completion · camera not saved");
  });
});
