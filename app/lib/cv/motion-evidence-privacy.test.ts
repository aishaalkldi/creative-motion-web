/**
 * Run: npx tsx --test app/lib/cv/motion-evidence-privacy.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findForbiddenMotionEvidenceKey,
  validateSessionMotionEvidenceSummary,
} from "@/app/lib/cv/motion-evidence-privacy";

describe("motion-evidence-privacy", () => {
  it("rejects forbidden top-level keys", () => {
    assert.equal(findForbiddenMotionEvidenceKey({ timeline: [] }), "timeline");
    assert.equal(findForbiddenMotionEvidenceKey({ snapshots: [] }), "snapshots");
    assert.equal(findForbiddenMotionEvidenceKey({ landmarks: [] }), "landmarks");
    assert.equal(findForbiddenMotionEvidenceKey({ video: "x" }), "video");
  });

  it("rejects nested forbidden keys in motionSummary", () => {
    const body = {
      motionSummary: {
        schemaVersion: "sms-1",
        exerciseId: "sit-to-stand",
        nested: { poseLandmarks: [] },
      },
    };
    assert.equal(findForbiddenMotionEvidenceKey(body), "motionSummary.nested.poseLandmarks");
  });

  it("validates sms-1 summary shape", () => {
    assert.equal(
      validateSessionMotionEvidenceSummary({
        schemaVersion: "sms-1",
        exerciseId: "sit-to-stand",
        durationS: 10,
      }),
      true,
    );
    assert.equal(
      validateSessionMotionEvidenceSummary({
        schemaVersion: "sms-0",
        exerciseId: "sit-to-stand",
      }),
      false,
    );
  });
});
