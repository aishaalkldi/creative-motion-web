/**
 * Run: npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-shadow-gate.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isShoulderAbductionReachShadowEnabled,
  isShoulderAbductionReachShadowPilotEnabledFromSearch,
} from "./shoulder-abduction-reach-shadow-gate";

describe("isShoulderAbductionReachShadowPilotEnabledFromSearch", () => {
  it("is disabled with no query params", () => {
    assert.equal(isShoulderAbductionReachShadowPilotEnabledFromSearch(""), false);
  });

  it("requires both cvDebug=1 and shoulderShadow=1", () => {
    assert.equal(isShoulderAbductionReachShadowPilotEnabledFromSearch("?cvDebug=1"), false);
    assert.equal(isShoulderAbductionReachShadowPilotEnabledFromSearch("?shoulderShadow=1"), false);
    assert.equal(
      isShoulderAbductionReachShadowPilotEnabledFromSearch("?cvDebug=1&shoulderShadow=1"),
      true,
    );
  });

  it("rejects any value other than the literal string 1", () => {
    assert.equal(
      isShoulderAbductionReachShadowPilotEnabledFromSearch("?cvDebug=true&shoulderShadow=true"),
      false,
    );
    assert.equal(
      isShoulderAbductionReachShadowPilotEnabledFromSearch("?cvDebug=1&shoulderShadow=0"),
      false,
    );
  });

  it("accepts a search string with or without a leading question mark", () => {
    assert.equal(
      isShoulderAbductionReachShadowPilotEnabledFromSearch("cvDebug=1&shoulderShadow=1"),
      true,
    );
  });

  it("does not enable STS motion timeline as a side effect (different flag)", () => {
    assert.equal(isShoulderAbductionReachShadowPilotEnabledFromSearch("?cvDebug=1&smtTimeline=1"), false);
  });
});

describe("isShoulderAbductionReachShadowEnabled", () => {
  it("is disabled outside a browser environment (no window global)", () => {
    assert.equal(typeof window, "undefined");
    assert.equal(isShoulderAbductionReachShadowEnabled(), false);
  });
});
