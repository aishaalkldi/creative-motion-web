/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/cv/forward-reach-camera-detector.test.ts"
 *
 * ForwardReachCameraDetector itself requires a browser DOM (video/canvas
 * elements, getUserMedia, MediaPipe) and is not unit-tested anywhere in
 * this codebase (no test file exists for the pre-existing detector
 * either). This file tests the exported, pure functions this module
 * adds so the DOM-touching class can stay thin:
 *
 * - deriveNextForwardReachAttemptResult — the terminal-result latch.
 * - shouldAutoDispatchForwardReachAttemptWindowEnd — the automatic
 *   end-of-attempt-window decision (completed_pending_finalization,
 *   exactly once). The simulated-frame-loop describe block below drives
 *   this decision function against the real engine using the same
 *   command sequence as the happy-path demo fixture, proving that a
 *   full successful reach+return sequence reaches terminal=true with an
 *   attemptResult, and that the dispatch fires exactly once.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCapturedForwardReachStartingZonePoint,
  computeForwardReachStartingZoneGuidance,
  computeForwardReachZoneRadiusPixels,
  deriveNextForwardReachAttemptResult,
  nextForwardReachAction,
  shouldArmForwardReachReadiness,
  shouldAutoDispatchForwardReachAttemptWindowEnd,
  shouldStartForwardReachCalibration,
  FORWARD_REACH_START_CAPTURE_CONFIG,
  type ForwardReachCameraStatus,
} from "./forward-reach-camera-detector";
import {
  applyForwardReachCommand,
  createForwardReachAttemptState,
  validateForwardReachConfig,
  FORWARD_REACH_PHASES,
  type ForwardReachAttemptState,
  type ForwardReachCommand,
  type ForwardReachPhase,
} from "@/app/lib/upper-limb-motor-screen/forward-reach-engine";
import {
  createLateralReachStartCaptureState,
  updateLateralReachStartCapture,
} from "@/app/lib/interaction-calibration/lateral-reach/start-capture";
import {
  buildForwardReachDemoConfig,
  buildHappyPathScenario,
} from "@/app/lib/upper-limb-motor-screen/forward-reach-demo-fixtures";
import { MOTION_INTELLIGENCE_SCHEMA_VERSION, type JointId, type NormalizedMotionFrame } from "@/app/lib/motion-intelligence";
import type { UpperLimbMovementAttemptResult, UpperLimbSide } from "@/app/lib/upper-limb-motor-screen/types";

function makeAttemptResult(
  overrides: Partial<UpperLimbMovementAttemptResult> = {},
): UpperLimbMovementAttemptResult {
  return {
    attemptIndex: 0,
    taskId: "forwardReach",
    testedSide: "right",
    startedAtMs: 0,
    completedAtMs: 1000,
    completionState: "completed",
    targetReached: true,
    dwellConfirmed: true,
    returnToStartCompleted: true,
    reachTimeMs: 400,
    returnTimeMs: 400,
    totalMovementTimeMs: 1000,
    normalizedPathLength: 0.3,
    pathEfficiency: 0.9,
    peakShoulderAngleDeg: null,
    peakElbowExtensionDeg: null,
    trunkDisplacementObserved: null,
    withinConfiguredLimitThroughout: null,
    trackingQualitySummary: "good",
    protectivePauseCount: 0,
    protectivePauseDurationMs: 0,
    protectivePauseEvents: [],
    factualNotes: [],
    ...overrides,
  };
}

