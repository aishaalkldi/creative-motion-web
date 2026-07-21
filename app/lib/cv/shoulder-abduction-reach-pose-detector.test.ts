/**
 * Run: npx tsx --test app/lib/cv/shoulder-abduction-reach-pose-detector.test.ts
 *
 * Camera/MediaPipe lifecycle (`start()`) is not unit tested here — matching
 * the existing convention for every other `*-pose-detector.ts` class in
 * this codebase (see `single-leg-stance-pose-detector.test.ts`), which
 * covers only the synchronous, non-browser-dependent surface. Frame
 * processing is exercised directly via the private `processFrame` method
 * to prove the measured-event and compensation-signal logic without a real
 * camera.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { MIN_PRESENT_VISIBILITY } from "@/app/lib/cv/motion-quality-confidence";
import {
  ShoulderAbductionReachPoseDetector,
  type ShoulderAbductionReachMeasuredEvent,
} from "./shoulder-abduction-reach-pose-detector";

// BlazePose indices used by SHOULDER_ABDUCTION_REACH_CORE_JOINTS via the
// acquisition adapter: shoulders 11/12, elbows 13/14, wrists 15/16, hips 23/24.
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;

function blankLandmarks(): PoseLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
}

/** Right arm at rest (small hip-shoulder-elbow angle), no trunk drift. */
function restingLandmarks(): PoseLandmark[] {
  const lm = blankLandmarks();
  lm[R_HIP] = { x: 0.5, y: 0.6, visibility: 0.95 };
  lm[R_SHOULDER] = { x: 0.5, y: 0.35, visibility: 0.95 };
  lm[R_ELBOW] = { x: 0.5, y: 0.55, visibility: 0.95 };
  lm[R_WRIST] = { x: 0.5, y: 0.7, visibility: 0.9 };
  lm[L_HIP] = { x: 0.4, y: 0.6, visibility: 0.9 };
  lm[L_SHOULDER] = { x: 0.4, y: 0.35, visibility: 0.9 };
  lm[L_ELBOW] = { x: 0.4, y: 0.55, visibility: 0.9 };
  lm[L_WRIST] = { x: 0.4, y: 0.7, visibility: 0.9 };
  return lm;
}

/** Right arm raised to peak abduction, trunk unchanged (no compensation). */
function peakAbductionLandmarks(): PoseLandmark[] {
  const lm = restingLandmarks();
  lm[R_ELBOW] = { x: 0.75, y: 0.35, visibility: 0.95 };
  lm[R_WRIST] = { x: 0.95, y: 0.35, visibility: 0.9 };
  return lm;
}

/** Right arm raised to peak abduction while the trunk (hip->shoulder) drifts — compensation. */
function peakAbductionWithTrunkLeanLandmarks(): PoseLandmark[] {
  const lm = peakAbductionLandmarks();
  lm[R_SHOULDER] = { x: 0.62, y: 0.35, visibility: 0.95 };
  return lm;
}

function driveFrames(
  detector: ShoulderAbductionReachPoseDetector,
  landmarksSequence: Array<PoseLandmark[] | null>,
): void {
  const internals = detector as unknown as {
    processFrame: (landmarks: PoseLandmark[] | null, capturedAtMs: number) => void;
  };
  landmarksSequence.forEach((landmarks, i) => {
    internals.processFrame(landmarks, 1_000 + i * 33);
  });
}

