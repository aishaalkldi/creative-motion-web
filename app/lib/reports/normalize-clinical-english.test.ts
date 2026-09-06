/**
 * Run: npx tsx --test app/lib/reports/normalize-clinical-english.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeClinicalEnglishText } from "./normalize-clinical-english";

describe("normalizeClinicalEnglishText", () => {
  it("removes obvious fillers without changing clinical meaning", () => {
    const result = normalizeClinicalEnglishText("Um, the patient reports, um, about one minute of standing tolerance.");
    assert.match(result.text, /one minute/i);
    assert.doesNotMatch(result.text, /\bum\b/i);
    assert.equal(result.hadFillersRemoved, true);
  });

  it("strips translator note artifacts and preserves uncertainty cautiously", () => {
    const result = normalizeClinicalEnglishText(
      "The patient reports pain [translator note: ambiguous term] in the shoulder.",
    );
    assert.doesNotMatch(result.text, /\[translator note/i);
    assert.equal(result.preservedUncertainty, true);
  });

  it("collapses duplicate patient-reports framing", () => {
    const result = normalizeClinicalEnglishText(
      "The patient reports main complaint of The patient reports weakness affecting the right hand.",
    );
    assert.equal(result.hadDuplicateFraming, true);
    assert.doesNotMatch(result.text, /main complaint of The patient reports/i);
  });
});