describe("deriveNextForwardReachAttemptResult", () => {
  it("retains the engine's terminal attemptResult verbatim (same reference) when one is produced", () => {
    const terminal = makeAttemptResult();
    const next = deriveNextForwardReachAttemptResult(
      { status: "applied", attemptResult: terminal },
      null,
    );
    assert.equal(next, terminal, "must be the exact same object — never recomputed or copied");
  });

  it("keeps the previous terminal result when a later applied command carries no attemptResult (e.g. a mid-attempt frame)", () => {
    const terminal = makeAttemptResult();
    const next = deriveNextForwardReachAttemptResult({ status: "applied", attemptResult: null }, terminal);
    assert.equal(next, terminal);
  });

  it("keeps the previous terminal result when a command is rejected", () => {
    const terminal = makeAttemptResult();
    const next = deriveNextForwardReachAttemptResult({ status: "rejected" }, terminal);
    assert.equal(next, terminal);
  });

  it("stays null before any terminal result has ever been produced", () => {
    const next = deriveNextForwardReachAttemptResult({ status: "applied", attemptResult: null }, null);
    assert.equal(next, null);
  });

  it("a later terminal result overwrites (does not merge with) the previous one", () => {
    const first = makeAttemptResult({ completionState: "stopped" });
    const second = makeAttemptResult({ completionState: "completed" });
    const next = deriveNextForwardReachAttemptResult({ status: "applied", attemptResult: second }, first);
    assert.equal(next, second);
  });

  it("does not mutate the engine result or the previous value it was given", () => {
    const terminal = makeAttemptResult();
    const engineResult = { status: "applied" as const, attemptResult: terminal };
    const engineResultSnapshot = JSON.parse(JSON.stringify(engineResult));
    deriveNextForwardReachAttemptResult(engineResult, null);
    assert.deepEqual(engineResult, engineResultSnapshot);
  });
});

describe("shouldAutoDispatchForwardReachAttemptWindowEnd", () => {
  it("is true once the engine reaches completed_pending_finalization and no dispatch has happened yet", () => {
    assert.equal(
      shouldAutoDispatchForwardReachAttemptWindowEnd("completed_pending_finalization", false),
      true,
    );
  });

  it("is false once already dispatched, even while still reading completed_pending_finalization", () => {
    assert.equal(
      shouldAutoDispatchForwardReachAttemptWindowEnd("completed_pending_finalization", true),
      false,
    );
  });

  it("is false for every phase other than completed_pending_finalization, dispatched or not", () => {
    for (const phase of FORWARD_REACH_PHASES) {
      if (phase === "completed_pending_finalization") continue;
      assert.equal(
        shouldAutoDispatchForwardReachAttemptWindowEnd(phase, false),
        false,
        `phase "${phase}" with dispatched=false must not trigger auto-dispatch`,
      );
      assert.equal(
        shouldAutoDispatchForwardReachAttemptWindowEnd(phase, true),
        false,
        `phase "${phase}" with dispatched=true must not trigger auto-dispatch`,
      );
    }
  });
});

describe("shouldArmForwardReachReadiness", () => {
  const runningStatuses: ForwardReachCameraStatus[] = ["idle", "initializing", "running", "error"];

  it("is true when running, in idle or awaiting_readiness, not already armed, and calibration is captured", () => {
    assert.equal(shouldArmForwardReachReadiness("running", "idle", false, "captured"), true);
    assert.equal(shouldArmForwardReachReadiness("running", "awaiting_readiness", false, "captured"), true);
  });

  it("is false when already armed — a redundant Arm-readiness call must not reset the in-progress stability timer", () => {
    assert.equal(shouldArmForwardReachReadiness("running", "idle", true, "captured"), false);
    assert.equal(shouldArmForwardReachReadiness("running", "awaiting_readiness", true, "captured"), false);
  });

  it("is false when status is not running, armed or not", () => {
    for (const status of runningStatuses) {
      if (status === "running") continue;
      assert.equal(shouldArmForwardReachReadiness(status, "idle", false, "captured"), false, `status ${status}`);
      assert.equal(shouldArmForwardReachReadiness(status, "idle", true, "captured"), false, `status ${status}`);
    }
  });

  it("is false for every phase other than idle/awaiting_readiness, armed or not", () => {
    for (const phase of FORWARD_REACH_PHASES) {
      if (phase === "idle" || phase === "awaiting_readiness") continue;
      assert.equal(shouldArmForwardReachReadiness("running", phase, false, "captured"), false, `phase ${phase}`);
      assert.equal(shouldArmForwardReachReadiness("running", phase, true, "captured"), false, `phase ${phase}`);
    }
  });

  it("is false whenever calibration has not been captured yet, even when every other condition is satisfied — arming against an uncalibrated placeholder zone must be impossible", () => {
    assert.equal(shouldArmForwardReachReadiness("running", "idle", false, "not_started"), false);
    assert.equal(shouldArmForwardReachReadiness("running", "idle", false, "capturing"), false);
    assert.equal(shouldArmForwardReachReadiness("running", "idle", false, "failed"), false);
    assert.equal(shouldArmForwardReachReadiness("running", "awaiting_readiness", false, "not_started"), false);
  });
});

