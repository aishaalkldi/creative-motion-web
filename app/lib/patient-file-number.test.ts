/**
 * Run: npx tsx --test app/lib/patient-file-number.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayPatientFileHeader,
  formatPatientFileNumber,
  getPatientFileNumberFallback,
  nextPatientFileNumberSequence,
  parsePatientFileNumberSequence,
} from "./patient-file-number";

describe("formatPatientFileNumber", () => {
  it("formats with zero-padded sequence", () => {
    assert.equal(formatPatientFileNumber(1), "P-0001");
    assert.equal(formatPatientFileNumber(42), "P-0042");
    assert.equal(formatPatientFileNumber(9999), "P-9999");
  });

  it("clamps invalid sequence to 1", () => {
    assert.equal(formatPatientFileNumber(0), "P-0001");
    assert.equal(formatPatientFileNumber(-3), "P-0001");
  });
});

describe("parsePatientFileNumberSequence", () => {
  it("parses valid file numbers", () => {
    assert.equal(parsePatientFileNumberSequence("P-0001"), 1);
    assert.equal(parsePatientFileNumberSequence("P-0042"), 42);
  });

  it("returns null for invalid formats", () => {
    assert.equal(parsePatientFileNumberSequence("MRN-1"), null);
    assert.equal(parsePatientFileNumberSequence(""), null);
  });
});

describe("nextPatientFileNumberSequence", () => {
  it("returns 1 when no existing numbers", () => {
    assert.equal(nextPatientFileNumberSequence([]), 1);
  });

  it("returns max + 1", () => {
    assert.equal(nextPatientFileNumberSequence(["P-0001", "P-0003", "invalid"]), 4);
  });
});

describe("getPatientFileNumberFallback", () => {
  it("uses last 6 hex chars of uuid without dashes", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    assert.equal(getPatientFileNumberFallback(id), "…567890");
  });
});

describe("displayPatientFileHeader", () => {
  it("shows assigned file number when present", () => {
    assert.equal(displayPatientFileHeader("P-0007", "any-id"), "File P-0007");
  });

  it("shows fallback when file_number is null", () => {
    assert.equal(
      displayPatientFileHeader(null, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
      "File …EEEEEE",
    );
  });
});
