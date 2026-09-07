/**
 * Run: npx tsx --test app/lib/remote-upper-limb-battery/battery-functional-reach-processor.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  computeReachExtentForSide,
  mockFunctionalReachLandmarks,
} from "@/app/lib/cv/functional-reach-detector";
import { PATIENT_FUNCTIONAL_REACH_REP_CONFIG } from "@/app/lib/cv/cv-patient-config";
import type { RemoteUpperLimbBatterySide } from "./types";
import {
  createFunctionalReachProcessor,
  createPreviewPositionProcessor,
  resolveFunctionalReachCompletedAttempts,
} from "./battery-frame-processors";
import {
  completeBatteryTest,
  createBatteryOrchestratorState,
  getActiveBatteryTestId,
  markBatterySubmitting,
  recordBatteryRepCompleted,
  startBatteryAssessment,
  buildRepTestResult,
} from "./battery-orchestrator";

const BASELINE_MS = PATIENT_FUNCTIONAL_REACH_REP_CONFIG.baselineDurationMs;
const R_SHOULDER = 12;
const R_WRIST = 16;
const SESSION = join(
  process.cwd(),
  "app/components/patient/RemoteUpperLimbBatterySession.tsx",
);

function ctx(capturedAtMs: number, frameIndex = 0) {
  return { frameIndex, capturedAtMs };
}

const L_SHOULDER = 11;
const L_WRIST = 15;

/**
 * Side-view landmarks carrying a given forward reach extent.
 *
 * Raw (unmirrored) landmark space: a right-side test leaves the patient facing
 * +x and a left-side test faces -x, so the two sides are exact x-mirrors and a
 * positive `reachExtent` means the same physical forward reach on both. See the
 * convention trace on `computeReachExtentForSide`.
 */
function reachLandmarks(
  side: RemoteUpperLimbBatterySide,
  reachExtent: number,
  vis = 0.85,
): PoseLandmark[] {
  const landmarks = mockFunctionalReachLandmarks(reachExtent, vis);
  const testedShoulderX = side === "right" ? 0.42 : 0.58;
  const wristX =
    side === "right" ? testedShoulderX + reachExtent : testedShoulderX - reachExtent;
  const testedShoulder = side === "right" ? R_SHOULDER : L_SHOULDER;
  const testedWrist = side === "right" ? R_WRIST : L_WRIST;
  const otherShoulder = side === "right" ? L_SHOULDER : R_SHOULDER;
  const otherWrist = side === "right" ? L_WRIST : R_WRIST;

  landmarks[testedShoulder] = { x: testedShoulderX, y: 0.32, visibility: vis };
  landmarks[testedWrist] = { x: wristX, y: 0.38, visibility: vis };
  // Far side is occluded in a true side view.
  landmarks[otherShoulder] = { x: side === "right" ? 0.58 : 0.42, y: 0.32, visibility: vis * 0.2 };
  landmarks[otherWrist] = { x: side === "right" ? 0.62 : 0.38, y: 0.42, visibility: vis * 0.2 };
  landmarks[23] = { x: 0.45, y: 0.55, visibility: vis };
  landmarks[24] = { x: 0.55, y: 0.55, visibility: vis };
  return landmarks;
}

function rightReachLandmarks(reachExtent: number, vis = 0.85): PoseLandmark[] {
  return reachLandmarks("right", reachExtent, vis);
}

function feedExtent(
  processor: ReturnType<typeof createFunctionalReachProcessor>,
  extent: number,
  startMs: number,
  durationMs: number,
  side: RemoteUpperLimbBatterySide = "right",
  vis = 0.85,
) {
  let snapshot = processor.processFrame(reachLandmarks(side, extent, vis), ctx(startMs));
  for (let t = startMs + 33; t <= startMs + durationMs; t += 33) {
    snapshot = processor.processFrame(reachLandmarks(side, extent, vis), ctx(t));
  }
  return snapshot;
}

/**
 * One full attempt in the rep engine's CURRENT convention.
 *
 * `FunctionalReachRepCounter` runs the shared sagittal FSM at "rise" polarity,
 * which enters `peak` when the driven signal falls below baseline − delta. The
 * excursion below the baseline extent is therefore what completes an attempt
 * today. See the PR notes: this is a separate, reported finding from CV-4 and
 * is deliberately NOT changed here.
 */
function completeReachCycle(
  processor: ReturnType<typeof createFunctionalReachProcessor>,
  side: RemoteUpperLimbBatterySide = "right",
) {
  processor.beginMovementTracking();
  const restExtent = 0.1;
  const peakExtent = 0.02;
  feedExtent(processor, restExtent, 0, BASELINE_MS, side);
  feedExtent(processor, peakExtent, BASELINE_MS + 900, 200, side);
  feedExtent(processor, peakExtent, BASELINE_MS + 1_200, 200, side);
  return feedExtent(processor, restExtent, BASELINE_MS + 1_600, 400, side);
}

