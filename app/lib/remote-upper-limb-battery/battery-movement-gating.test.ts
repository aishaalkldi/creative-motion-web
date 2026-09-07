/**
 * Pre-start rep gating (CV-1), bilateral behavioural coverage (CV-5), and
 * gated-vs-raw rep reconciliation (CV-6) for the remote upper-limb battery.
 *
 * Run: npx tsx --test app/lib/remote-upper-limb-battery/battery-movement-gating.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  createElbowFlexionProcessor,
  createShoulderFlexionProcessor,
  type BatteryTestProcessor,
} from "./battery-frame-processors";
import {
  createBatteryOrchestratorState,
  recordBatteryRepCompleted,
  startBatteryAssessment,
  type BatteryOrchestratorState,
} from "./battery-orchestrator";
import { isBatteryProcessorTrackingUsable } from "./battery-tracking";
import type { RemoteUpperLimbBatterySide } from "./types";

const SESSION = join(
  process.cwd(),
  "app/components/patient/RemoteUpperLimbBatterySession.tsx",
);

const SIDE_INDICES: Record<
  RemoteUpperLimbBatterySide,
  { shoulder: number; elbow: number; wrist: number }
> = {
  right: { shoulder: 12, elbow: 14, wrist: 16 },
  left: { shoulder: 11, elbow: 13, wrist: 15 },
};

/**
 * Side-view forward direction in raw (unmirrored) landmark space: a right-side
 * test leaves the patient facing +x, a left-side test faces -x. See
 * `computeReachExtentForSide` for the full trace of that convention.
 */
function forwardSign(side: RemoteUpperLimbBatterySide): 1 | -1 {
  return side === "right" ? 1 : -1;
}

function baseLandmarks(visibility = 0.9): PoseLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }));
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Shoulder elevation is the upper-arm angle from downward vertical. */
function withShoulderFlexionElevation(
  side: RemoteUpperLimbBatterySide,
  elevationDeg: number,
  visibility = 0.9,
): PoseLandmark[] {
  const landmarks = baseLandmarks(visibility);
  const indices = SIDE_INDICES[side];
  const shoulder = { x: 0.5, y: 0.4 };
  const armLength = 0.2;
  const sign = forwardSign(side);

  landmarks[indices.shoulder] = { ...shoulder, visibility };
  landmarks[indices.elbow] = {
    x: shoulder.x + sign * armLength * Math.sin(toRad(elevationDeg)),
    y: shoulder.y + armLength * Math.cos(toRad(elevationDeg)),
    visibility,
  };
  return landmarks;
}

/** Interior elbow angle between the upper arm (elbow→shoulder) and forearm (elbow→wrist). */
function withElbowInteriorAngle(
  side: RemoteUpperLimbBatterySide,
  interiorAngleDeg: number,
  visibility = 0.9,
): PoseLandmark[] {
  const landmarks = baseLandmarks(visibility);
  const indices = SIDE_INDICES[side];
  const elbow = { x: 0.5, y: 0.6 };
  const forearm = 0.2;
  const sign = forwardSign(side);

  landmarks[indices.shoulder] = { x: elbow.x, y: elbow.y - 0.2, visibility };
  landmarks[indices.elbow] = { ...elbow, visibility };
  landmarks[indices.wrist] = {
    x: elbow.x + sign * forearm * Math.sin(toRad(interiorAngleDeg)),
    y: elbow.y - forearm * Math.cos(toRad(interiorAngleDeg)),
    visibility,
  };
  return landmarks;
}

type MovementCase = {
  name: string;
  create: (side: RemoteUpperLimbBatterySide) => BatteryTestProcessor;
  frame: (side: RemoteUpperLimbBatterySide, value: number, visibility?: number) => PoseLandmark[];
  /** Peak used for movements performed before the test is armed. */
  preStartCycle: number[];
  /** Peak used for the real, armed repetitions. */
  armedCycle: number[];
  /** Asserts the recorded peak came from the armed cycle, not the pre-start one. */
  assertArmedPeak: (peak: number) => void;
};

const MOVEMENT_CASES: MovementCase[] = [
  {
    name: "shoulder flexion",
    create: createShoulderFlexionProcessor,
    frame: withShoulderFlexionElevation,
    preStartCycle: [15, 40, 90, 90, 40, 15],
    armedCycle: [15, 40, 65, 65, 40, 15],
    // Peak elevation is a maximum: the armed reps top out near 65°, the
    // pre-start ones near 90°.
    assertArmedPeak: (peak) => assert.ok(peak < 80, `pre-start peak survived arming: ${peak}`),
  },
  {
    name: "elbow flexion",
    create: createElbowFlexionProcessor,
    frame: withElbowInteriorAngle,
    preStartCycle: [150, 120, 60, 60, 120, 150],
    armedCycle: [150, 120, 80, 80, 120, 150],
    // Peak flexion is a minimum interior angle: armed reps bottom out near
    // 80°, the pre-start ones near 60°.
    assertArmedPeak: (peak) => assert.ok(peak > 70, `pre-start peak survived arming: ${peak}`),
  },
];

function runCycles(
  processor: BatteryTestProcessor,
  frame: MovementCase["frame"],
  side: RemoteUpperLimbBatterySide,
  cycle: number[],
  reps: number,
  startFrame = 0,
) {
  let frameIndex = startFrame;
  let snapshot = processor.processFrame(frame(side, cycle[0]!), {
    frameIndex,
    capturedAtMs: frameIndex * 33,
  });
  for (let rep = 0; rep < reps; rep += 1) {
    for (const value of cycle) {
      frameIndex += 1;
      snapshot = processor.processFrame(frame(side, value), {
        frameIndex,
        capturedAtMs: frameIndex * 33,
      });
    }
  }
  return { snapshot, nextFrame: frameIndex + 1 };
}

