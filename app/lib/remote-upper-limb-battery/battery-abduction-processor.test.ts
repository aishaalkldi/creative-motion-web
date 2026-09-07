/**
 * Run: npx tsx --test app/lib/remote-upper-limb-battery/battery-abduction-processor.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import type { RemoteUpperLimbBatterySide } from "./types";
import { createShoulderAbductionProcessor } from "./battery-frame-processors";

const SIDE_INDICES: Record<
  RemoteUpperLimbBatterySide,
  { shoulder: number; elbow: number; hip: number }
> = {
  right: { shoulder: 12, elbow: 14, hip: 24 },
  left: { shoulder: 11, elbow: 13, hip: 23 },
};

function baseLandmarks(): PoseLandmark[] {
  const landmarks: PoseLandmark[] = [];
  for (let i = 0; i < 33; i += 1) {
    landmarks.push({ x: 0.5, y: 0.5, visibility: 0.9 });
  }
  return landmarks;
}

/**
 * Abduction angle is the interior angle at the shoulder between shoulder→hip
 * and shoulder→elbow, so the trunk column sits on the side's own x and the
 * elbow swings toward mid-frame. Right and left are exact x-mirrors of each
 * other about 0.5, which is what makes the left-side runs a real behavioural
 * check rather than an index-selection check.
 */
function withAbductionAngle(
  side: RemoteUpperLimbBatterySide,
  angleDeg: 0 | 90 | 180,
): PoseLandmark[] {
  const landmarks = baseLandmarks();
  const indices = SIDE_INDICES[side];
  const trunkX = side === "right" ? 0.3 : 0.7;

  landmarks[indices.hip] = { x: trunkX, y: 0.7, visibility: 0.9 };
  landmarks[indices.shoulder] = { x: trunkX, y: 0.5, visibility: 0.9 };
  if (angleDeg === 0) {
    landmarks[indices.elbow] = { x: trunkX, y: 0.68, visibility: 0.9 };
  } else if (angleDeg === 90) {
    landmarks[indices.elbow] = { x: 0.5, y: 0.5, visibility: 0.9 };
  } else {
    landmarks[indices.elbow] = { x: trunkX, y: 0.3, visibility: 0.9 };
  }
  return landmarks;
}

function ctx(frameIndex: number) {
  return { frameIndex, capturedAtMs: frameIndex * 33 };
}

/** One full raise-and-return whose peak lands on `peak`. */
function repCycle(peak: 90 | 180): (0 | 90 | 180)[] {
  return peak === 180 ? [0, 0, 90, 180, 180, 90, 0, 0] : [0, 0, 90, 90, 0, 0];
}

function runReps(
  processor: ReturnType<typeof createShoulderAbductionProcessor>,
  side: RemoteUpperLimbBatterySide,
  reps: number,
  peak: 90 | 180,
  startFrame = 0,
) {
  const cycle = repCycle(peak);
  let frame = startFrame;
  let snapshot = processor.processFrame(withAbductionAngle(side, 0), ctx(frame));
  for (let rep = 0; rep < reps; rep += 1) {
    for (const angle of cycle) {
      frame += 1;
      snapshot = processor.processFrame(withAbductionAngle(side, angle), ctx(frame));
    }
  }
  return { snapshot, nextFrame: frame + 1 };
}

describe("shoulder abduction battery processor", () => {
  for (const side of ["right", "left"] as const) {
    it(`counts exactly three valid ${side}-side reps once armed`, () => {
      const processor = createShoulderAbductionProcessor(side);
      processor.beginMovementTracking();

      const { snapshot, nextFrame } = runReps(processor, side, 3, 180);
      assert.equal(snapshot.repCount, 3);

      const finalSnapshot = processor.processFrame(withAbductionAngle(side, 0), ctx(nextFrame));
      assert.equal(finalSnapshot.completedPeaksDeg.length, 3);
    });

    it(`does not accumulate ${side}-side reps before the test is armed (CV-1)`, () => {
      const processor = createShoulderAbductionProcessor(side);

      // Positioning / countdown: two complete movements the patient makes
      // before the test actually starts. Their 180° peaks must not survive.
      const beforeArming = runReps(processor, side, 2, 180);
      assert.equal(beforeArming.snapshot.repCount, 0);
      assert.deepEqual(beforeArming.snapshot.completedPeaksDeg, []);
      assert.equal(beforeArming.snapshot.movementPhase, "idle");
      assert.equal(processor.isMovementTrackingEnabled(), false);

      // Tracking readiness must keep working while unarmed, otherwise the
      // orchestrator could never leave positioning.
      assert.equal(beforeArming.snapshot.trackingReady, true);

      processor.beginMovementTracking();
      assert.equal(processor.isMovementTrackingEnabled(), true);

      const afterArming = runReps(processor, side, 3, 90, beforeArming.nextFrame);
      assert.equal(afterArming.snapshot.repCount, 3);

      const peaks = afterArming.snapshot.completedPeaksDeg;
      assert.equal(peaks.length, 3);
      for (const peak of peaks) {
        // 90°, not the 180° peaks performed before arming.
        assert.ok(peak < 100, `pre-start peak survived arming: ${peak}`);
      }
    });
  }

  it("reports no reps while unarmed even when the arm is held at full abduction", () => {
    const processor = createShoulderAbductionProcessor("right");
    let snapshot = processor.processFrame(withAbductionAngle("right", 0), ctx(0));
    for (let frame = 1; frame < 40; frame += 1) {
      snapshot = processor.processFrame(withAbductionAngle("right", 180), ctx(frame));
    }
    assert.equal(snapshot.repCount, 0);
    assert.deepEqual(snapshot.completedPeaksDeg, []);
    assert.equal(snapshot.lastRepPeak, null);
  });
});