describe("shouldStartForwardReachCalibration", () => {
  it("is true when running, in idle or awaiting_readiness, and calibration has not started yet", () => {
    assert.equal(shouldStartForwardReachCalibration("running", "idle", "not_started"), true);
    assert.equal(shouldStartForwardReachCalibration("running", "awaiting_readiness", "not_started"), true);
  });

  it("is true from a failed calibration — a retry must be possible", () => {
    assert.equal(shouldStartForwardReachCalibration("running", "idle", "failed"), true);
  });

  it("is false while a capture is already in progress", () => {
    assert.equal(shouldStartForwardReachCalibration("running", "idle", "capturing"), false);
  });

  it("is false once already captured — the zone is frozen for the rest of this session, it must never restart and follow the wrist again", () => {
    assert.equal(shouldStartForwardReachCalibration("running", "idle", "captured"), false);
    assert.equal(shouldStartForwardReachCalibration("running", "awaiting_readiness", "captured"), false);
  });

  it("is false when status is not running", () => {
    assert.equal(shouldStartForwardReachCalibration("initializing", "idle", "not_started"), false);
    assert.equal(shouldStartForwardReachCalibration("error", "idle", "not_started"), false);
  });

  it("is false for every phase other than idle/awaiting_readiness", () => {
    for (const phase of FORWARD_REACH_PHASES) {
      if (phase === "idle" || phase === "awaiting_readiness") continue;
      assert.equal(shouldStartForwardReachCalibration("running", phase, "not_started"), false, `phase ${phase}`);
    }
  });
});

