/**
 * Run: npx tsx --test app/lib/rehab-programs/stroke-upper-limb-recovery-foundation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBlockRunnerForBlockType } from "@/app/lib/interactive-shoulder/block-engine/block-runner-registry";
import { registerInstructionalBlockRunner } from "@/app/lib/interactive-shoulder/block-engine/instructional-block-runner";
import { registerTargetBlockRunner } from "@/app/lib/interactive-shoulder/block-engine/target-block-runner";
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import type { BlockLateralityPolicy } from "@/app/lib/therapy/treatment-laterality";
import {
  NEURO_STROKE_CONDITION,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1,
} from "./stroke-upper-limb-recovery-foundation";

const VALID_SESSION_BLOCK_TYPES: readonly SessionBlockType[] = [
  "movement-target",
  "movement-pattern",
  "instructional",
];

const EXPECTED_LATERALITY_POLICY_BY_BLOCK_ID: Readonly<
  Record<string, BlockLateralityPolicy>
> = Object.freeze({
  "stroke-ulrf-v1-session-1-warm-up": "not_applicable",
  "stroke-ulrf-v1-session-1-reach-the-light": "use_prescription",
  "stroke-ulrf-v1-session-1-d1-diagonal-reach": "use_prescription",
  "stroke-ulrf-v1-session-1-cool-down": "not_applicable",
});

describe("stroke-upper-limb-recovery-foundation catalog", () => {
  it("the program has exactly one valid Session 1", () => {
    assert.equal(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1.sessions.length, 1);
    const session = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1.sessions[0];
    assert.equal(session, STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    assert.equal(session.sessionNumber, 1);
    assert.equal(session.programId, STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1.id);
  });

  it("calibration and summary are represented as lifecycle metadata, not executable blocks", () => {
    const { lifecycle } = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1;
    assert.equal(lifecycle.requiresCalibration, true);
    assert.equal(lifecycle.summaryMode, "standard");
    // lifecycle lives on the session object, structurally separate from `blocks`.
    assert.ok(!Array.isArray((lifecycle as unknown as { blocks?: unknown }).blocks));
  });

  it("the executable block array contains exactly: instructional Warm-up, movement-target Reach the Light, movement-pattern D1, instructional Cool-down, in that order", () => {
    const { blocks } = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1;
    assert.equal(blocks.length, 4);
    assert.deepEqual(
      blocks.map((b) => [b.blockType, b.title]),
      [
        ["instructional", "Warm-up"],
        ["movement-target", "Reach the Light"],
        ["movement-pattern", "D1-Inspired Diagonal Reach"],
        ["instructional", "Cool-down"],
      ],
    );
  });

  it("every executable blockType is a valid SessionBlockType", () => {
    for (const block of STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks) {
      assert.ok(
        VALID_SESSION_BLOCK_TYPES.includes(block.blockType),
        `"${block.blockType}" on block "${block.blockId}" is not a valid SessionBlockType`,
      );
    }
  });

  it("no calibration or summary marker appears in the block array", () => {
    for (const block of STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks) {
      const lowerId = block.blockId.toLowerCase();
      const lowerTitle = block.title.toLowerCase();
      assert.ok(!lowerId.includes("calibrat"), `blockId "${block.blockId}" looks like a calibration marker`);
      assert.ok(!lowerId.includes("summary"), `blockId "${block.blockId}" looks like a summary marker`);
      assert.ok(!lowerTitle.includes("calibrat"), `title "${block.title}" looks like a calibration marker`);
      assert.ok(!lowerTitle.includes("summary"), `title "${block.title}" looks like a summary marker`);
    }
  });

  it("instructional and movement-target blocks resolve through their public registration paths", () => {
    registerInstructionalBlockRunner();
    registerTargetBlockRunner();

    const warmUp = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks.find(
      (b) => b.blockType === "instructional",
    );
    const reachTheLight = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks.find(
      (b) => b.blockType === "movement-target",
    );
    assert.ok(warmUp);
    assert.ok(reachTheLight);
    assert.ok(getBlockRunnerForBlockType(warmUp!.blockType), "instructional must resolve via the registry");
    assert.ok(getBlockRunnerForBlockType(reachTheLight!.blockType), "movement-target must resolve via the registry");
  });

  it("movement-pattern (D1) is validated structurally — blockType, identity, and content fields; registerPatternBlockRunner() is covered by the catalog block-runner foundation tests, not production wiring here", () => {
    const d1 = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks.find(
      (b) => b.blockType === "movement-pattern",
    );
    assert.ok(d1);
    assert.equal(d1!.blockType, "movement-pattern");
    assert.equal(typeof d1!.blockId, "string");
    assert.ok(d1!.blockId.length > 0);
    assert.equal(typeof d1!.title, "string");
    assert.ok(d1!.title.length > 0);
    assert.equal(typeof d1!.instructions, "string");
    assert.ok(d1!.instructions.length > 0);
    assert.equal(typeof d1!.movementId, "string");
    assert.equal(typeof d1!.feedbackProfile, "string");
  });

  it("every block has an explicit lateralityPolicy — instructional warm-up/cool-down are not_applicable; both movement blocks use_prescription", () => {
    const { blocks } = STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1;

    assert.deepEqual(
      Object.fromEntries(blocks.map((block) => [block.blockId, block.lateralityPolicy])),
      EXPECTED_LATERALITY_POLICY_BY_BLOCK_ID,
    );

    for (const block of blocks) {
      assert.notEqual(
        block.lateralityPolicy,
        null,
        `block "${block.blockId}" must not have null lateralityPolicy`,
      );
      assert.notEqual(
        block.lateralityPolicy,
        undefined,
        `block "${block.blockId}" must not have undefined lateralityPolicy`,
      );
    }

    const warmUp = blocks.find((b) => b.blockId === "stroke-ulrf-v1-session-1-warm-up");
    const coolDown = blocks.find((b) => b.blockId === "stroke-ulrf-v1-session-1-cool-down");
    const reachTheLight = blocks.find(
      (b) => b.blockId === "stroke-ulrf-v1-session-1-reach-the-light",
    );
    const d1 = blocks.find((b) => b.blockId === "stroke-ulrf-v1-session-1-d1-diagonal-reach");

    assert.ok(warmUp);
    assert.ok(coolDown);
    assert.ok(reachTheLight);
    assert.ok(d1);
    assert.equal(warmUp!.lateralityPolicy, "not_applicable");
    assert.equal(coolDown!.lateralityPolicy, "not_applicable");
    assert.equal(reachTheLight!.lateralityPolicy, "use_prescription");
    assert.equal(d1!.lateralityPolicy, "use_prescription");
  });

  it("catalog objects cannot be accidentally mutated — every level is frozen", () => {
    assert.ok(Object.isFrozen(NEURO_STROKE_CONDITION));
    assert.ok(Object.isFrozen(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY));
    assert.ok(Object.isFrozen(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1));
    assert.ok(Object.isFrozen(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1.sessions));
    assert.ok(Object.isFrozen(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1));
    assert.ok(Object.isFrozen(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.lifecycle));
    assert.ok(Object.isFrozen(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks));
    for (const block of STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks) {
      assert.ok(Object.isFrozen(block), `block "${block.blockId}" must be frozen`);
    }

    assert.throws(() => {
      (NEURO_STROKE_CONDITION as { name: string }).name = "mutated";
    }, TypeError);
    assert.throws(() => {
      (STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks as unknown as unknown[]).push({});
    }, TypeError);
    assert.throws(() => {
      (STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks[0] as { title: string }).title = "mutated";
    }, TypeError);
  });
});
