/**
 * Run: npx tsx --test app/components/patient/cv/CameraHUD.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatHudMmSs } from "./CameraHUD";

describe("CameraHUD helpers", () => {
  it("formats session seconds as MM:SS", () => {
    assert.equal(formatHudMmSs(0), "00:00");
    assert.equal(formatHudMmSs(17), "00:17");
    assert.equal(formatHudMmSs(75), "01:15");
    assert.equal(formatHudMmSs(-3), "00:00");
  });
});
