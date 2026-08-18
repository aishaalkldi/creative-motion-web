/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/single-flight-guard.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSingleFlightGuard } from "./single-flight-guard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createSingleFlightGuard", () => {
  it("a concurrent second call while the first is in flight is skipped — exactly one execution", async () => {
    const guard = createSingleFlightGuard();
    const calls: number[] = [];
    const gate = deferred<void>();

    const first = guard.run(async () => {
      calls.push(1);
      await gate.promise;
      return "first";
    });

    // Second call issued while the first is still pending.
    assert.equal(guard.inProgress, true);
    const second = guard.run(async () => {
      calls.push(2);
      return "second";
    });

    const secondResult = await second;
    assert.deepEqual(secondResult, { skipped: true });
    assert.deepEqual(calls, [1]);

    gate.resolve();
    const firstResult = await first;
    assert.deepEqual(firstResult, { skipped: false, value: "first" });
    assert.equal(guard.inProgress, false);
  });

  it("sequential calls after settling both execute", async () => {
    const guard = createSingleFlightGuard();
    const first = await guard.run(async () => "a");
    const second = await guard.run(async () => "b");
    assert.deepEqual(first, { skipped: false, value: "a" });
    assert.deepEqual(second, { skipped: false, value: "b" });
  });

  it("resets inProgress even when fn() throws, so a later retry is not permanently blocked", async () => {
    const guard = createSingleFlightGuard();
    await assert.rejects(
      guard.run(async () => {
        throw new Error("boom");
      }),
    );
    assert.equal(guard.inProgress, false);
    const retry = await guard.run(async () => "ok");
    assert.deepEqual(retry, { skipped: false, value: "ok" });
  });

  it("inProgress is false before any run() and after every run() settles", async () => {
    const guard = createSingleFlightGuard();
    assert.equal(guard.inProgress, false);
    await guard.run(async () => undefined);
    assert.equal(guard.inProgress, false);
  });
});
