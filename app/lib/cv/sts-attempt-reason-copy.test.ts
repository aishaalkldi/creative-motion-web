/**
 * Run: npx tsx --test app/lib/cv/sts-attempt-reason-copy.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stsAttemptOutcomeCopy } from "./sts-attempt-reason-copy";

const ALL_KNOWN_RAW_REASONS = [
  "Rising detected but standing phase was not confirmed.",
  "Return confirmed but standing-like peak was not reached.",
  "Cycle duration was too brief for a supported complete attempt.",
  "Seated return confirmed but rising evidence was incomplete.",
  "Insufficient visibility or phase transition evidence during rising.",
  "Unable to assess due to camera angle or limited landmark visibility.",
  "Standing reached but return phase was not confirmed.",
  "Standing reached but seated return was not confirmed.",
  "Return phase detected but seated return was not confirmed.",
  "Readiness or calibration gate interrupted attempt evidence.",
  "Session ended before seated return was confirmed.",
  "Insufficient phase transition evidence before session end.",
];

describe("stsAttemptOutcomeCopy", () => {
  it("returns null when no attempt has finished yet", () => {
    assert.equal(stsAttemptOutcomeCopy(null, null, false), null);
    assert.equal(stsAttemptOutcomeCopy(null, null, true), null);
  });

  it("returns the positive 'rep counted' copy for a complete attempt, ignoring reason", () => {
    assert.equal(stsAttemptOutcomeCopy("complete", null, false), "Rep counted ✓");
    assert.equal(stsAttemptOutcomeCopy("complete", null, true), "تم تسجيل التكرار ✓");
  });

  it("maps every currently-known raw FSM reason string to non-empty friendly English and Arabic copy", () => {
    for (const reason of ALL_KNOWN_RAW_REASONS) {
      const en = stsAttemptOutcomeCopy("partial", reason, false);
      const ar = stsAttemptOutcomeCopy("unclear", reason, true);
      assert.ok(en && en.length > 0, `expected English copy for reason: ${reason}`);
      assert.ok(ar && ar.length > 0, `expected Arabic copy for reason: ${reason}`);
      // Friendly copy must never leak the raw internal diagnostic string to patients.
      assert.notEqual(en, reason);
    }
  });

  it("never returns the raw internal reason text as patient-facing copy", () => {
    for (const reason of ALL_KNOWN_RAW_REASONS) {
      const en = stsAttemptOutcomeCopy("partial", reason, false);
      assert.notEqual(en, reason);
    }
  });

  it("falls back to a generic message for an unrecognized reason string", () => {
    const en = stsAttemptOutcomeCopy("unclear", "some future reason text not yet mapped", false);
    const ar = stsAttemptOutcomeCopy("unclear", "some future reason text not yet mapped", true);
    assert.equal(en, "That attempt wasn't counted — try again");
    assert.equal(ar, "لم يتم احتساب تلك المحاولة — حاول مرة أخرى");
  });

  it("falls back to a generic message when reason is null but attempt type is not complete", () => {
    assert.equal(stsAttemptOutcomeCopy("partial", null, false), "That attempt wasn't counted — try again");
  });
});
