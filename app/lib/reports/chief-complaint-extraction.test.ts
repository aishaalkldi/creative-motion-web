/**
 * Run: npx tsx --test app/lib/reports/chief-complaint-extraction.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseStoredExtraction,
  type StructuredExtraction,
} from "./chief-complaint-extraction";

const SHOULDER_EXTRACTION: StructuredExtraction = {
  body_region: "shoulder",
  side: "right",
  primary_symptom: "pain",
  aggravating_factor: "overhead arm elevation",
  language: "ar",
  confidence: 0.92,
};

describe("parseStoredExtraction", () => {
  it("returns null for missing/undefined extraction", () => {
    assert.equal(parseStoredExtraction(undefined), null);
    assert.equal(parseStoredExtraction(null), null);
  });

  it("returns a valid stored extraction unaltered", () => {
    assert.deepEqual(parseStoredExtraction(SHOULDER_EXTRACTION), SHOULDER_EXTRACTION);
  });

  it("discards unknown fields — only the six whitelisted keys appear in the result", () => {
    const result = parseStoredExtraction({
      ...SHOULDER_EXTRACTION,
      extra_hint: "something unexpected",
    });
    assert.deepEqual(Object.keys(result!).sort(), [
      "aggravating_factor",
      "body_region",
      "confidence",
      "language",
      "primary_symptom",
      "side",
    ]);
  });

  it("discards diagnostic/treatment fields", () => {
    const result = parseStoredExtraction({
      ...SHOULDER_EXTRACTION,
      diagnosis: "possible rotator cuff tear",
      treatment_recommendation: "physiotherapy 3x/week",
    });
    assert.ok(result);
    assert.equal("diagnosis" in result!, false);
    assert.equal("treatment_recommendation" in result!, false);
  });

  it("rejects invalid shapes", () => {
    assert.equal(parseStoredExtraction("a string"), null);
    assert.equal(parseStoredExtraction(42), null);
    assert.equal(parseStoredExtraction([SHOULDER_EXTRACTION]), null);
    assert.equal(parseStoredExtraction({ side: "right" }), null);
    assert.equal(parseStoredExtraction({ ...SHOULDER_EXTRACTION, body_region: "" }), null);
    assert.equal(parseStoredExtraction({ ...SHOULDER_EXTRACTION, confidence: "high" }), null);
  });

  it("accepts null aggravating_factor but rejects non-string values", () => {
    assert.ok(parseStoredExtraction({ ...SHOULDER_EXTRACTION, aggravating_factor: null }));
    assert.equal(parseStoredExtraction({ ...SHOULDER_EXTRACTION, aggravating_factor: 123 }), null);
  });

  it("clamps out-of-range confidence into [0, 1]", () => {
    assert.equal(parseStoredExtraction({ ...SHOULDER_EXTRACTION, confidence: 5 })!.confidence, 1);
    assert.equal(parseStoredExtraction({ ...SHOULDER_EXTRACTION, confidence: -3 })!.confidence, 0);
  });
});