describe("applyCapturedForwardReachStartingZonePoint", () => {
  function baseConfig(testedSide: UpperLimbSide) {
    const result = validateForwardReachConfig({
      testedSide,
      fixedTarget: { point: { x: 0.7, y: 0.5 }, radius: 0.05 },
      startingZone: { point: { x: 0.3, y: 0.5 }, radius: 0.05 }, // placeholder
      tracking: { minWristVisibility: 0.3, maxAllowedGapMs: 300 },
      timing: { onsetConfirmationMs: 100, dwellDurationMs: 200, returnConfirmationMs: 150 },
    });
    if (!result.ok) throw new Error(`bad test fixture config: ${result.reason}`);
    return result.config;
  }

  it("moves fixedTarget.point by the SAME displacement as startingZone.point — the target must stay relative to the calibrated start, not remain at its old absolute screen coordinate", () => {
    const config = baseConfig("right");
    // Template's own start->target displacement: (0.7,0.5) - (0.3,0.5) = (+0.4, 0.0).
    const captured = { x: 0.2, y: 0.6 }; // deliberately far from the template's placeholder start

    const next = applyCapturedForwardReachStartingZonePoint(config, captured);

    assert.deepEqual(next.startingZone.point, captured);
    // Target re-anchored: captured + (0.4, 0.0) = (0.6, 0.6) — NOT the old (0.7, 0.5).
    assert.equal(next.fixedTarget.point.x, 0.6);
    assert.equal(next.fixedTarget.point.y, 0.6);
    assert.notDeepEqual(
      next.fixedTarget.point,
      config.fixedTarget.point,
      "fixedTarget must not remain at its old absolute point once the start has moved",
    );
  });

  it("preserves both radii and every other field verbatim", () => {
    const config = baseConfig("left");
    const captured = { x: 0.612, y: 0.734 };

    const next = applyCapturedForwardReachStartingZonePoint(config, captured);

    assert.equal(next.startingZone.radius, config.startingZone.radius);
    assert.equal(next.fixedTarget.radius, config.fixedTarget.radius);
    assert.deepEqual(next.tracking, config.tracking);
    assert.deepEqual(next.timing, config.timing);
    assert.equal(next.testedSide, config.testedSide);
  });

  it("preserves the exact displacement vector regardless of which direction the captured point is offset in", () => {
    const config = baseConfig("right");
    const originalDeltaX = config.fixedTarget.point.x - config.startingZone.point.x;
    const originalDeltaY = config.fixedTarget.point.y - config.startingZone.point.y;

    for (const captured of [
      { x: 0.1, y: 0.1 },
      { x: 0.05, y: 0.5 },
      { x: 0.4, y: 0.05 },
    ]) {
      const next = applyCapturedForwardReachStartingZonePoint(config, captured);
      assert.ok(
        Math.abs(next.fixedTarget.point.x - captured.x - originalDeltaX) < 1e-9,
        `x displacement not preserved for captured=${JSON.stringify(captured)}`,
      );
      assert.ok(
        Math.abs(next.fixedTarget.point.y - captured.y - originalDeltaY) < 1e-9,
        `y displacement not preserved for captured=${JSON.stringify(captured)}`,
      );
    }
  });

  it("does not mutate the base config it was given", () => {
    const config = baseConfig("left");
    const snapshot = JSON.parse(JSON.stringify(config));
    applyCapturedForwardReachStartingZonePoint(config, { x: 0.5, y: 0.5 });
    assert.deepEqual(config, snapshot);
  });
});

describe("nextForwardReachAction", () => {
  it("maps every phase to the single next action the clinician/patient must take", () => {
    assert.equal(nextForwardReachAction("idle", false), "hold_starting_position");
    assert.equal(nextForwardReachAction("awaiting_readiness", false), "hold_starting_position");
    assert.equal(nextForwardReachAction("ready_confirmed_awaiting_onset", false), "reach_to_target");
    assert.equal(nextForwardReachAction("outbound", false), "reach_to_target");
    assert.equal(nextForwardReachAction("dwelling", false), "hold_target");
    assert.equal(nextForwardReachAction("reach_confirmed", false), "return_to_start");
    assert.equal(nextForwardReachAction("returning", false), "return_to_start");
    assert.equal(nextForwardReachAction("completed_pending_finalization", false), "complete");
  });

  it("reports paused whenever an active pause exists, regardless of phase — the pause is always the real next action", () => {
    for (const phase of FORWARD_REACH_PHASES) {
      assert.equal(nextForwardReachAction(phase, true), "paused", `phase ${phase}`);
    }
  });

  it("after a resume reverts dwelling to outbound (per the engine's own tracking-loss handling), the next action correctly reads reach_to_target, not a stale hold_target", () => {
    // Mirrors resetContinuityCandidates in forward-reach-engine.ts: any
    // tracking loss while dwelling reverts phase to "outbound" before a
    // pause can even open, so once resumed (hasActivePause=false again)
    // the phase read here is genuinely "outbound" — this only asserts
    // the UX layer reflects that correctly, not the engine's own
    // (unchanged, already-tested) reversion logic.
    assert.equal(nextForwardReachAction("outbound", false), "reach_to_target");
  });
});

