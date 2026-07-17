/**
 * Run: npx tsx --test app/lib/remote-assessment-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REMOTE_ASSESSMENT_MAX_JSON_BYTES,
  REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS,
  REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS,
  REMOTE_ASSESSMENT_MAX_STRING_LENGTH,
  REMOTE_ASSESSMENT_MAX_DEPTH,
  isRemoteAssessmentBodyTooLarge,
  validateRemoteAssessmentStructuredData,
} from "./remote-assessment-validation";

/** Builds an object with exactly `count` primitive-valued keys. */
function objectWithFieldCount(count: number): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < count; i++) obj[`k${i}`] = "v";
  return obj;
}

/** Wraps `leaf` in `levels` nested single-key objects (`{n: {n: ... leaf}}`). */
function nestValue(levels: number, leaf: unknown): unknown {
  let value = leaf;
  for (let i = 0; i < levels; i++) value = { n: value };
  return value;
}

describe("validateRemoteAssessmentStructuredData — shape rejection", () => {
  it("rejects null", () => {
    assert.equal(validateRemoteAssessmentStructuredData(null).ok, false);
  });

  it("rejects a bare string", () => {
    assert.equal(validateRemoteAssessmentStructuredData("not an object").ok, false);
  });

  it("rejects a bare number", () => {
    assert.equal(validateRemoteAssessmentStructuredData(42).ok, false);
  });

  it("rejects an array (not a plain object)", () => {
    assert.equal(validateRemoteAssessmentStructuredData([1, 2, 3]).ok, false);
  });

  it("rejects an empty object", () => {
    const result = validateRemoteAssessmentStructuredData({});
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Invalid assessment data.");
  });

  it("accepts a minimal valid object", () => {
    const result = validateRemoteAssessmentStructuredData({ pain: { chiefComplaint: "shoulder" } });
    assert.equal(result.ok, true);
  });
});

describe("validateRemoteAssessmentStructuredData — top-level key limit", () => {
  it(`accepts exactly ${REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS} top-level keys`, () => {
    const obj = objectWithFieldCount(REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS);
    assert.equal(validateRemoteAssessmentStructuredData(obj).ok, true);
  });

  it(`rejects ${REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS + 1} top-level keys`, () => {
    const obj = objectWithFieldCount(REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS + 1);
    const result = validateRemoteAssessmentStructuredData(obj);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Assessment data exceeds allowed size.");
  });
});

describe("validateRemoteAssessmentStructuredData — total field limit", () => {
  it(`accepts exactly ${REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS} total fields`, () => {
    // One top-level key holding an object with (MAX_TOTAL_FIELDS - 1) sub-keys:
    // total fields = 1 (outer key) + (MAX_TOTAL_FIELDS - 1) (inner keys) = MAX_TOTAL_FIELDS.
    const inner = objectWithFieldCount(REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS - 1);
    const result = validateRemoteAssessmentStructuredData({ section: inner });
    assert.equal(result.ok, true);
  });

  it(`rejects ${REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS + 1} total fields`, () => {
    const inner = objectWithFieldCount(REMOTE_ASSESSMENT_MAX_TOTAL_FIELDS);
    const result = validateRemoteAssessmentStructuredData({ section: inner });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Assessment data exceeds allowed size.");
  });
});

