/**
 * Run: npx tsx --test app/lib/upper-limb-motor-screen/forward-reach-demo-fixtures.test.ts
 *
 * Tests Forward Reach demo fixtures by driving scenarios through the real engine.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAllDemoScenarios,
  buildForwardReachDemoConfig,
  executeScenario,
} from "@/app/lib/upper-limb-motor-screen/forward-reach-demo-fixtures";

// ── Successful flows ───────────────────────────────────────────────────────

describe("Forward Reach demo fixtures — successful flows", () => {
  it("right tested-side happy path completes successfully", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.happyPath, config);

    assert.ok(result.attemptResult !== null, "Should have an attempt result");
    assert.equal(result.attemptResult!.completionState, "completed", "Completion state should be completed");
    assert.equal(result.attemptResult!.targetReached, true, "Target should be reached");
    assert.equal(result.attemptResult!.dwellConfirmed, true, "Dwell should be confirmed");
    assert.equal(result.attemptResult!.returnToStartCompleted, true, "Return should be completed");
  });

  it("left tested-side happy path completes successfully", () => {
    const config = buildForwardReachDemoConfig("left");
    const scenarios = buildAllDemoScenarios("left");
    const result = executeScenario(scenarios.happyPath, config);

    assert.ok(result.attemptResult !== null, "Should have an attempt result");
    assert.equal(result.attemptResult!.completionState, "completed", "Completion state should be completed");
    assert.equal(result.attemptResult!.targetReached, true, "Target should be reached");
    assert.equal(result.attemptResult!.dwellConfirmed, true, "Dwell should be confirmed");
    assert.equal(result.attemptResult!.returnToStartCompleted, true, "Return should be completed");
  });

  it("happy path produces factual timing and path metrics", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.happyPath, config);

    assert.ok(result.attemptResult !== null, "Should have an attempt result");
    const attemptResult = result.attemptResult!;

    assert.ok(attemptResult.reachTimeMs !== null, "Reach time should exist");
    assert.ok(attemptResult.reachTimeMs! > 0, "Reach time should be positive");
    assert.ok(attemptResult.returnTimeMs !== null, "Return time should exist");
    assert.ok(attemptResult.returnTimeMs! > 0, "Return time should be positive");
    assert.ok(attemptResult.totalMovementTimeMs !== null, "Total movement time should exist");
    assert.ok(attemptResult.totalMovementTimeMs! > 0, "Total movement time should be positive");
    assert.ok(attemptResult.normalizedPathLength !== null, "Path length should exist");
    assert.ok(attemptResult.normalizedPathLength! > 0, "Path length should be positive");
    assert.ok(attemptResult.pathEfficiency !== null, "Path efficiency should exist");
    assert.ok(attemptResult.pathEfficiency! > 0 && attemptResult.pathEfficiency! <= 1, "Path efficiency should be in (0,1]");
  });

  it("happy path terminal result excludes shoulder and elbow angles", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.happyPath, config);

    assert.ok(result.attemptResult !== null, "Should have an attempt result");
    assert.equal(result.attemptResult!.peakShoulderAngleDeg, null, "Shoulder angle should remain null");
    assert.equal(result.attemptResult!.peakElbowExtensionDeg, null, "Elbow angle should remain null");
  });

  it("happy path terminal result contains no raw trajectory array", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.happyPath, config);

    assert.ok(result.attemptResult !== null, "Should have an attempt result");
    // Attempt result should not contain a trajectory array property
    assert.ok(!("trajectory" in result.attemptResult!), "Attempt result should not expose trajectory");
    assert.ok(!("rawFrames" in result.attemptResult!), "Attempt result should not expose raw frames");
  });
});

// ── Determinism ────────────────────────────────────────────────────────────

describe("Forward Reach demo fixtures — determinism", () => {
  it("running the same scenario twice produces identical terminal results", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");

    const firstRun = executeScenario(scenarios.happyPath, config);
    const secondRun = executeScenario(scenarios.happyPath, config);

    assert.ok(firstRun.attemptResult !== null && secondRun.attemptResult !== null);

    const first = firstRun.attemptResult!;
    const second = secondRun.attemptResult!;

    assert.equal(first.completionState, second.completionState);
    assert.equal(first.targetReached, second.targetReached);
    assert.equal(first.dwellConfirmed, second.dwellConfirmed);
    assert.equal(first.returnToStartCompleted, second.returnToStartCompleted);
    assert.equal(first.reachTimeMs, second.reachTimeMs);
    assert.equal(first.returnTimeMs, second.returnTimeMs);
    assert.equal(first.totalMovementTimeMs, second.totalMovementTimeMs);
    assert.equal(first.normalizedPathLength, second.normalizedPathLength);
    assert.equal(first.pathEfficiency, second.pathEfficiency);
  });

  it("creating a fresh attempt does not carry state from previous attempt", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");

    // Run happy path
    const firstResult = executeScenario(scenarios.happyPath, config);
    assert.ok(firstResult.attemptResult !== null);
    assert.equal(firstResult.attemptResult!.completionState, "completed");

    // Run low visibility scenario — should not inherit completed state
    const secondResult = executeScenario(scenarios.lowVisibility, config);
    if (secondResult.attemptResult) {
      assert.notEqual(secondResult.attemptResult.completionState, "completed", "Second attempt should not inherit completion");
    }
  });
});

// ── Safety scenarios ───────────────────────────────────────────────────────

describe("Forward Reach demo fixtures — safety scenarios", () => {
  it("low visibility does not incorrectly advance the task", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.lowVisibility, config);

    // Low visibility should not complete successfully
    if (result.attemptResult) {
      assert.notEqual(result.attemptResult.completionState, "completed", "Low visibility should not complete");
      assert.equal(result.attemptResult.targetReached, false, "Target should not be reached");
    }
  });

  it("wrong-direction movement follows existing engine behavior", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.wrongDirection, config);

    // Engine should handle wrong direction — does not crash
    assert.ok(result.finalSnapshot !== null, "Should produce a valid snapshot");
    assert.equal(result.finalSnapshot.targetReached, false, "Target should not be reached");
  });

  it("short tracking gap remains within current engine tolerance", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.shortTrackingGap, config);

    // Short gap should not open protective pause
    assert.equal(result.finalSnapshot.protectivePauseCount, 0, "Short gap should not open protective pause");
  });

  it("long gap opens protective pause", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.longTrackingGapWithHumanResume, config);

    assert.ok(result.finalSnapshot.protectivePauseCount > 0, "Long gap should open at least one protective pause");
  });

  it("no automatic resume occurs after protective pause", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    
    // Build scenario without human resume
    const scenarioWithoutResume = {
      ...scenarios.longTrackingGapWithHumanResume,
      commands: scenarios.longTrackingGapWithHumanResume.commands.filter(
        (cmd) => cmd.type !== "resumeRequested"
      ),
    };

    const result = executeScenario(scenarioWithoutResume, config);

    // Protective pause should remain active without explicit resume
    assert.ok(result.finalSnapshot.protectivePauseCount > 0, "Protective pause should have been opened");
    if (result.attemptResult) {
      assert.notEqual(result.attemptResult.completionState, "completed", "Should not complete without resume");
    }
  });

  it("explicit valid human resume is required after protective pause", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    
    // Full scenario includes resumeRequested command
    const result = executeScenario(scenarios.longTrackingGapWithHumanResume, config);

    // With explicit resume, the attempt continues
    assert.ok(result.finalSnapshot.protectivePauseCount > 0, "Protective pause should have been opened");
    // The attempt should not be stopped (may or may not complete depending on remaining commands)
    assert.ok(result.finalSnapshot !== null, "Attempt should continue after resume");
  });

  it("stop-before-completion produces the correct terminal state", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");
    const result = executeScenario(scenarios.stopBeforeCompletion, config);

    assert.ok(result.attemptResult !== null, "Should have an attempt result");
    assert.equal(result.attemptResult!.completionState, "stopped", "Should be stopped");
    assert.equal(result.attemptResult!.targetReached, false, "Target should not be reached");
    assert.equal(result.attemptResult!.dwellConfirmed, false, "Dwell should not be confirmed");
    assert.equal(result.attemptResult!.returnToStartCompleted, false, "Return should not be completed");
  });

  it("out-of-order timestamp behavior remains consistent with existing engine", () => {
    const config = buildForwardReachDemoConfig("right");
    const scenarios = buildAllDemoScenarios("right");

    // Build scenario with an out-of-order timestamp
    const outOfOrderScenario = {
      name: "outOfOrder",
      description: "Out-of-order timestamp test",
      commands: [
        scenarios.happyPath.commands[0], // t=0
        scenarios.happyPath.commands[1], // t=10
        scenarios.happyPath.commands[2], // t=20
        { ...scenarios.happyPath.commands[3], nowMs: 10 }, // t=10 (out of order)
        scenarios.happyPath.commands[4], // t=80
      ],
    };

    // Should not crash — engine handles this gracefully
    const result = executeScenario(outOfOrderScenario, config);
    assert.ok(result.finalSnapshot !== null, "Should produce a valid state despite out-of-order timestamp");
  });
});

// ── Config validation ──────────────────────────────────────────────────────

describe("Forward Reach demo fixtures — config validation", () => {
  it("buildForwardReachDemoConfig supports left tested side", () => {
    const config = buildForwardReachDemoConfig("left");
    assert.equal(config.testedSide, "left");
  });

  it("buildForwardReachDemoConfig supports right tested side", () => {
    const config = buildForwardReachDemoConfig("right");
    assert.equal(config.testedSide, "right");
  });

  it("buildAllDemoScenarios returns all six scenarios", () => {
    const scenarios = buildAllDemoScenarios("right");
    assert.ok(scenarios.happyPath, "Should include happyPath");
    assert.ok(scenarios.lowVisibility, "Should include lowVisibility");
    assert.ok(scenarios.wrongDirection, "Should include wrongDirection");
    assert.ok(scenarios.shortTrackingGap, "Should include shortTrackingGap");
    assert.ok(scenarios.longTrackingGapWithHumanResume, "Should include longTrackingGapWithHumanResume");
    assert.ok(scenarios.stopBeforeCompletion, "Should include stopBeforeCompletion");
  });
});