describe("session-specific starting-zone calibration — simulated end-to-end (no DOM)", () => {
  /**
   * Simulates exactly what ForwardReachCameraDetector.calibrateStartingPosition
   * does at runtime: feed samples into the SAME reused Lateral Reach
   * start-capture reducer at a deliberately arbitrary, non-default point
   * (nowhere near the old hardcoded (0.3, 0.5)), then freeze the result
   * into a fresh ForwardReachConfig and drive a full attempt through the
   * real, unmodified engine — proving a calibrated, patient-specific
   * starting position works end-to-end, for both tested sides, with no
   * regression to the automatic-finalization behavior.
   */
  function calibrateAndBuildConfig(testedSide: UpperLimbSide, arbitraryPoint: { x: number; y: number }) {
    let capture = createLateralReachStartCaptureState(0, FORWARD_REACH_START_CAPTURE_CONFIG);
    let captured: { x: number; y: number } | null = null;

    // Hold steady at the arbitrary point for enough samples/duration to capture.
    for (let i = 0; i < FORWARD_REACH_START_CAPTURE_CONFIG.minStableSampleCount + 2; i++) {
      const atMs = i * 200; // spaced out so minStableDurationMs (750ms) is crossed
      const update = updateLateralReachStartCapture(capture, {
        atMs,
        wrist: arbitraryPoint,
        trackingValid: true,
      });
      if (update.status === "collecting") {
        capture = update.state;
      } else if (update.status === "captured") {
        captured = update.startWrist;
        break;
      } else {
        throw new Error(`calibration unexpectedly failed: ${update.failureReasons.join(", ")}`);
      }
    }
    if (!captured) throw new Error("calibration did not capture within the simulated sample budget");

    // Same start->target displacement as the real production RUNTIME_CONFIG
    // ((0.7,0.5) - (0.3,0.5) = (+0.4, 0.0)) — this is the delta that must
    // be preserved verbatim by applyCapturedForwardReachStartingZonePoint
    // regardless of where the placeholder points below happen to sit.
    const templateResult = validateForwardReachConfig({
      testedSide,
      fixedTarget: { point: { x: 0.7, y: 0.5 }, radius: 0.03 },
      startingZone: { point: { x: 0.3, y: 0.5 }, radius: 0.05 }, // placeholder — must never survive into the final config
      tracking: { minWristVisibility: 0.3, maxAllowedGapMs: 300 },
      timing: { onsetConfirmationMs: 100, dwellDurationMs: 200, returnConfirmationMs: 150 },
    });
    if (!templateResult.ok) throw new Error(`bad template: ${templateResult.reason}`);

    const candidate = applyCapturedForwardReachStartingZonePoint(templateResult.config, captured);
    const validated = validateForwardReachConfig(candidate);
    if (!validated.ok) throw new Error(`calibrated config invalid: ${validated.reason}`);
    return { config: validated.config, captured };
  }

  for (const testedSide of ["right", "left"] as const) {
    it(`(${testedSide}) a full reach+return sequence around the calibrated point reaches terminal=true with a completed attemptResult, not the placeholder point`, () => {
      const arbitraryStart = { x: 0.55, y: 0.62 }; // nowhere near (0.3, 0.5) or the placeholder
      const { config, captured } = calibrateAndBuildConfig(testedSide, arbitraryStart);

      // The frozen zone is the captured point, never the placeholder or
      // the old hardcoded default.
      assert.deepEqual(config.startingZone.point, captured);
      assert.notDeepEqual(config.startingZone.point, { x: 0.3, y: 0.5 });

      // The target re-anchored relative to the captured start (same +0.4/
      // +0.0 displacement as the template), NOT left at the old absolute
      // (0.7, 0.5) — this is this turn's actual fix.
      assert.notDeepEqual(config.fixedTarget.point, { x: 0.7, y: 0.5 });
      assert.ok(Math.abs(config.fixedTarget.point.x - (captured.x + 0.4)) < 1e-9);
      assert.ok(Math.abs(config.fixedTarget.point.y - captured.y) < 1e-9);

      const created = createForwardReachAttemptState(config, 0, 0);
      if (!created.ok) throw new Error(`init failed: ${created.reason}`);

      const jointPoint = arbitraryStart;
      const targetPoint = config.fixedTarget.point;

      function buildFrame(nowMs: number, point: { x: number; y: number }): NormalizedMotionFrame {
        const jointId: JointId = testedSide === "right" ? "right_wrist" : "left_wrist";
        return {
          schemaVersion: MOTION_INTELLIGENCE_SCHEMA_VERSION,
          source: { kind: "web_camera_pose", capturedAtMs: nowMs, frameIndex: 0, coordinateSpace: "normalized_2d" },
          joints: { [jointId]: { landmark: { x: point.x, y: point.y }, confidence: { visibility: 0.9, present: true } } },
        };
      }

      function frameAt(nowMs: number, point: { x: number; y: number }): ForwardReachCommand {
        return { type: "frame", nowMs, frame: buildFrame(nowMs, point) };
      }

      const commands: ForwardReachCommand[] = [
        frameAt(0, jointPoint),
        { type: "readinessConfirmed", nowMs: 10, confirmedBy: "clinician" },
        frameAt(20, targetPoint),
        frameAt(140, targetPoint),
        frameAt(250, targetPoint),
        frameAt(300, targetPoint),
        frameAt(350, targetPoint),
        frameAt(460, targetPoint),
        frameAt(600, jointPoint),
        frameAt(650, jointPoint),
        frameAt(700, jointPoint),
        frameAt(760, jointPoint), // elapsed since re-entry (600) = 160ms >= returnConfirmationMs (150ms)
      ];

      let state: ForwardReachAttemptState = created.state;
      let dispatched = false;
      let dispatchCount = 0;
      let attemptResult: UpperLimbMovementAttemptResult | null = null;

      for (const command of commands) {
        const result = applyForwardReachCommand(state, command);
        assert.equal(result.status, "applied", `command ${command.type}@${command.nowMs} rejected: ${(result as { reason?: string }).reason}`);
        state = result.state;
        if (result.attemptResult) attemptResult = result.attemptResult;

        if (
          state.phase === "completed_pending_finalization" &&
          !dispatched
        ) {
          dispatched = true;
          dispatchCount += 1;
          const windowEnd = applyForwardReachCommand(state, { type: "attemptWindowEnded", nowMs: command.nowMs });
          assert.equal(windowEnd.status, "applied");
          state = windowEnd.state;
          if (windowEnd.attemptResult) attemptResult = windowEnd.attemptResult;
        }
      }

      assert.equal(dispatchCount, 1, "auto-finalization must still fire exactly once with a calibrated zone");
      assert.equal(state.terminal, true);
      assert.ok(attemptResult, "a terminal attemptResult must be produced");
      assert.equal(attemptResult!.completionState, "completed");
      assert.equal(attemptResult!.testedSide, testedSide);
      assert.equal(attemptResult!.targetReached, true);
      assert.equal(attemptResult!.returnToStartCompleted, true);

      // Zone did not move/follow the wrist after capture: still exactly
      // the captured point after the entire attempt ran.
      assert.deepEqual(state.config.startingZone.point, captured);
    });
  }

  it("a second calibration attempt is refused once captured — the zone must not be recalibratable mid-session", () => {
    const { captured } = calibrateAndBuildConfig("right", { x: 0.55, y: 0.62 });
    assert.ok(captured);
    // Mirrors what the detector itself checks before ever creating a new
    // startCaptureState — see shouldStartForwardReachCalibration.
    assert.equal(shouldStartForwardReachCalibration("running", "idle", "captured"), false);
  });
});

