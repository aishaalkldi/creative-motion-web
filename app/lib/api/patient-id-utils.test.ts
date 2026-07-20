/**
 * Run: npx tsx --test app/lib/api/patient-id-utils.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNumericDemoPatientId } from "@/app/lib/api/patient-id-utils";

describe("parseNumericDemoPatientId — legacy FastAPI assessment route gate", () => {
  it("returns null for UUID patient ids (no legacy FastAPI fetch)", () => {
    assert.equal(
      parseNumericDemoPatientId("550e8400-e29b-41d4-a716-446655440000"),
      null,
    );
  });

  it("returns a number for pure numeric legacy ids (legacy fetch allowed)", () => {
    assert.equal(parseNumericDemoPatientId("42"), 42);
    assert.equal(parseNumericDemoPatientId("1"), 1);
  });

  it("returns null for UUIDs beginning with digits (not treated as numeric)", () => {
    assert.equal(
      parseNumericDemoPatientId("00000000-0000-4000-a000-000000000001"),
      null,
    );
  });

  it("returns null for non-numeric and zero-only legacy strings", () => {
    assert.equal(parseNumericDemoPatientId(""), null);
    assert.equal(parseNumericDemoPatientId("0"), null);
    assert.equal(parseNumericDemoPatientId("abc"), null);
  });
});
