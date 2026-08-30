/**
 * Run: npx tsx --test app/lib/interactive-shoulder/resolve-cool-down-coaching.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCoolDownAlmostDonePhase,
  resolveCoolDownCoachingMessage,
} from "./resolve-cool-down-coaching";

describe("resolveCoolDownCoachingMessage", () => {
  it("rotates Arabic cool-down coaching copy by remaining time", () => {
    assert.equal(
      resolveCoolDownCoachingMessage("ar", 80),
      "اخفض ذراعك ببطء إلى وضع مريح.",
    );
    assert.equal(
      resolveCoolDownCoachingMessage("ar", 20),
      "أرخِ كتفك وخذ نفسًا هادئًا.",
    );
    assert.equal(resolveCoolDownCoachingMessage("ar", 4), "أوشكت على الانتهاء.");
  });

  it("rotates English cool-down coaching copy by remaining time", () => {
    assert.equal(
      resolveCoolDownCoachingMessage("en", 60),
      "Slowly lower your arm to a comfortable resting position.",
    );
    assert.equal(
      resolveCoolDownCoachingMessage("en", 15),
      "Relax your shoulder and take a calm breath.",
    );
    assert.equal(resolveCoolDownCoachingMessage("en", 3), "Almost done.");
  });

  it("detects the final almost-done phase without altering metrics", () => {
    assert.equal(isCoolDownAlmostDonePhase(5), true);
    assert.equal(isCoolDownAlmostDonePhase(6), false);
    assert.equal(isCoolDownAlmostDonePhase(null), false);
  });
});