describe("computeForwardReachZoneRadiusPixels — visual zone must match the computed zone exactly", () => {
  it("computes distinct x/y pixel radii for a non-square canvas (640x480) — a single Math.min(width,height) circle does not match the true normalized-space iso-distance contour", () => {
    const { radiusXPixels, radiusYPixels } = computeForwardReachZoneRadiusPixels(0.05, 640, 480);
    assert.equal(radiusXPixels, 32);
    assert.equal(radiusYPixels, 24);
    assert.notEqual(
      radiusXPixels,
      radiusYPixels,
      "a non-square canvas must be drawn as an ellipse, not a uniform-radius circle",
    );
  });

  it("computes equal x/y pixel radii for a square canvas", () => {
    const { radiusXPixels, radiusYPixels } = computeForwardReachZoneRadiusPixels(0.05, 480, 480);
    assert.equal(radiusXPixels, 24);
    assert.equal(radiusYPixels, 24);
  });
});

describe("computeForwardReachStartingZoneGuidance", () => {
  const zone = { point: { x: 0.3, y: 0.5 }, radius: 0.05 };

  it("reports inside when the wrist is at the zone center", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.3, y: 0.5 }, zone);
    assert.equal(result.status, "inside");
  });

  it("reports inside on the exact boundary (inclusive, matching isWristInsideTarget's <=)", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.35, y: 0.5 }, zone); // distance exactly 0.05
    assert.equal(result.status, "inside");
  });

  it("worked mirror example: wrist at raw x=0.9 vs zone at raw x=0.3 is displayed LEFT of the zone on the CSS-mirrored canvas, so guidance must say move right on screen", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.9, y: 0.5 }, zone);
    assert.equal(result.status, "outside");
    if (result.status === "outside") {
      assert.equal(result.horizontal, "move_right_on_screen");
      assert.equal(result.vertical, null);
    }
  });

  it("the mirrored horizontal sense is symmetric: raw wrist x below the zone's raw x must say move left on screen", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.05, y: 0.5 }, zone);
    assert.equal(result.status, "outside");
    if (result.status === "outside") {
      assert.equal(result.horizontal, "move_left_on_screen");
    }
  });

  it("vertical guidance is unaffected by mirroring — wrist below the zone (larger raw y) must say move up", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.3, y: 0.9 }, zone);
    assert.equal(result.status, "outside");
    if (result.status === "outside") {
      assert.equal(result.vertical, "move_up");
      assert.equal(result.horizontal, null);
    }
  });

  it("wrist above the zone (smaller raw y) must say move down", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.3, y: 0.1 }, zone);
    assert.equal(result.status, "outside");
    if (result.status === "outside") {
      assert.equal(result.vertical, "move_down");
    }
  });

  it("reports both a horizontal and vertical hint when offset diagonally", () => {
    const result = computeForwardReachStartingZoneGuidance({ x: 0.05, y: 0.1 }, zone);
    assert.equal(result.status, "outside");
    if (result.status === "outside") {
      assert.equal(result.horizontal, "move_left_on_screen");
      assert.equal(result.vertical, "move_down");
    }
  });
});

