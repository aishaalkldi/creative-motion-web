/**
 * Run: npx tsx --test app/lib/ai/motion-review.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AI_MOTION_REVIEW_DISCLAIMER } from "@/app/lib/ai/motion-review-constants";
import {
  buildSafeFallbackMotionReview,
  validateMotionReviewDraft,
} from "@/app/lib/ai/motion-review-validate";

describe("motion-review validate", () => {
  it("accepts valid draft with required disclaimer", () => {
    const draft = validateMotionReviewDraft({
      trackingObservations: ["Tracking was fair for most of the session."],
      completionObservations: ["8 reps were detected."],
      visibilityObservations: ["Hip visibility was above threshold 70% of the time."],
      interruptionObservations: [],
      disclaimer: AI_MOTION_REVIEW_DISCLAIMER,
    });
    assert.ok(draft);
    assert.equal(draft!.disclaimer, AI_MOTION_REVIEW_DISCLAIMER);
  });

  it("rejects diagnosis language", () => {
    const draft = validateMotionReviewDraft({
      trackingObservations: ["Possible diagnosis of weakness."],
      completionObservations: [],
      visibilityObservations: [],
      interruptionObservations: [],
      disclaimer: AI_MOTION_REVIEW_DISCLAIMER,
    });
    assert.equal(draft, null);
  });

  it("fallback includes disclaimer", () => {
    const draft = buildSafeFallbackMotionReview();
    assert.equal(draft.disclaimer, AI_MOTION_REVIEW_DISCLAIMER);
  });
});
