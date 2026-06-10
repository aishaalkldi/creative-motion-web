/**
 * Run: npx tsx --test app/lib/patient-workspace.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWeeklyActivityStrip } from "./patient-workspace";

describe("buildWeeklyActivityStrip", () => {
  it("marks days with session logs as active", () => {
    const today = new Date();
    const todayIso = today.toISOString();

    const strip = buildWeeklyActivityStrip(
      [{ id: "1", planSessionId: "s1", effortScore: null, painScore: null, exercisesCompleted: 1, notes: null, completedAt: todayIso }],
      "en",
    );

    assert.equal(strip.length, 7);
    assert.equal(strip[strip.length - 1]?.isToday, true);
    assert.equal(strip[strip.length - 1]?.active, true);
  });
});