describe("resolveFunctionalReachCompletedAttempts", () => {
  it("requires movement tracking, baseline, internal rep, and return to rest", () => {
    assert.equal(
      resolveFunctionalReachCompletedAttempts({
        movementTrackingEnabled: false,
        baselineReachExtent: 0.1,
        internalRepCount: 1,
        repPhase: "rest",
      }),
      0,
    );
    assert.equal(
      resolveFunctionalReachCompletedAttempts({
        movementTrackingEnabled: true,
        baselineReachExtent: null,
        internalRepCount: 1,
        repPhase: "rest",
      }),
      0,
    );
    assert.equal(
      resolveFunctionalReachCompletedAttempts({
        movementTrackingEnabled: true,
        baselineReachExtent: 0.1,
        internalRepCount: 1,
        repPhase: "peak",
      }),
      0,
    );
    assert.equal(
      resolveFunctionalReachCompletedAttempts({
        movementTrackingEnabled: true,
        baselineReachExtent: 0.1,
        internalRepCount: 1,
        repPhase: "rest",
      }),
      1,
    );
  });
});

describe("functional reach battery processor", () => {
  it("does not count reps before movement tracking is armed", () => {
    const processor = createFunctionalReachProcessor("right");
    const snapshot = feedExtent(processor, 0.1, 0, BASELINE_MS + 2_000);
    assert.equal(snapshot.repCount, 0);
    assert.equal(processor.isMovementTrackingEnabled(), false);
  });

  it("stable positioning via preview processor never completes functional reach", () => {
    const preview = createPreviewPositionProcessor("right");
    const snapshot = preview.processFrame(rightReachLandmarks(0.1), ctx(0));
    assert.equal(snapshot.repCount, 0);
    assert.equal(snapshot.movementPhase, "preview");
  });

  it("arm already forward before arming does not complete on entry", () => {
    const processor = createFunctionalReachProcessor("right");
    feedExtent(processor, 0.14, 0, BASELINE_MS);
    processor.beginMovementTracking();
    const snapshot = feedExtent(processor, 0.14, BASELINE_MS + 500, BASELINE_MS);
    assert.equal(snapshot.repCount, 0);
  });

  it("forward excursion without return does not complete", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();
    feedExtent(processor, 0.1, 0, BASELINE_MS);
    const snapshot = feedExtent(processor, 0.02, BASELINE_MS + 900, 500);
    assert.equal(snapshot.repCount, 0);
    assert.equal(snapshot.movementPhase, "peak");
  });

  it("return without prior valid excursion does not complete", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();
    const snapshot = feedExtent(processor, 0.1, 0, BASELINE_MS + 2_000);
    assert.equal(snapshot.repCount, 0);
  });

  it("completes exactly one attempt after reach and return", () => {
    const processor = createFunctionalReachProcessor("right");
    const snapshot = completeReachCycle(processor);
    assert.equal(snapshot.repCount, 1);
    const after = feedExtent(processor, 0.1, BASELINE_MS + 3_000, 500);
    assert.equal(after.repCount, 1);
  });

  it("reset on retry clears functional reach attempt state", () => {
    const processor = createFunctionalReachProcessor("right");
    completeReachCycle(processor);
    processor.reset();
    assert.equal(processor.isMovementTrackingEnabled(), false);
    const snapshot = processor.processFrame(rightReachLandmarks(0.1), ctx(0));
    assert.equal(snapshot.repCount, 0);
    processor.beginMovementTracking();
    const afterRetry = feedExtent(processor, 0.1, 0, BASELINE_MS + 500);
    assert.equal(afterRetry.repCount, 0);
  });
});

