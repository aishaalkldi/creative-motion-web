/**
 * Run: npx tsx --test app/lib/cv/sts-attempt-records.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countStsAttemptTypes,
  deriveStsRepTimingRecordsFromAttempts,
} from "@/app/lib/cv/sts-attempt-records";
import type { StsAttemptSummary } from "@/app/lib/cv/sts-biomechanical-capture-fsm";

const COMPLETE: StsAttemptSummary = {
  attemptIndex: 1,
  attemptType: "complete",
  startTimeMs: 100,
  endTimeMs: 1_200,
  risingDetected: true,
  standingReached: true,
  returningDetected: true,
  seatedReturnReached: true,
  phaseDurationsMs: { rising: 200, standing: 400, returning: 300, cycle: 1_100 },
  hipVerticalDisplacement: 0.08,
  confidence: "high",
  reason: null,
};

const PARTIAL: StsAttemptSummary = {
  attemptIndex: 2,
  attemptType: "partial",
  startTimeMs: 1_500,
  endTimeMs: 2_000,
  risingDetected: true,
  standingReached: false,
  returningDetected: false,
  seatedReturnReached: false,
  phaseDurationsMs: { rising: 180, standing: null, returning: null, cycle: 500 },
  hipVerticalDisplacement: 0.03,
  confidence: "medium",
  reason: "Rising detected but standing phase was not confirmed.",
};

describe("deriveStsRepTimingRecordsFromAttempts", () => {
  it("maps complete and partial attempts to assistive rep records", () => {
    const records = deriveStsRepTimingRecordsFromAttempts([COMPLETE, PARTIAL]);
    assert.equal(records.length, 2);
    assert.equal(records[0]!.completed, true);
    assert.ok(records[0]!.captureFlags.includes("complete_rep"));
    assert.equal(records[1]!.completed, false);
    assert.ok(records[1]!.captureFlags.includes("partial_attempt"));
    assert.ok(records[1]!.captureFlags.includes("incomplete_stand"));
  });

  it("counts attempt types without diagnosis wording", () => {
    const counts = countStsAttemptTypes([COMPLETE, PARTIAL]);
    assert.deepEqual(counts, { complete: 1, partial: 1, unclear: 0 });
  });
});
