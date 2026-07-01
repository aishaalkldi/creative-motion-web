/**
 * Run: npx tsx --test app/lib/patient/browser-speech-to-text.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPatientLangToSpeechRecognitionLang } from "./browser-speech-to-text";

describe("browser-speech-to-text", () => {
  it("maps patient language to speech recognition locale", () => {
    assert.equal(mapPatientLangToSpeechRecognitionLang("ar"), "ar-SA");
    assert.equal(mapPatientLangToSpeechRecognitionLang("en"), "en-US");
  });
});