describe("functional reach direction is side-aware (CV-4)", () => {
  // Baseline posture for the test: arm already raised forward to shoulder
  // height, so the wrist starts an arm's length ahead of the shoulder.
  const BASELINE_AHEAD = 0.1;
  const REACHED_AHEAD = 0.18;

  for (const side of ["right", "left"] as const) {
    it(`a forward ${side}-side reach is positive and increasing`, () => {
      const atStart = computeReachExtentForSide(reachLandmarks(side, BASELINE_AHEAD), side);
      const atFullReach = computeReachExtentForSide(reachLandmarks(side, REACHED_AHEAD), side);

      assert.ok(atStart !== null && atFullReach !== null);
      assert.ok(atStart > 0, `${side} start extent should be positive, got ${atStart}`);
      assert.ok(
        atFullReach > atStart,
        `${side} reach should increase the extent: ${atStart} -> ${atFullReach}`,
      );
    });
  }

  it("both sides measure a mirrored reach identically", () => {
    for (const extent of [0.02, 0.1, 0.18]) {
      const right = computeReachExtentForSide(reachLandmarks("right", extent), "right");
      const left = computeReachExtentForSide(reachLandmarks("left", extent), "left");
      assert.ok(right !== null && left !== null);
      assert.ok(
        Math.abs(right - left) < 1e-9,
        `mirrored reach should match: right=${right} left=${left}`,
      );
    }
  });

  it("a left-side reach is no longer clamped to zero", () => {
    // The previous Math.max(0, wrist.x - shoulder.x) produced a permanent 0 for
    // a left-side patient, because their forward direction is -x.
    const extent = computeReachExtentForSide(reachLandmarks("left", 0.18), "left");
    assert.ok(extent !== null && extent > 0.17);
  });

  it("returns null instead of a fabricated zero below the visibility gate", () => {
    const landmarks = reachLandmarks("right", 0.18, 0.05);
    assert.equal(computeReachExtentForSide(landmarks, "right", { minVisibility: 0.28 }), null);
    // Default keeps the existing behaviour for callers that gate elsewhere.
    assert.ok((computeReachExtentForSide(landmarks, "right") ?? 0) > 0.17);
  });
});

describe("functional reach left-side behaviour (CV-5)", () => {
  it("completes exactly one left-side attempt after reach and return", () => {
    const processor = createFunctionalReachProcessor("left");
    const snapshot = completeReachCycle(processor, "left");
    assert.equal(snapshot.repCount, 1);
    assert.ok((snapshot.peakReachExtent ?? 0) > 0, "left peak reach extent should be positive");

    const after = feedExtent(processor, 0.1, BASELINE_MS + 3_000, 500, "left");
    assert.equal(after.repCount, 1);
  });

  it("does not count left-side reps before movement tracking is armed", () => {
    const processor = createFunctionalReachProcessor("left");
    const snapshot = feedExtent(processor, 0.1, 0, BASELINE_MS + 2_000, "left");
    assert.equal(snapshot.repCount, 0);
    assert.equal(snapshot.peakReachExtent, null);
    assert.equal(processor.isMovementTrackingEnabled(), false);
  });
});

describe("functional reach freezes on unusable frames (CV-3)", () => {
  const UNUSABLE_VIS = 0.05;

  it("does not begin the baseline window while frames are unusable", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();

    // Longer than a full baseline window, all of it unusable.
    const blind = feedExtent(processor, 0.1, 0, BASELINE_MS + 1_000, "right", UNUSABLE_VIS);
    assert.equal(blind.trackingReady, false);
    assert.equal(blind.peakReachExtent, null);
    assert.equal(blind.repCount, 0);

    // The baseline window only opens once real frames arrive. If it had opened
    // during the blackout it would already have expired, finalise to the
    // fallback baseline on the first valid frame, and let this excursion and
    // return complete a whole attempt the patient never performed.
    feedExtent(processor, 0.02, BASELINE_MS + 1_100, 400, "right");
    const afterExcursionAndReturn = feedExtent(
      processor,
      0.1,
      BASELINE_MS + 1_600,
      400,
      "right",
    );
    assert.equal(afterExcursionAndReturn.repCount, 0);
  });

  it("does not transition phase on unusable frames during rest", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();
    feedExtent(processor, 0.1, 0, BASELINE_MS, "right");
    const atRest = feedExtent(processor, 0.1, BASELINE_MS + 100, 200, "right");
    assert.equal(atRest.movementPhase, "rest");

    const blind = feedExtent(processor, 0.02, BASELINE_MS + 400, 600, "right", UNUSABLE_VIS);
    assert.equal(blind.movementPhase, "rest");
    assert.equal(blind.repCount, 0);
  });

  it("does not advance the rep FSM on unusable frames during the reach", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();
    feedExtent(processor, 0.1, 0, BASELINE_MS, "right");

    // A full excursion and return that is never actually seen.
    feedExtent(processor, 0.02, BASELINE_MS + 900, 400, "right", UNUSABLE_VIS);
    const afterReturn = feedExtent(
      processor,
      0.1,
      BASELINE_MS + 1_400,
      400,
      "right",
      UNUSABLE_VIS,
    );
    assert.equal(afterReturn.repCount, 0);
    assert.equal(afterReturn.movementPhase, "rest");
  });

  it("leaves peakReachExtent untouched on an unusable frame with extreme coordinates", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();
    feedExtent(processor, 0.1, 0, BASELINE_MS, "right");
    const before = feedExtent(processor, 0.1, BASELINE_MS + 100, 200, "right");
    const peakBefore = before.peakReachExtent;
    assert.ok(peakBefore !== null);

    // Wrist snaps to the frame edge while effectively invisible.
    const extreme = reachLandmarks("right", 0.55, UNUSABLE_VIS);
    const after = processor.processFrame(extreme, ctx(BASELINE_MS + 400));
    assert.equal(after.peakReachExtent, peakBefore);
    assert.equal(after.repCount, 0);
  });

  it("resumes from valid frames after recovery without a false completion", () => {
    const processor = createFunctionalReachProcessor("right");
    processor.beginMovementTracking();
    feedExtent(processor, 0.1, 0, BASELINE_MS, "right");

    // Dropout across what would have been the excursion.
    feedExtent(processor, 0.02, BASELINE_MS + 900, 600, "right", UNUSABLE_VIS);
    const recovered = feedExtent(processor, 0.1, BASELINE_MS + 1_600, 400, "right");
    assert.equal(recovered.repCount, 0, "recovery must not back-fill a missed attempt");

    // A genuine, fully observed excursion still completes afterwards.
    feedExtent(processor, 0.02, BASELINE_MS + 2_200, 200, "right");
    feedExtent(processor, 0.02, BASELINE_MS + 2_500, 200, "right");
    const completed = feedExtent(processor, 0.1, BASELINE_MS + 2_900, 400, "right");
    assert.equal(completed.repCount, 1);
  });
});

