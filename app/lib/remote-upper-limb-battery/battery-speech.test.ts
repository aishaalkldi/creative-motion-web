/**
 * Run: npx tsx --test app/lib/remote-upper-limb-battery/battery-speech.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resetBatterySpeech, speakBatteryCue } from "./battery-speech";

describe("battery speech", () => {
  it("does not throw when speech synthesis is unavailable", () => {
    resetBatterySpeech();
    speakBatteryCue("stand-still", "right", "test");
    speakBatteryCue("stand-still", "right", "test");
  });
});
