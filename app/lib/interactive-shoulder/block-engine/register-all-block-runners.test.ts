/**
 * Run: npx tsx --test app/lib/interactive-shoulder/block-engine/register-all-block-runners.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBlockRunnerForBlockType } from "./block-runner-registry";
import { INSTRUCTIONAL_BLOCK_RUNNER } from "./instructional-block-runner";
import { PATTERN_BLOCK_RUNNER } from "./pattern-block-runner";
import { registerAllBlockRunners } from "./register-all-block-runners";
import { TARGET_BLOCK_RUNNER } from "./target-block-runner";

describe("register-all-block-runners", () => {
  it("registers instructional, movement-target, and movement-pattern runners", () => {
    registerAllBlockRunners();
    assert.equal(getBlockRunnerForBlockType("instructional"), INSTRUCTIONAL_BLOCK_RUNNER);
    assert.equal(getBlockRunnerForBlockType("movement-target"), TARGET_BLOCK_RUNNER);
    assert.equal(getBlockRunnerForBlockType("movement-pattern"), PATTERN_BLOCK_RUNNER);
  });

  it("repeated registration is idempotent — a second call does not throw", () => {
    assert.doesNotThrow(() => registerAllBlockRunners());
    assert.equal(getBlockRunnerForBlockType("instructional"), INSTRUCTIONAL_BLOCK_RUNNER);
    assert.equal(getBlockRunnerForBlockType("movement-target"), TARGET_BLOCK_RUNNER);
    assert.equal(getBlockRunnerForBlockType("movement-pattern"), PATTERN_BLOCK_RUNNER);
  });
});