describe("battery movement gating (CV-1 / CV-5)", () => {
  for (const movement of MOVEMENT_CASES) {
    for (const side of ["right", "left"] as const) {
      it(`${movement.name} counts three ${side}-side reps once armed`, () => {
        const processor = movement.create(side);
        processor.beginMovementTracking();
        const { snapshot } = runCycles(processor, movement.frame, side, movement.armedCycle, 3);
        assert.equal(snapshot.repCount, 3);
        assert.equal(snapshot.completedPeaksDeg.length, 3);
      });

      it(`${movement.name} discards ${side}-side movement performed before arming`, () => {
        const processor = movement.create(side);

        const beforeArming = runCycles(
          processor,
          movement.frame,
          side,
          movement.preStartCycle,
          2,
        );
        assert.equal(beforeArming.snapshot.repCount, 0);
        assert.deepEqual(beforeArming.snapshot.completedPeaksDeg, []);
        assert.equal(beforeArming.snapshot.movementPhase, "idle");
        assert.equal(processor.isMovementTrackingEnabled(), false);
        // Positioning still needs a usable readiness signal while unarmed.
        assert.equal(beforeArming.snapshot.trackingReady, true);

        processor.beginMovementTracking();
        assert.equal(processor.isMovementTrackingEnabled(), true);

        const afterArming = runCycles(
          processor,
          movement.frame,
          side,
          movement.armedCycle,
          3,
          beforeArming.nextFrame,
        );
        assert.equal(afterArming.snapshot.repCount, 3);

        const peaks = afterArming.snapshot.completedPeaksDeg;
        assert.equal(peaks.length, 3);
        for (const peak of peaks) {
          movement.assertArmedPeak(peak);
        }
      });
    }
  }
});

describe("gated vs raw rep count (CV-6)", () => {
  /**
   * Replays the session's own rep-dispatch rule: a repetition reaches the
   * orchestrator only while the test is active AND tracking is usable. Frames
   * captured while tracking is unusable still reach the processor, so its raw
   * repCount can run ahead — the persisted result must follow the gated count.
   */
  it("persisted count follows the gated count, not raw processor reps", () => {
    const side = "right" as const;
    const processor = createShoulderFlexionProcessor(side);
    processor.beginMovementTracking();

    let orchestrator: BatteryOrchestratorState = {
      ...startBatteryAssessment(createBatteryOrchestratorState()),
      testIndex: 1,
      phase: "test_active",
    };
    let lastDispatchedRep = 0;
    let frameIndex = 0;

    const feed = (elevation: number, visibility: number) => {
      frameIndex += 1;
      const snapshot = processor.processFrame(
        withShoulderFlexionElevation(side, elevation, visibility),
        { frameIndex, capturedAtMs: frameIndex * 33 },
      );
      const trackingUsable = isBatteryProcessorTrackingUsable(snapshot);
      if (trackingUsable && snapshot.repCount > lastDispatchedRep) {
        lastDispatchedRep = snapshot.repCount;
        orchestrator = recordBatteryRepCompleted(orchestrator, snapshot.lastRepPeak);
      }
      return snapshot;
    };

    const cycle = [15, 40, 65, 65, 40, 15];
    // Landmarks stay confident enough for the elevation metric (>= 0.35) but
    // fall into the "poor" visibility band, which is exactly the state where
    // the processor keeps counting while the session refuses to dispatch.
    const DEGRADED_VISIBILITY = 0.38;

    // One clean repetition with good tracking.
    for (const elevation of cycle) feed(elevation, 0.9);
    assert.equal(orchestrator.repsCompleted, 1);

    // Tracking degrades while the patient keeps moving: two further raw
    // repetitions are produced that the gated flow must reject.
    let snapshot = feed(15, DEGRADED_VISIBILITY);
    assert.equal(isBatteryProcessorTrackingUsable(snapshot), false);
    for (let rep = 0; rep < 2; rep += 1) {
      for (const elevation of cycle) snapshot = feed(elevation, DEGRADED_VISIBILITY);
    }

    // Recovery.
    for (const elevation of cycle) snapshot = feed(elevation, 0.9);

    const rawProcessorReps = snapshot.repCount;
    assert.ok(
      rawProcessorReps > orchestrator.repsCompleted,
      "expected raw processor reps to run ahead of the gated count",
    );

    // The fix: persist the gated count. The previous
    // Math.max(orchestrator.repsCompleted, processor.repCount) would have
    // published the hidden reps instead.
    assert.equal(
      Math.max(orchestrator.repsCompleted, rawProcessorReps) > orchestrator.repsCompleted,
      true,
    );
    assert.ok(orchestrator.repsCompleted < rawProcessorReps);
  });

  it("session finalisation reads the orchestrator count, not a raw max", () => {
    const source = readFileSync(SESSION, "utf8");
    assert.match(source, /repsCompleted: orchestrator\.repsCompleted/);
    assert.doesNotMatch(source, /Math\.max\(orchestrator\.repsCompleted, processor\.repCount\)/);
    assert.match(source, /completedPeaksDeg\.slice\(0, orchestrator\.repsCompleted\)/);
  });

  it("session arms every test at test_active, not only functional reach", () => {
    const source = readFileSync(SESSION, "utf8");
    assert.match(source, /movementArmedRef/);
    assert.match(source, /armActiveTestProcessor/);
    assert.match(source, /processorRef\.current\.beginMovementTracking\(\)/);
    assert.doesNotMatch(source, /activeTestId !== "functionalReach"/);
  });
});
