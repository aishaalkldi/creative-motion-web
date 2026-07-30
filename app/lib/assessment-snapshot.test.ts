/**
 * Run: npx tsx --test app/lib/assessment-snapshot.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickPreferredAssessment } from "./assessment-snapshot";

describe("pickPreferredAssessment — post_stroke_intake", () => {
  it("selects post_stroke_intake when it is the only assessment type present", () => {
    const preferred = pickPreferredAssessment([
      { id: "a-1", type: "post_stroke_intake", created_at: "2026-07-30T08:00:00.000Z" },
    ]);
    assert.equal(preferred?.type, "post_stroke_intake");
  });

  it("still prefers remote_questionnaire over post_stroke_intake when both exist", () => {
    const preferred = pickPreferredAssessment([
      { id: "a-1", type: "post_stroke_intake", created_at: "2026-07-30T09:00:00.000Z" },
      { id: "a-2", type: "remote_questionnaire", created_at: "2026-07-28T08:00:00.000Z" },
    ]);
    assert.equal(preferred?.type, "remote_questionnaire");
  });
});