describe("functional reach battery completion wiring", () => {
  it("entering functional reach positioning does not complete the battery", () => {
    let state = startBatteryAssessment(createBatteryOrchestratorState());
    for (const testId of ["shoulderAbduction", "shoulderFlexion", "elbowFlexion"] as const) {
      for (let rep = 0; rep < 3; rep += 1) {
        state = { ...state, phase: "test_active" };
        state = recordBatteryRepCompleted(state, 70);
      }
      state = completeBatteryTest(
        state,
        buildRepTestResult({
          testId,
          repsCompleted: 3,
          repsRequired: 3,
          peakAnglesDeg: [70],
          trackingQuality: "good",
        }),
      );
      if (testId === "shoulderAbduction") {
        state = { ...state, phase: "positioning" };
      }
    }
    assert.equal(getActiveBatteryTestId(state), "functionalReach");
    assert.equal(state.phase, "positioning");
    assert.notEqual(state.phase, "assessment_completed");
    assert.equal(state.results.length, 3);
  });

  it("battery auto-submit guard remains single-fire", () => {
    const source = readFileSync(SESSION, "utf8");
    // `functionalReachArmedRef` / `armFunctionalReachProcessor` became
    // `movementArmedRef` / `armActiveTestProcessor` when arming was generalised
    // from functional reach to every test (CV-1). Same guards, wider scope.
    assert.match(source, /movementArmedRef/);
    assert.match(source, /bindPreviewProcessor\(\)/);
    assert.match(source, /armActiveTestProcessor/);
    assert.match(source, /orchestrator\.phase !== "test_active"/);
    assert.match(source, /submitAttempted/);
  });

  it("marks assessment completed only after functional reach rep is recorded in test_active", () => {
    let state = startBatteryAssessment(createBatteryOrchestratorState());
    state = {
      ...state,
      testIndex: 3,
      phase: "test_active",
      repsCompleted: 0,
      results: [
        buildRepTestResult({
          testId: "shoulderAbduction",
          repsCompleted: 3,
          repsRequired: 3,
          peakAnglesDeg: [80],
          trackingQuality: "good",
        }),
        buildRepTestResult({
          testId: "shoulderFlexion",
          repsCompleted: 3,
          repsRequired: 3,
          peakAnglesDeg: [60],
          trackingQuality: "good",
        }),
        buildRepTestResult({
          testId: "elbowFlexion",
          repsCompleted: 3,
          repsRequired: 3,
          peakAnglesDeg: [75],
          trackingQuality: "good",
        }),
      ],
    };
    assert.equal(getActiveBatteryTestId(state), "functionalReach");
    state = recordBatteryRepCompleted(state, 0.12);
    assert.equal(state.phase, "test_completed");
    state = completeBatteryTest(state, {
      testId: "functionalReach",
      attemptsCompleted: 1,
      attemptsRequired: 1,
      peakReachExtent: 0.12,
      trackingQuality: "good",
      steppingMeasured: false,
      therapistReviewNote: "note",
    });
    assert.equal(state.phase, "assessment_completed");
    state = markBatterySubmitting(state);
    assert.equal(state.submitAttempted, true);
  });

  it("does not record functional reach reps outside test_active", () => {
    let state = {
      ...startBatteryAssessment(createBatteryOrchestratorState()),
      testIndex: 3,
      phase: "positioning" as const,
    };
    state = recordBatteryRepCompleted(state, 0.12);
    assert.equal(state.repsCompleted, 0);
    assert.equal(state.phase, "positioning");
  });
});
