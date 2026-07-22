/**
 * Run: npx tsx --test app/lib/interactive-shoulder/block-engine/block-runner-registry.test.ts
 *
 * Exercises the registry mechanism in isolation with a synthetic runner —
 * target-block-runner.test.ts and pattern-block-runner.test.ts separately
 * prove the two real adapters register and resolve correctly.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBlockRunnerForBlockType,
  isBlockTypeRegistered,
  listRegisteredBlockRunners,
  registerBlockRunner,
} from "./block-runner-registry";
import type { BlockRunner } from "./block-runner-types";

type FakeState = { ticks: number };
type FakeInput = { nowMs: number };
type FakeCompletionEvent = { firedAtMs: number };

function makeFakeRunner(): BlockRunner<FakeState, FakeInput, FakeCompletionEvent, void> {
  return {
    blockType: "instructional",
    createInitialState: () => ({ ticks: 0 }),
    tick: (sessionState, state, input) => {
      if (sessionState !== "active") {
        return { state, ticked: false, completionEvent: null };
      }
      return {
        state: { ticks: state.ticks + 1 },
        ticked: true,
        completionEvent: input.nowMs > 1000 ? { firedAtMs: input.nowMs } : null,
      };
    },
  };
}

describe("block-runner-registry", () => {
  it("registers a runner, resolves it, rejects a duplicate, and lists it", () => {
    const runner = makeFakeRunner();

    // Before registration: unresolved, not a member, empty list.
    assert.equal(getBlockRunnerForBlockType("instructional"), null);
    assert.equal(isBlockTypeRegistered("instructional"), false);
    assert.deepEqual(listRegisteredBlockRunners(), []);

    registerBlockRunner(runner);

    // After registration: resolves to the exact same object, is a member, appears in the list.
    assert.equal(getBlockRunnerForBlockType("instructional"), runner);
    assert.equal(isBlockTypeRegistered("instructional"), true);
    assert.deepEqual(
      listRegisteredBlockRunners().map((r) => r.blockType),
      ["instructional"],
    );

    // Registering the same blockType again is a programming error, not a silent overwrite.
    assert.throws(
      () => registerBlockRunner(makeFakeRunner()),
      /already registered for blockType "instructional"/,
    );

    // A different, never-registered blockType resolves to null rather than falling
    // through to any default runner.
    assert.equal(getBlockRunnerForBlockType("movement-target"), null);
    assert.equal(getBlockRunnerForBlockType("movement-pattern"), null);
    assert.equal(isBlockTypeRegistered("movement-pattern"), false);
  });

  it("delegates tick() and createInitialState() through to the exact functions supplied at registration", () => {
    const runner = getBlockRunnerForBlockType("instructional")!;
    const state = runner.createInitialState();
    assert.deepEqual(state, { ticks: 0 });

    const activeResult = runner.tick("active", state, { nowMs: 0 });
    assert.equal(activeResult.ticked, true);
    assert.equal(activeResult.state.ticks, 1);
    assert.equal(activeResult.completionEvent, null);

    const completingResult = runner.tick("active", activeResult.state, { nowMs: 5000 });
    assert.ok(completingResult.completionEvent);
    assert.equal(completingResult.completionEvent?.firedAtMs, 5000);

    const pausedResult = runner.tick("paused", state, { nowMs: 0 });
    assert.equal(pausedResult.ticked, false);
    assert.equal(pausedResult.state.ticks, 0);
    assert.equal(pausedResult.completionEvent, null);
  });
});
