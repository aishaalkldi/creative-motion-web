/**
 * Run: npx tsx --test app/lib/rehab-programs/rehab-program-runtime-adapter.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import { STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1 } from "./stroke-upper-limb-recovery-foundation";
import type { ProgramSessionBlock } from "./rehab-program-types";
import { toMovementBlock, toSessionDefinition } from "./rehab-program-runtime-adapter";

const [WARM_UP, REACH_THE_LIGHT, D1_DIAGONAL_REACH, COOL_DOWN] =
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks;

describe("toMovementBlock — field mapping for the four real catalog blocks", () => {
  it("1/2. Warm-up: direct fields unchanged, movementId is a non-clinical operational label", () => {
    const mapped = toMovementBlock(WARM_UP);
    assert.equal(mapped.blockId, WARM_UP.blockId);
    assert.equal(mapped.blockType, "instructional");
    assert.equal(mapped.title, WARM_UP.title);
    assert.equal(mapped.instructions, WARM_UP.instructions);
    assert.equal(mapped.targetDurationSeconds, WARM_UP.targetDurationSeconds);
    assert.equal(mapped.feedbackProfile, undefined);
  });

  it("1/2. Reach the Light: direct fields unchanged", () => {
    const mapped = toMovementBlock(REACH_THE_LIGHT);
    assert.equal(mapped.blockId, REACH_THE_LIGHT.blockId);
    assert.equal(mapped.blockType, "movement-target");
    assert.equal(mapped.title, REACH_THE_LIGHT.title);
    assert.equal(mapped.instructions, REACH_THE_LIGHT.instructions);
    assert.equal(mapped.targetDurationSeconds, REACH_THE_LIGHT.targetDurationSeconds);
  });

  it("1/2. D1-Inspired Diagonal Reach: direct fields unchanged", () => {
    const mapped = toMovementBlock(D1_DIAGONAL_REACH);
    assert.equal(mapped.blockId, D1_DIAGONAL_REACH.blockId);
    assert.equal(mapped.blockType, "movement-pattern");
    assert.equal(mapped.title, D1_DIAGONAL_REACH.title);
    assert.equal(mapped.instructions, D1_DIAGONAL_REACH.instructions);
    assert.equal(mapped.targetDurationSeconds, D1_DIAGONAL_REACH.targetDurationSeconds);
  });

  it("1/2. Cool-down: direct fields unchanged, movementId is a non-clinical operational label", () => {
    const mapped = toMovementBlock(COOL_DOWN);
    assert.equal(mapped.blockId, COOL_DOWN.blockId);
    assert.equal(mapped.blockType, "instructional");
    assert.equal(mapped.title, COOL_DOWN.title);
    assert.equal(mapped.instructions, COOL_DOWN.instructions);
    assert.equal(mapped.targetDurationSeconds, COOL_DOWN.targetDurationSeconds);
    assert.equal(mapped.feedbackProfile, undefined);
  });

  it("3. completionMode is derived as \"duration\" for all four blocks", () => {
    for (const block of [WARM_UP, REACH_THE_LIGHT, D1_DIAGONAL_REACH, COOL_DOWN]) {
      assert.equal(toMovementBlock(block).completionMode, "duration");
    }
  });

  it("4. missing targetDurationSeconds throws — never silently defaults to another completionMode", () => {
    const invalid: ProgramSessionBlock = {
      blockId: "stroke-ulrf-v1-session-1-warm-up",
      blockType: "instructional",
      title: "Warm-up",
      instructions: "Warm up gently.",
    };
    assert.throws(() => toMovementBlock(invalid), /targetDurationSeconds/);
  });

  it("5. zero, negative, NaN, and Infinity durations all throw", () => {
    for (const invalidDuration of [0, -10, Number.NaN, Infinity, -Infinity]) {
      const invalid: ProgramSessionBlock = {
        blockId: "stroke-ulrf-v1-session-1-warm-up",
        blockType: "instructional",
        title: "Warm-up",
        instructions: "Warm up gently.",
        targetDurationSeconds: invalidDuration,
      };
      assert.throws(
        () => toMovementBlock(invalid),
        /targetDurationSeconds/,
        `duration ${invalidDuration} must throw`,
      );
    }
  });

  it("6. an unknown blockId cannot receive a silent supportedPositions default", () => {
    const unknown: ProgramSessionBlock = {
      blockId: "some-future-program-block",
      blockType: "instructional",
      title: "Future block",
      instructions: "Not part of this program.",
      targetDurationSeconds: 30,
    };
    assert.throws(() => toMovementBlock(unknown), /supportedPositions/);
  });

  it("7. instructional movementId is a clearly non-clinical operational identifier, distinct per block", () => {
    const warmUpMapped = toMovementBlock(WARM_UP);
    const coolDownMapped = toMovementBlock(COOL_DOWN);
    assert.equal(warmUpMapped.movementId, `instructional:${WARM_UP.blockId}`);
    assert.equal(coolDownMapped.movementId, `instructional:${COOL_DOWN.blockId}`);
    assert.ok(warmUpMapped.movementId.startsWith("instructional:"));
    assert.ok(coolDownMapped.movementId.startsWith("instructional:"));
    assert.notEqual(warmUpMapped.movementId, coolDownMapped.movementId);
    // Must never collide with, or be mistakeable for, a real exercise-library movementId.
    assert.notEqual(warmUpMapped.movementId, "shoulder-abduction-reach");
    assert.notEqual(coolDownMapped.movementId, "shoulder-abduction-reach");
  });

  it("a non-instructional block with no movementId throws rather than inventing one", () => {
    const invalid: ProgramSessionBlock = {
      blockId: "stroke-ulrf-v1-session-1-reach-the-light",
      blockType: "movement-target",
      title: "Reach the Light",
      instructions: "Reach toward the light.",
      targetDurationSeconds: 240,
      // movementId intentionally omitted
    };
    assert.throws(() => toMovementBlock(invalid), /movementId/);
  });

  it("8. Reach the Light and D1 retain their correct real movementId and feedbackProfile", () => {
    const reachMapped = toMovementBlock(REACH_THE_LIGHT);
    const d1Mapped = toMovementBlock(D1_DIAGONAL_REACH);
    assert.equal(reachMapped.movementId, "shoulder-abduction-reach");
    assert.equal(reachMapped.feedbackProfile, REACH_THE_LIGHT.feedbackProfile);
    assert.equal(d1Mapped.movementId, "shoulder-abduction-reach");
    assert.equal(d1Mapped.feedbackProfile, D1_DIAGONAL_REACH.feedbackProfile);
  });

  it("supportedPositions for all four blocks matches the documented Session-1-specific mapping", () => {
    for (const block of [WARM_UP, REACH_THE_LIGHT, D1_DIAGONAL_REACH, COOL_DOWN]) {
      assert.deepEqual(toMovementBlock(block).supportedPositions, ["seated", "standing"]);
    }
  });

  it("does not add invented safetyRules, prescriptions, side, or intensity", () => {
    for (const block of [WARM_UP, REACH_THE_LIGHT, D1_DIAGONAL_REACH, COOL_DOWN]) {
      const mapped = toMovementBlock(block);
      assert.equal(mapped.safetyRules, undefined);
      assert.equal(mapped.prescribedRepetitions, undefined);
      assert.equal(mapped.prescribedHoldSeconds, undefined);
      assert.equal(mapped.side, undefined);
      assert.equal(mapped.intensityLevel, undefined);
      assert.equal(mapped.restAfterSeconds, undefined);
    }
  });
});

describe("toSessionDefinition", () => {
  it("9. preserves session ID, title, block order, and count", () => {
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    assert.equal(definition.sessionId, STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.id);
    assert.equal(definition.title, STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.title);
    assert.equal(definition.blocks.length, 4);
    assert.deepEqual(
      definition.blocks.map((b) => b.blockId),
      [WARM_UP.blockId, REACH_THE_LIGHT.blockId, D1_DIAGONAL_REACH.blockId, COOL_DOWN.blockId],
    );
  });

  it("11. calibration and summary are not present as blocks in the converted SessionDefinition", () => {
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    for (const block of definition.blocks) {
      assert.ok(!block.blockId.toLowerCase().includes("calibrat"));
      assert.ok(!block.blockId.toLowerCase().includes("summary"));
    }
  });
});

describe("end-to-end proof: real catalog session runs to completion through the real, unmodified SessionOrchestrator", () => {
  it("12/13/14/15. start -> calibration -> four duration ticks -> completed, with 4 ordered results and a working summary — no SessionInputEvents, no BlockRunner registry, no PR #163 API involved", () => {
    // Uses the real catalog session — not a re-created fixture.
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    const orchestrator = new SessionOrchestrator(definition);

    let nowMs = 1_000_000;
    orchestrator.start(nowMs);
    assert.equal(orchestrator.getSnapshot(nowMs).sessionState, "preparing");

    // 10. session.lifecycle.requiresCalibration explicitly drives whether the
    // calibration lifecycle is invoked — this is caller-level guidance read
    // directly off ProgramSession, not a SessionDefinition/Orchestrator field.
    assert.equal(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.lifecycle.requiresCalibration, true);
    if (STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.lifecycle.requiresCalibration) {
      orchestrator.beginCalibration(nowMs);
      assert.equal(orchestrator.getSnapshot(nowMs).sessionState, "calibrating");
      orchestrator.completeCalibration(nowMs);
    }

    // First block (Warm-up) begins immediately after calibration completes.
    let snap = orchestrator.getSnapshot(nowMs);
    assert.equal(snap.sessionState, "active");
    assert.equal(snap.currentBlock?.blockId, WARM_UP.blockId);

    // Duration-only ticks — no SessionInputEvent, no BlockRunner, no
    // registry, and therefore nothing from PR #163 is required anywhere
    // in this proof: every block in this catalog is completionMode "duration".
    for (const block of definition.blocks) {
      nowMs += (block.targetDurationSeconds ?? 0) * 1_000;
      orchestrator.tick(nowMs);
    }

    snap = orchestrator.getSnapshot(nowMs);
    assert.equal(snap.sessionState, "completed", "12. orchestrator must reach completed");

    const summary = orchestrator.getSessionPerformanceSummary(nowMs);
    assert.equal(summary.blocksTotal, 4);
    assert.equal(summary.blocksCompleted, 4, "13. exactly four ordered block results");
    assert.deepEqual(
      summary.blockResults.map((r) => r.blockId),
      [WARM_UP.blockId, REACH_THE_LIGHT.blockId, D1_DIAGONAL_REACH.blockId, COOL_DOWN.blockId],
    );
    for (const result of summary.blockResults) {
      assert.equal(result.completionReason, "duration");
      assert.ok(result.completedAtMs !== null);
    }
    assert.equal(summary.sessionState, "completed", "14. getSessionPerformanceSummary succeeds after completion");
  });
});
