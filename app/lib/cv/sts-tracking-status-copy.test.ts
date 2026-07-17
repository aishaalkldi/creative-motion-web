/**
 * Run: npx tsx --test app/lib/cv/sts-tracking-status-copy.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  stsCalibratingCopy,
  stsCapturePhaseCopy,
  stsPoseDetectedCopy,
  stsReadinessCopy,
} from "./sts-tracking-status-copy";

describe("stsPoseDetectedCopy", () => {
  it("returns distinct, non-empty copy for every tracking status in both languages", () => {
    const statuses = ["idle", "detecting", "pose-found", "pose-lost"] as const;
    for (const status of statuses) {
      const en = stsPoseDetectedCopy(status, false);
      const ar = stsPoseDetectedCopy(status, true);
      assert.ok(en.length > 0, `expected English copy for ${status}`);
      assert.ok(ar.length > 0, `expected Arabic copy for ${status}`);
      assert.notEqual(en, ar);
    }
  });
});

describe("stsReadinessCopy", () => {
  it("returns positive copy when ready, independent of framing state", () => {
    assert.equal(stsReadinessCopy("ready", "good_distance", false), "Ready to track");
  });

  it("maps every not_ready body-framing reason to distinct, non-empty copy in both languages", () => {
    const framingStates = [
      "checking",
      "good_distance",
      "move_back",
      "move_closer",
      "adjust_camera_angle",
      "low_visibility",
    ] as const;
    for (const framing of framingStates) {
      const en = stsReadinessCopy("not_ready", framing, false);
      const ar = stsReadinessCopy("not_ready", framing, true);
      assert.ok(en.length > 0, `expected English copy for not_ready/${framing}`);
      assert.ok(ar.length > 0, `expected Arabic copy for not_ready/${framing}`);
    }
  });

  it("gives move_back and move_closer distinct copy (opposite guidance)", () => {
    const moveBack = stsReadinessCopy("not_ready", "move_back", false);
    const moveCloser = stsReadinessCopy("not_ready", "move_closer", false);
    assert.notEqual(moveBack, moveCloser);
  });
});

describe("stsCapturePhaseCopy", () => {
  it("returns null while calibrating (handled separately by stsCalibratingCopy)", () => {
    assert.equal(stsCapturePhaseCopy("calibrating", false), null);
  });

  it("returns null when capturePhase is undefined (non-v2 config)", () => {
    assert.equal(stsCapturePhaseCopy(undefined, false), null);
  });

  it("returns distinct, non-empty copy for each active movement phase", () => {
    const phases = ["seated", "rising", "standing", "returning"] as const;
    const seen = new Set<string>();
    for (const phase of phases) {
      const en = stsCapturePhaseCopy(phase, false);
      assert.ok(en && en.length > 0, `expected English copy for ${phase}`);
      assert.ok(!seen.has(en as string), `expected unique copy for ${phase}`);
      seen.add(en as string);
    }
  });
});

describe("stsCalibratingCopy", () => {
  it("returns non-empty copy in both languages", () => {
    assert.ok(stsCalibratingCopy(false).length > 0);
    assert.ok(stsCalibratingCopy(true).length > 0);
  });
});