describe("automatic attemptWindowEnded dispatch — simulated frame-loop integration", () => {
  /**
   * Drives the real engine through a command sequence exactly as
   * ForwardReachCameraDetector's frame loop would: after every applied
   * command, ask shouldAutoDispatchForwardReachAttemptWindowEnd whether
   * to fire attemptWindowEnded now, and track how many times a dispatch
   * actually happens. No DOM, no MediaPipe — pure engine + the two
   * exported decision/latch functions under test.
   */
  function runWithAutoDispatch(commands: readonly ForwardReachCommand[], state: ForwardReachAttemptState) {
    let dispatchCount = 0;
    let attemptResult: UpperLimbMovementAttemptResult | null = null;
    let dispatched = false;
    let current = state;

    for (const command of commands) {
      const result = applyForwardReachCommand(current, command);
      assert.equal(result.status, "applied", `command ${command.type}@${command.nowMs} should be applied`);
      current = result.state;
      if (result.attemptResult) attemptResult = result.attemptResult;

      if (shouldAutoDispatchForwardReachAttemptWindowEnd(current.phase as ForwardReachPhase, dispatched)) {
        dispatched = true;
        dispatchCount += 1;
        const windowEndResult = applyForwardReachCommand(current, {
          type: "attemptWindowEnded",
          nowMs: command.nowMs,
        });
        assert.equal(windowEndResult.status, "applied", "auto-dispatched attemptWindowEnded should be applied");
        current = windowEndResult.state;
        if (windowEndResult.attemptResult) attemptResult = windowEndResult.attemptResult;
      }
    }

    return { finalState: current, attemptResult, dispatchCount };
  }

  it("a full successful reach+return sequence auto-dispatches exactly once and produces terminal=true with a completed attemptResult", () => {
    const config = buildForwardReachDemoConfig("right");
    const created = createForwardReachAttemptState(config, 0, 0);
    if (!created.ok) throw new Error(`Failed to init state: ${created.reason}`);

    // Same commands as the happy-path demo fixture, minus its trailing
    // manual attemptWindowEnded — this test's whole point is proving the
    // window-end now fires on its own once return-to-start is confirmed.
    const happyPathCommands = buildHappyPathScenario(config).commands;
    const withoutManualWindowEnd = happyPathCommands.filter((c) => c.type !== "attemptWindowEnded");

    const { finalState, attemptResult, dispatchCount } = runWithAutoDispatch(withoutManualWindowEnd, created.state);

    assert.equal(dispatchCount, 1, "attemptWindowEnded must be auto-dispatched exactly once");
    assert.equal(finalState.terminal, true, "engine must reach terminal=true without any manual trigger");
    assert.ok(attemptResult, "a terminal attemptResult must be produced");
    assert.equal(attemptResult!.completionState, "completed");
    assert.equal(attemptResult!.targetReached, true);
    assert.equal(attemptResult!.dwellConfirmed, true);
    assert.equal(attemptResult!.returnToStartCompleted, true);
  });

  it("does not auto-dispatch at all when the attempt never reaches completed_pending_finalization", () => {
    const config = buildForwardReachDemoConfig("right");
    const created = createForwardReachAttemptState(config, 0, 0);
    if (!created.ok) throw new Error(`Failed to init state: ${created.reason}`);

    // Only the readiness + onset-exit prefix of the happy path — the
    // attempt is still mid-flight (outbound), nowhere near return.
    const happyPathCommands = buildHappyPathScenario(config).commands;
    const midFlightPrefix = happyPathCommands.slice(0, 3);

    const { finalState, attemptResult, dispatchCount } = runWithAutoDispatch(midFlightPrefix, created.state);

    assert.equal(dispatchCount, 0, "no dispatch should occur before return-to-start is confirmed");
    assert.equal(finalState.terminal, false);
    assert.equal(attemptResult, null);
  });

  it("a second pass over an already-terminal state does not re-dispatch", () => {
    const config = buildForwardReachDemoConfig("right");
    const created = createForwardReachAttemptState(config, 0, 0);
    if (!created.ok) throw new Error(`Failed to init state: ${created.reason}`);

    const happyPathCommands = buildHappyPathScenario(config).commands;
    const withoutManualWindowEnd = happyPathCommands.filter((c) => c.type !== "attemptWindowEnded");
    const { finalState, dispatchCount } = runWithAutoDispatch(withoutManualWindowEnd, created.state);
    assert.equal(dispatchCount, 1);

    // Simulate one more "frame tick" arriving after termination, exactly
    // as the detector's RAF loop would keep calling in on a live camera.
    const dispatched = true; // this session already dispatched once
    const trailingFrameResult = applyForwardReachCommand(finalState, {
      type: "observationUnavailable",
      nowMs: 900,
    });
    assert.equal(trailingFrameResult.status, "rejected");
    assert.equal(trailingFrameResult.reason, "attempt_already_terminal");
    assert.equal(
      shouldAutoDispatchForwardReachAttemptWindowEnd(trailingFrameResult.state.phase as ForwardReachPhase, dispatched),
      false,
      "already-dispatched guard must prevent a second attempt even though phase still reads completed_pending_finalization",
    );
  });
});
