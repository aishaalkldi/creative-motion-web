/**
 * Run: npx tsx --test app/lib/cv/sts-calibration-progress.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeStsCalibrationProgressPct } from "./sit-to-stand-detector";

describe("computeStsCalibrationProgressPct", () => {
  it("returns null when not currently calibrating", () => {
    assert.equal(computeStsCalibrationProgressPct(false, 1_000, 4_000, 3_000), null);
  });

  it("returns null when no baseline window has been armed", () => {
    assert.equal(computeStsCalibrationProgressPct(true, 1_000, 0, 3_000), null);
  });

  it("returns null when the configured duration is not positive", () => {
    assert.equal(computeStsCalibrationProgressPct(true, 1_000, 4_000, 0), null);
  });

  it("returns 0 at the very start of the calibration window", () => {
    // window: [1000, 4000), duration 3000 -> now=1000 is the start
    assert.equal(computeStsCalibrationProgressPct(true, 1_000, 4_000, 3_000), 0);
  });

  it("returns 50 at the midpoint of the calibration window", () => {
    assert.equal(computeStsCalibrationProgressPct(true, 2_500, 4_000, 3_000), 50);
  });

  it("returns 100 exactly at the end of the calibration window", () => {
    assert.equal(computeStsCalibrationProgressPct(true, 4_000, 4_000, 3_000), 100);
  });

  it("clamps to 100 if now is past the window end (frame arrives late)", () => {
    assert.equal(computeStsCalibrationProgressPct(true, 5_500, 4_000, 3_000), 100);
  });

  it("clamps to 0 if now is somehow before the window start (defensive)", () => {
    assert.equal(computeStsCalibrationProgressPct(true, 0, 4_000, 3_000), 0);
  });
});