describe("ShoulderAbductionReachPoseDetector", () => {
  it("constructor defaults primarySide to right", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} });
    assert.equal(detector.getSnapshot().primarySide, "right");
  });

  it("getDerivedMetrics returns shoulder-abduction-reach exercise id", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} }, "left");
    const metrics = detector.getDerivedMetrics();
    assert.equal(metrics.exerciseId, "shoulder-abduction-reach");
    assert.equal(metrics.primarySide, "left");
    assert.equal(metrics.repCount, 0);
  });

  it("counts a completed rep and emits a repCompleted measured event", () => {
    const events: ShoulderAbductionReachMeasuredEvent[] = [];
    const detector = new ShoulderAbductionReachPoseDetector(
      { onSnapshot: () => {}, onMeasuredEvent: (e) => events.push(e) },
      "right",
    );

    driveFrames(detector, [
      restingLandmarks(),
      restingLandmarks(),
      peakAbductionLandmarks(),
      peakAbductionLandmarks(),
      restingLandmarks(),
      restingLandmarks(),
    ]);

    const snapshot = detector.getSnapshot();
    assert.equal(snapshot.primaryRepCount, 1);
    const repEvents = events.filter((e) => e.type === "repCompleted");
    assert.equal(repEvents.length, 1);
    assert.equal(repEvents[0].side, "right");
    assert.equal(repEvents[0].repCount, 1);
  });

  it("emits compensationDetected only once trunk drift crosses threshold, and compensationCleared on return", () => {
    const events: ShoulderAbductionReachMeasuredEvent[] = [];
    const detector = new ShoulderAbductionReachPoseDetector(
      { onSnapshot: () => {}, onMeasuredEvent: (e) => events.push(e) },
      "right",
    );

    driveFrames(detector, [
      restingLandmarks(),
      restingLandmarks(),
      peakAbductionWithTrunkLeanLandmarks(),
      peakAbductionWithTrunkLeanLandmarks(),
      peakAbductionWithTrunkLeanLandmarks(),
      restingLandmarks(),
      restingLandmarks(),
    ]);

    const detected = events.filter((e) => e.type === "compensationDetected");
    const cleared = events.filter((e) => e.type === "compensationCleared");
    assert.equal(detected.length, 1, "flags exactly once, not once per frame while still flagged");
    assert.equal(cleared.length, 1);
  });

  it("does not flag compensation when the arm reaches peak without trunk drift", () => {
    const events: ShoulderAbductionReachMeasuredEvent[] = [];
    const detector = new ShoulderAbductionReachPoseDetector(
      { onSnapshot: () => {}, onMeasuredEvent: (e) => events.push(e) },
      "right",
    );

    driveFrames(detector, [
      restingLandmarks(),
      restingLandmarks(),
      peakAbductionLandmarks(),
      restingLandmarks(),
    ]);

    assert.equal(events.filter((e) => e.type === "compensationDetected").length, 0);
  });

  it("emits trackerLost after sustained missing landmarks, and trackerRecovered when they return", () => {
    const events: ShoulderAbductionReachMeasuredEvent[] = [];
    const detector = new ShoulderAbductionReachPoseDetector({
      onSnapshot: () => {},
      onMeasuredEvent: (e) => events.push(e),
    });

    const sequence: Array<PoseLandmark[] | null> = [
      restingLandmarks(),
      ...Array.from({ length: 12 }, () => null),
      restingLandmarks(),
    ];
    driveFrames(detector, sequence);

    assert.equal(events.filter((e) => e.type === "trackerLost").length, 1);
    assert.equal(events.filter((e) => e.type === "trackerRecovered").length, 1);
  });

  it("canSaveMetrics is false before the minimum session duration", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} });
    assert.equal(detector.canSaveMetrics(), false);
  });

  it("does not know about session duration, blocks, or completion — measurement source only", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} });
    const publicMembers = Object.getOwnPropertyNames(ShoulderAbductionReachPoseDetector.prototype);
    for (const forbidden of ["sessionComplete", "nextBlock", "workRestSchedule", "programProgression"]) {
      assert.equal(
        publicMembers.includes(forbidden),
        false,
        `detector must not expose ${forbidden} — that is Session Orchestrator scope`,
      );
    }
    void detector;
  });

  it("populates primaryWristNormalized for the configured primary side with normalized coordinates", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} }, "right");
    const landmarks = restingLandmarks();
    landmarks[R_WRIST] = { x: 0.62, y: 0.41, visibility: 0.95 };
    landmarks[L_WRIST] = { x: 0.18, y: 0.77, visibility: 0.95 };

    driveFrames(detector, [landmarks]);

    const wrist = detector.getSnapshot().primaryWristNormalized;
    assert.ok(wrist);
    assert.equal(wrist.x, 0.62);
    assert.equal(wrist.y, 0.41);
    assert.ok(wrist.x >= 0 && wrist.x <= 1);
    assert.ok(wrist.y >= 0 && wrist.y <= 1);
  });

  it("returns the primary-side wrist, not the opposite wrist", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} }, "left");
    const landmarks = restingLandmarks();
    landmarks[L_WRIST] = { x: 0.22, y: 0.58, visibility: 0.95 };
    landmarks[R_WRIST] = { x: 0.81, y: 0.33, visibility: 0.95 };

    driveFrames(detector, [landmarks]);

    const wrist = detector.getSnapshot().primaryWristNormalized;
    assert.deepEqual(wrist, { x: 0.22, y: 0.58 });
  });

  it("sets primaryWristNormalized to null when the primary wrist is below the present visibility rule", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} }, "right");
    const landmarks = restingLandmarks();
    landmarks[R_WRIST] = {
      x: 0.62,
      y: 0.41,
      visibility: MIN_PRESENT_VISIBILITY - 0.05,
    };

    driveFrames(detector, [landmarks]);

    assert.equal(detector.getSnapshot().primaryWristNormalized, null);
  });

  it("sets primaryWristNormalized to null when the primary wrist landmark is missing from the frame", () => {
    const detector = new ShoulderAbductionReachPoseDetector({ onSnapshot: () => {} }, "right");
    const landmarks = restingLandmarks();
    landmarks[R_WRIST] = { x: 0.62, y: 0.41, visibility: 0 };

    driveFrames(detector, [landmarks]);

    assert.equal(detector.getSnapshot().primaryWristNormalized, null);
  });
});
