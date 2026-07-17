/**
 * Run: npx tsx --test app/components/patient/cv/RocketLaunchOverlay.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePrescribedRepsTarget,
  resolveRocketAltitudePercent,
  resolveRocketFuelPercent,
  rocketOverlayCopy,
} from "./RocketLaunchOverlay";

describe("parsePrescribedRepsTarget", () => {
  it("returns a positive integer for numeric reps", () => {
    assert.equal(parsePrescribedRepsTarget(10), 10);
    assert.equal(parsePrescribedRepsTarget(8.9), 8);
  });

  it("extracts the first integer from range strings", () => {
    assert.equal(parsePrescribedRepsTarget("8–12"), 8);
    assert.equal(parsePrescribedRepsTarget("8-12"), 8);
    assert.equal(parsePrescribedRepsTarget("8–10 each leg"), 8);
  });

  it("returns undefined for empty or invalid values", () => {
    assert.equal(parsePrescribedRepsTarget(undefined), undefined);
    assert.equal(parsePrescribedRepsTarget(""), undefined);
    assert.equal(parsePrescribedRepsTarget(0), undefined);
    assert.equal(parsePrescribedRepsTarget("none"), undefined);
  });
});

describe("resolveRocketAltitudePercent", () => {
  it("maps stand phases to launch altitudes", () => {
    assert.equal(resolveRocketAltitudePercent("down"), 8);
    assert.equal(resolveRocketAltitudePercent("up"), 72);
    assert.equal(resolveRocketAltitudePercent("—"), 36);
  });
});

describe("resolveRocketFuelPercent", () => {
  it("maps tracking quality tiers to fuel gauge fill", () => {
    assert.equal(resolveRocketFuelPercent("good"), 100);
    assert.equal(resolveRocketFuelPercent("fair"), 58);
    assert.equal(resolveRocketFuelPercent("poor"), 24);
    assert.equal(resolveRocketFuelPercent(null), 12);
  });
});

describe("rocketOverlayCopy", () => {
  it("provides English copy", () => {
    const copy = rocketOverlayCopy(false);
    assert.equal(copy.trackingLabel, "Tracking");
    assert.equal(copy.repRecorded, "Rep recorded ✓");
    assert.equal(copy.reps(3), "3 reps");
    assert.equal(copy.targetReps(3, 8), "3 / 8 reps");
    assert.equal(copy.seated, "Seated");
    assert.equal(copy.standing, "Standing");
  });

  it("provides Arabic copy", () => {
    const copy = rocketOverlayCopy(true);
    assert.equal(copy.trackingLabel, "التتبّع");
    assert.equal(copy.repRecorded, "تم تسجيل التكرار ✓");
    assert.equal(copy.reps(3), "3 تكرارات");
    assert.equal(copy.targetReps(3, 8), "3 / 8 تكرارات");
    assert.equal(copy.seated, "جالس");
    assert.equal(copy.standing, "واقف");
  });
});
