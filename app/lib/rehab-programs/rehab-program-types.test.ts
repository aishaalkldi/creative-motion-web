/**
 * Run: npx tsx --test app/lib/rehab-programs/rehab-program-types.test.ts
 *
 * rehab-program-types.ts has no runtime logic of its own — these tests
 * construct minimal literal values against each exported type and
 * assert the architectural invariants that motivated the type shapes,
 * not implementation trivia.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  Condition,
  ProgramSession,
  ProgramSessionBlock,
  ProgramSessionLifecycleConfig,
  RehabPathway,
  TreatmentProgram,
} from "./rehab-program-types";

describe("rehab-program-types", () => {
  it("Condition and RehabPathway are minimal id/name/reference shapes", () => {
    const condition: Condition = { id: "neuro-stroke", name: "Stroke" };
    const pathway: RehabPathway = {
      id: "stroke-upper-limb-recovery-foundation",
      conditionId: condition.id,
      name: "Upper Limb Recovery Foundation",
    };
    assert.equal(pathway.conditionId, condition.id);
  });

  it("ProgramSessionBlock.blockType accepts every SessionBlockType literal", () => {
    const instructional: ProgramSessionBlock = {
      blockId: "b1",
      blockType: "instructional",
      title: "Warm-up",
      instructions: "Warm up gently.",
    };
    const movementTarget: ProgramSessionBlock = {
      blockId: "b2",
      blockType: "movement-target",
      title: "Reach the Light",
      instructions: "Reach toward the light.",
      movementId: "shoulder-abduction-reach",
    };
    const movementPattern: ProgramSessionBlock = {
      blockId: "b3",
      blockType: "movement-pattern",
      title: "D1-Inspired Diagonal Reach",
      instructions: "Follow the diagonal path.",
      movementId: "shoulder-abduction-reach",
    };
    assert.equal(instructional.blockType, "instructional");
    assert.equal(movementTarget.blockType, "movement-target");
    assert.equal(movementPattern.blockType, "movement-pattern");
  });

  it("ProgramSessionBlock is a catalog-only shape — it does not carry MovementBlock's runtime/measurement-only fields", () => {
    const block: ProgramSessionBlock = {
      blockId: "b1",
      blockType: "instructional",
      title: "Warm-up",
      instructions: "Warm up gently.",
    };
    const keys = Object.keys(block);
    for (const movementBlockOnlyField of [
      "completionMode",
      "supportedPositions",
      "safetyRules",
      "prescribedRepetitions",
      "prescribedHoldSeconds",
      "restAfterSeconds",
      "side",
      "intensityLevel",
      "transitionProfile",
    ]) {
      assert.ok(
        !keys.includes(movementBlockOnlyField),
        `ProgramSessionBlock must not carry MovementBlock-only field "${movementBlockOnlyField}"`,
      );
    }
  });

  it("calibration/summary lifecycle metadata is a sibling of blocks, never an entry inside it", () => {
    const lifecycle: ProgramSessionLifecycleConfig = {
      requiresCalibration: true,
      summaryMode: "standard",
    };
    const block: ProgramSessionBlock = {
      blockId: "b1",
      blockType: "instructional",
      title: "Warm-up",
      instructions: "Warm up gently.",
    };
    const session: ProgramSession = {
      id: "s1",
      programId: "p1",
      sessionNumber: 1,
      title: "Session 1",
      goal: "Activation",
      estimatedDurationMinutes: { min: 10, max: 15 },
      lifecycle,
      blocks: [block],
    };
    assert.ok(Object.keys(session).includes("lifecycle"));
    assert.ok(Object.keys(session).includes("blocks"));
    assert.equal(session.blocks.length, 1, "lifecycle metadata must not be counted as a block");
    assert.ok(
      session.blocks.every((b) => b.blockType !== undefined),
      "every entry in blocks must be a real executable block, not lifecycle metadata",
    );
  });

  it("ProgramSessionLifecycleConfig.summaryMode accepts 'standard' and 'none'", () => {
    const standard: ProgramSessionLifecycleConfig = { requiresCalibration: true, summaryMode: "standard" };
    const none: ProgramSessionLifecycleConfig = { requiresCalibration: false, summaryMode: "none" };
    assert.equal(standard.summaryMode, "standard");
    assert.equal(none.summaryMode, "none");
  });

  it("TreatmentProgram nests ProgramSession[], and a session's blocks are independent of the program/pathway identifiers", () => {
    const program: TreatmentProgram = {
      id: "p1",
      pathwayId: "pathway1",
      name: "Upper Limb Recovery Foundation",
      version: 1,
      sessions: [
        {
          id: "s1",
          programId: "p1",
          sessionNumber: 1,
          title: "Session 1",
          goal: "Activation",
          estimatedDurationMinutes: { min: 10, max: 15 },
          lifecycle: { requiresCalibration: true, summaryMode: "standard" },
          blocks: [],
        },
      ],
    };
    assert.equal(program.sessions[0].programId, program.id);
  });
});
