/**
 * Run: npx tsx --test app/lib/interactive-shoulder/instructional-copy.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instructionalCopy } from "./instructional-copy";

describe("instructionalCopy", () => {
  it("provides English and Arabic copy that are non-empty and distinct", () => {
    const en = instructionalCopy("en");
    const ar = instructionalCopy("ar");
    assert.ok(en.continueLabel.length > 0);
    assert.ok(ar.continueLabel.length > 0);
    assert.notEqual(en.continueLabel, ar.continueLabel);
    assert.ok(en.defaultInstructions.length > 0);
    assert.ok(ar.defaultInstructions.length > 0);
    assert.notEqual(en.defaultInstructions, ar.defaultInstructions);
  });
});