describe("validateRemoteAssessmentStructuredData — string length limit", () => {
  it(`accepts a string exactly ${REMOTE_ASSESSMENT_MAX_STRING_LENGTH} chars`, () => {
    const result = validateRemoteAssessmentStructuredData({
      note: "x".repeat(REMOTE_ASSESSMENT_MAX_STRING_LENGTH),
    });
    assert.equal(result.ok, true);
  });

  it(`rejects a string of ${REMOTE_ASSESSMENT_MAX_STRING_LENGTH + 1} chars`, () => {
    const result = validateRemoteAssessmentStructuredData({
      note: "x".repeat(REMOTE_ASSESSMENT_MAX_STRING_LENGTH + 1),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Assessment data exceeds allowed size.");
  });
});

describe("validateRemoteAssessmentStructuredData — nesting depth limit", () => {
  // A value nested `levels` deep is evaluated with the recursive `depth`
  // parameter equal to `levels` when the validator's helpers reach it.
  // The implementation's guard is `depth > REMOTE_ASSESSMENT_MAX_DEPTH`, so
  // levels === MAX_DEPTH must pass and levels === MAX_DEPTH + 1 must fail.
  it(`accepts nesting exactly ${REMOTE_ASSESSMENT_MAX_DEPTH} levels deep`, () => {
    const value = nestValue(REMOTE_ASSESSMENT_MAX_DEPTH, "leaf") as Record<string, unknown>;
    const result = validateRemoteAssessmentStructuredData(value);
    assert.equal(result.ok, true);
  });

  it(`rejects nesting ${REMOTE_ASSESSMENT_MAX_DEPTH + 1} levels deep`, () => {
    const value = nestValue(REMOTE_ASSESSMENT_MAX_DEPTH + 1, "leaf") as Record<string, unknown>;
    const result = validateRemoteAssessmentStructuredData(value);
    assert.equal(result.ok, false);
    // Both the field-count guard and the string-length guard independently
    // reject beyond max depth, so only the generic message is guaranteed.
    if (!result.ok) assert.equal(result.error, "Assessment data exceeds allowed size.");
  });
});

describe("validateRemoteAssessmentStructuredData — byte size limit", () => {
  it("accepts a payload just under the byte cap", () => {
    // One ~500KB string, safely under the 512KB serialized cap and under
    // the per-string 8000-char cap by using many moderate-length fields
    // instead of one giant string.
    const obj: Record<string, string> = {};
    const chunk = "x".repeat(REMOTE_ASSESSMENT_MAX_STRING_LENGTH);
    // 32 top-level keys x 8000 chars ≈ 256,000 bytes — under the 512KB cap.
    for (let i = 0; i < REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS; i++) obj[`k${i}`] = chunk;
    const result = validateRemoteAssessmentStructuredData(obj);
    assert.equal(result.ok, true);
  });

  it("rejects a payload over the byte cap", () => {
    // A single field can't legally exceed REMOTE_ASSESSMENT_MAX_STRING_LENGTH,
    // so use many sub-objects each holding a max-length string to cross the
    // 512KB serialized-size cap while staying within the field-count cap.
    const chunk = "x".repeat(REMOTE_ASSESSMENT_MAX_STRING_LENGTH);
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < REMOTE_ASSESSMENT_MAX_TOP_LEVEL_KEYS; i++) {
      obj[`k${i}`] = { a: chunk, b: chunk, c: chunk };
    }
    // 32 keys x 3 x 8000 chars ≈ 768,000 bytes — over the 512KB cap.
    const result = validateRemoteAssessmentStructuredData(obj);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Assessment data exceeds allowed size.");
  });
});

describe("validateRemoteAssessmentStructuredData — documented gap: array field-count bypass", () => {
  it("passes the field-count check for a large array of near-max-length strings", () => {
    // countFields() only increments on Object.keys(obj).length; primitive
    // array items contribute 0 regardless of how many there are. This lets
    // a single top-level field hold a sizeable payload (well under the byte
    // cap) while reporting a trivial field count. This is a known,
    // documented characteristic of the current implementation — not fixed
    // here, since it doesn't block these tests from running correctly.
    const chunk = "x".repeat(REMOTE_ASSESSMENT_MAX_STRING_LENGTH - 1);
    const bigArray = Array.from({ length: 60 }, () => chunk); // ~480KB, under the 512KB cap
    const result = validateRemoteAssessmentStructuredData({ notes: bigArray });
    assert.equal(result.ok, true, "documents current behavior: this is allowed, not a target to fix here");
  });
});

describe("isRemoteAssessmentBodyTooLarge", () => {
  it("returns false when the header is missing", () => {
    assert.equal(isRemoteAssessmentBodyTooLarge(null), false);
  });

  it("returns false for a non-numeric header", () => {
    assert.equal(isRemoteAssessmentBodyTooLarge("not-a-number"), false);
  });

  it("returns false for a negative header value", () => {
    assert.equal(isRemoteAssessmentBodyTooLarge("-5"), false);
  });

  it("returns false exactly at the byte cap", () => {
    assert.equal(isRemoteAssessmentBodyTooLarge(String(REMOTE_ASSESSMENT_MAX_JSON_BYTES)), false);
  });

  it("returns true one byte over the cap", () => {
    assert.equal(isRemoteAssessmentBodyTooLarge(String(REMOTE_ASSESSMENT_MAX_JSON_BYTES + 1)), true);
  });
});
