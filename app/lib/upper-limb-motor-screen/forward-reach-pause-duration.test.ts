/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/forward-reach-pause-duration.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLongestForwardReachPauseGapMs } from "./forward-reach-pause-duration";
import type { ProtectivePauseEvent } from "./types";

function pauseEvent(overrides: Partial<ProtectivePauseEvent> = {}): ProtectivePauseEvent {
  return {
    reason: { category: "tracking_or_environment", detail: "wrist_landmark_lost" },
    startedAtMs: 0,
    endedAtMs: null,
    outcome: "resumed",
    readinessConfirmedAt: null,
    resumedBy: null,
    ...overrides,
  };
}

describe("computeLongestForwardReachPauseGapMs", () => {
  it("no protective pauses -> 0", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 1000,
      protectivePauseEvents: [],
    });
    assert.equal(result, 0);
  });

  it("one ended pause -> endedAtMs - startedAtMs", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 1000,
      protectivePauseEvents: [pauseEvent({ startedAtMs: 100, endedAtMs: 400, outcome: "resumed" })],
    });
    assert.equal(result, 300);
  });

  it("multiple ended pauses -> the longest one wins", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 2000,
      protectivePauseEvents: [
        pauseEvent({ startedAtMs: 0, endedAtMs: 150, outcome: "resumed" }),
        pauseEvent({ startedAtMs: 500, endedAtMs: 1300, outcome: "resumed" }),
        pauseEvent({ startedAtMs: 1400, endedAtMs: 1550, outcome: "resumed" }),
      ],
    });
    assert.equal(result, 800);
  });

  it("terminal open pause with outcome session_ended_while_paused uses completedAtMs - startedAtMs", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 900,
      protectivePauseEvents: [
        pauseEvent({ startedAtMs: 300, endedAtMs: null, outcome: "session_ended_while_paused" }),
      ],
    });
    assert.equal(result, 600);
  });

  it("terminal open pause with completedAtMs null is not counted", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: null,
      protectivePauseEvents: [
        pauseEvent({ startedAtMs: 300, endedAtMs: null, outcome: "session_ended_while_paused" }),
      ],
    });
    assert.equal(result, 0);
  });

  it("open pause NOT tagged session_ended_while_paused is not counted (e.g. escalated_to_clinical_stop)", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 900,
      protectivePauseEvents: [
        pauseEvent({ startedAtMs: 300, endedAtMs: null, outcome: "escalated_to_clinical_stop" }),
      ],
    });
    assert.equal(result, 0);
  });

  it("mix of ended and terminal-open pauses -> the longest across both kinds wins", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 1000,
      protectivePauseEvents: [
        pauseEvent({ startedAtMs: 0, endedAtMs: 100, outcome: "resumed" }),
        pauseEvent({ startedAtMs: 200, endedAtMs: null, outcome: "session_ended_while_paused" }),
      ],
    });
    // second event: 1000 - 200 = 800, longer than the first (100)
    assert.equal(result, 800);
  });

  it("negative or non-finite computed durations are excluded", () => {
    const result = computeLongestForwardReachPauseGapMs({
      completedAtMs: 100,
      protectivePauseEvents: [
        // endedAtMs before startedAtMs -> negative, excluded
        pauseEvent({ startedAtMs: 500, endedAtMs: 400, outcome: "resumed" }),
        // legitimate positive duration should still be picked up
        pauseEvent({ startedAtMs: 10, endedAtMs: 60, outcome: "resumed" }),
      ],
    });
    assert.equal(result, 50);
  });

  describe("integer-millisecond normalization (live performance.now() timestamps are fractional)", () => {
    it("rounds a fractional ended-pause duration to the nearest whole millisecond", () => {
      const result = computeLongestForwardReachPauseGapMs({
        completedAtMs: 1000,
        protectivePauseEvents: [
          pauseEvent({ startedAtMs: 100.19999980926514, endedAtMs: 488442.8999997973, outcome: "resumed" }),
        ],
      });
      assert.equal(result, Math.round(488442.8999997973 - 100.19999980926514));
      assert.equal(Number.isInteger(result), true);
    });

    it("rounds a fractional terminal open-pause duration (completedAtMs - startedAtMs)", () => {
      const result = computeLongestForwardReachPauseGapMs({
        completedAtMs: 900.5000002,
        protectivePauseEvents: [
          pauseEvent({ startedAtMs: 300.19999980926514, endedAtMs: null, outcome: "session_ended_while_paused" }),
        ],
      });
      assert.equal(result, 600);
    });

    it("picks the longest by true magnitude before rounding, not after — rounding the max never changes which event wins", () => {
      const result = computeLongestForwardReachPauseGapMs({
        completedAtMs: 2000,
        protectivePauseEvents: [
          pauseEvent({ startedAtMs: 0, endedAtMs: 150.4, outcome: "resumed" }),
          pauseEvent({ startedAtMs: 500, endedAtMs: 1300.6, outcome: "resumed" }),
        ],
      });
      assert.equal(result, 801); // round(800.6) = 801, the genuinely-longer event
    });

    it("no pauses still returns the integer 0, not -0 or a float", () => {
      const result = computeLongestForwardReachPauseGapMs({ completedAtMs: 1000, protectivePauseEvents: [] });
      assert.equal(result, 0);
      assert.equal(Number.isInteger(result), true);
    });

    it("leaves an already-integer duration unchanged", () => {
      const result = computeLongestForwardReachPauseGapMs({
        completedAtMs: 1000,
        protectivePauseEvents: [pauseEvent({ startedAtMs: 100, endedAtMs: 400, outcome: "resumed" })],
      });
      assert.equal(result, 300);
    });
  });
});
