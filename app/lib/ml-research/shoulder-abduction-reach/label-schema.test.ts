/**
 * Run: npx tsx --test app/lib/ml-research/shoulder-abduction-reach/label-schema.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidShoulderAbductionReachLabelRecord,
  isValidShoulderAbductionReachLabelSubmission,
  ML_RESEARCH_DATASET_VERSION,
  ML_RESEARCH_LABEL_SCHEMA_VERSION,
  type ShoulderAbductionReachLabelRecord,
  type ShoulderAbductionReachLabelSubmission,
} from "@/app/lib/ml-research/shoulder-abduction-reach/label-schema";

function validSubmission(): ShoulderAbductionReachLabelSubmission {
  return {
    devSessionId: "dev-session-test",
    repetitionId: "dev-session-test-right-rep-1",
    sourceLineIndex: 0,
    side: "right",
    raterId: "therapist-A",
    compensationLabel: "NO_COMPENSATION",
    exclusionFlag: null,
    raterConfidence: "high",
    note: "",
    labeledAtMs: Date.now(),
  };
}

function validRecord(): ShoulderAbductionReachLabelRecord {
  return {
    ...validSubmission(),
    labelSchemaVersion: ML_RESEARCH_LABEL_SCHEMA_VERSION,
    datasetVersion: ML_RESEARCH_DATASET_VERSION,
    participantId: "dev-participant-001",
  };
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const clone = { ...obj };
  delete clone[key];
  return clone;
}

describe("isValidShoulderAbductionReachLabelSubmission", () => {
  it("accepts a well-formed compensation-label submission", () => {
    assert.equal(isValidShoulderAbductionReachLabelSubmission(validSubmission()), true);
  });

  it("accepts a well-formed exclusion-flag submission", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelSubmission({
        ...validSubmission(),
        compensationLabel: null,
        exclusionFlag: "WRONG_MOVEMENT_PLANE",
      }),
      true,
    );
  });

  it("rejects both compensationLabel and exclusionFlag set (double-label)", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelSubmission({
        ...validSubmission(),
        compensationLabel: "NO_COMPENSATION",
        exclusionFlag: "NOT_REVIEWABLE",
      }),
      false,
    );
  });

  it("rejects neither compensationLabel nor exclusionFlag set (empty label)", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelSubmission({
        ...validSubmission(),
        compensationLabel: null,
        exclusionFlag: null,
      }),
      false,
    );
  });

  it("rejects an invalid compensationLabel string", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), compensationLabel: "SOME_COMPENSATION" }),
      false,
    );
  });

  it("rejects an invalid exclusionFlag string", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelSubmission({
        ...validSubmission(),
        compensationLabel: null,
        exclusionFlag: "WRONG_SIDE",
      }),
      false,
    );
  });

  for (const label of ["NO_COMPENSATION", "MILD_COMPENSATION", "CLEAR_COMPENSATION"] as const) {
    it(`accepts compensationLabel=${label}`, () => {
      assert.equal(
        isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), compensationLabel: label }),
        true,
      );
    });
  }

  for (const flag of ["WRONG_MOVEMENT_PLANE", "INCOMPLETE_REPETITION", "NOT_REVIEWABLE"] as const) {
    it(`accepts exclusionFlag=${flag}`, () => {
      assert.equal(
        isValidShoulderAbductionReachLabelSubmission({
          ...validSubmission(),
          compensationLabel: null,
          exclusionFlag: flag,
        }),
        true,
      );
    });
  }

  it("rejects a missing/empty raterId", () => {
    assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), raterId: "" }), false);
    assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), raterId: "   " }), false);
    assert.equal(isValidShoulderAbductionReachLabelSubmission(omit(validSubmission(), "raterId")), false);
  });

  it("rejects a missing raterConfidence", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), raterConfidence: "certain" }),
      false,
    );
    assert.equal(isValidShoulderAbductionReachLabelSubmission(omit(validSubmission(), "raterConfidence")), false);
  });

  it("accepts every valid raterConfidence level", () => {
    for (const level of ["low", "medium", "high"] as const) {
      assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), raterConfidence: level }), true);
    }
  });

  it("rejects an invalid side", () => {
    assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), side: "both" }), false);
  });

  it("preserves side/session/repetition identity on a valid submission", () => {
    const submission = validSubmission();
    assert.equal(isValidShoulderAbductionReachLabelSubmission(submission), true);
    assert.equal(submission.devSessionId, "dev-session-test");
    assert.equal(submission.repetitionId, "dev-session-test-right-rep-1");
    assert.equal(submission.side, "right");
  });

  it("rejects a negative or non-integer sourceLineIndex", () => {
    assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), sourceLineIndex: -1 }), false);
    assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), sourceLineIndex: 1.5 }), false);
  });

  it("rejects a non-string note", () => {
    assert.equal(isValidShoulderAbductionReachLabelSubmission({ ...validSubmission(), note: 123 }), false);
  });

  it("rejects null and non-object input", () => {
    assert.equal(isValidShoulderAbductionReachLabelSubmission(null), false);
    assert.equal(isValidShoulderAbductionReachLabelSubmission("record"), false);
    assert.equal(isValidShoulderAbductionReachLabelSubmission(undefined), false);
  });

  it("does not require participantId, labelSchemaVersion, or datasetVersion (submission shape)", () => {
    const submission = validSubmission();
    assert.equal("participantId" in submission, false);
    assert.equal("labelSchemaVersion" in submission, false);
    assert.equal("datasetVersion" in submission, false);
  });
});

describe("isValidShoulderAbductionReachLabelRecord", () => {
  it("accepts a well-formed full record", () => {
    assert.equal(isValidShoulderAbductionReachLabelRecord(validRecord()), true);
  });

  it("rejects a mismatched label schema version", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelRecord({ ...validRecord(), labelSchemaVersion: "wrong" }),
      false,
    );
  });

  it("rejects a mismatched dataset version", () => {
    assert.equal(isValidShoulderAbductionReachLabelRecord({ ...validRecord(), datasetVersion: "wrong" }), false);
  });

  it("rejects a missing or empty participantId", () => {
    assert.equal(isValidShoulderAbductionReachLabelRecord({ ...validRecord(), participantId: "" }), false);
    assert.equal(isValidShoulderAbductionReachLabelRecord(omit(validRecord(), "participantId")), false);
  });

  it("rejects both compensationLabel and exclusionFlag set, same as the submission validator", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelRecord({
        ...validRecord(),
        compensationLabel: "MILD_COMPENSATION",
        exclusionFlag: "INCOMPLETE_REPETITION",
      }),
      false,
    );
  });

  it("rejects neither set", () => {
    assert.equal(
      isValidShoulderAbductionReachLabelRecord({ ...validRecord(), compensationLabel: null, exclusionFlag: null }),
      false,
    );
  });

  it("rejects null and non-object input", () => {
    assert.equal(isValidShoulderAbductionReachLabelRecord(null), false);
    assert.equal(isValidShoulderAbductionReachLabelRecord("record"), false);
    assert.equal(isValidShoulderAbductionReachLabelRecord(undefined), false);
  });
});
