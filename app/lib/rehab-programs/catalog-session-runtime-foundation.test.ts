/**
 * Run: npx tsx --test app/lib/rehab-programs/catalog-session-runtime-foundation.test.ts
 *
 * Proves the catalog block-runner foundation accepts the seeded Stroke ULRF
 * Session 1 definition and that all three runner types resolve after
 * registerAllBlockRunners() — without wiring the patient portal.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerAllBlockRunners } from "@/app/lib/interactive-shoulder/block-engine/register-all-block-runners";
import { resolveInstructionalBlockRunner } from "@/app/lib/interactive-shoulder/block-engine/instructional-block-runner";
import { resolvePatternBlockRunner } from "@/app/lib/interactive-shoulder/block-engine/pattern-block-runner";
import { resolveTargetBlockRunner } from "@/app/lib/interactive-shoulder/block-engine/target-block-runner";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import { toSessionDefinition } from "./rehab-program-runtime-adapter";
import { STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1 } from "./stroke-upper-limb-recovery-foundation";

const [WARM_UP, REACH_THE_LIGHT, D1_DIAGONAL_REACH, COOL_DOWN] =
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.blocks;

describe("catalog session runtime foundation", () => {
  it("Stroke ULRF Session 1 converts through toSessionDefinition with four ordered block types", () => {
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    assert.equal(definition.blocks.length, 4);
    assert.deepEqual(
      definition.blocks.map((b) => b.blockId),
      [WARM_UP.blockId, REACH_THE_LIGHT.blockId, D1_DIAGONAL_REACH.blockId, COOL_DOWN.blockId],
    );
    assert.deepEqual(
      definition.blocks.map((b) => b.blockType),
      ["instructional", "movement-target", "movement-pattern", "instructional"],
    );
  });

  it("orchestrator duration simulation completes all four blocks after calibration", () => {
    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    const orchestrator = new SessionOrchestrator(definition);

    let nowMs = 1_000_000;
    orchestrator.start(nowMs);
    assert.equal(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1.lifecycle.requiresCalibration, true);
    orchestrator.beginCalibration(nowMs);
    orchestrator.completeCalibration(nowMs);

    let snap = orchestrator.getSnapshot(nowMs);
    assert.equal(snap.sessionState, "active");
    assert.equal(snap.currentBlock?.blockId, WARM_UP.blockId);

    for (const block of definition.blocks) {
      nowMs += (block.targetDurationSeconds ?? 0) * 1_000;
      orchestrator.tick(nowMs);
    }

    snap = orchestrator.getSnapshot(nowMs);
    assert.equal(snap.sessionState, "completed");

    const summary = orchestrator.getSessionPerformanceSummary(nowMs);
    assert.equal(summary.blocksCompleted, 4);
    assert.deepEqual(
      summary.blockResults.map((r) => r.blockId),
      [WARM_UP.blockId, REACH_THE_LIGHT.blockId, D1_DIAGONAL_REACH.blockId, COOL_DOWN.blockId],
    );
  });

  it("registerAllBlockRunners makes all three block types resolvable for catalog blocks", () => {
    registerAllBlockRunners();
    assert.ok(resolveInstructionalBlockRunner("instructional"));
    assert.ok(resolveTargetBlockRunner("movement-target"));
    assert.ok(resolvePatternBlockRunner("movement-pattern"));

    const definition = toSessionDefinition(STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1);
    for (const block of definition.blocks) {
      const blockType = block.blockType!;
      if (blockType === "instructional") {
        assert.ok(resolveInstructionalBlockRunner(blockType));
      } else if (blockType === "movement-target") {
        assert.ok(resolveTargetBlockRunner(blockType));
      } else if (blockType === "movement-pattern") {
        assert.ok(resolvePatternBlockRunner(blockType));
      }
    }
  });
});
