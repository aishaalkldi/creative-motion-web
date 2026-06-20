/**
 * Run: npx tsx --test app/lib/elevenlabs-server.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  ELEVENLABS_MAX_AUDIO_BYTES,
  extractElevenLabsTranscriptText,
  isAllowedAssessmentAudioMime,
  isElevenLabsSttEnabled,
  mapAssessmentLanguageToElevenLabsCode,
  normalizeAssessmentSpeechLanguage,
  validateAssessmentAudioUpload,
} from "./elevenlabs-server";

describe("isElevenLabsSttEnabled", () => {
  const originalFlag = process.env.ENABLE_ELEVENLABS_STT;
  const originalKey = process.env.ELEVENLABS_API_KEY;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ENABLE_ELEVENLABS_STT;
    else process.env.ENABLE_ELEVENLABS_STT = originalFlag;
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
  });

  it("is false by default without flag", () => {
    delete process.env.ENABLE_ELEVENLABS_STT;
    process.env.ELEVENLABS_API_KEY = "test-key";
    assert.equal(isElevenLabsSttEnabled(), false);
  });

  it("is true when flag and key are set", () => {
    process.env.ENABLE_ELEVENLABS_STT = "true";
    process.env.ELEVENLABS_API_KEY = "test-key";
    assert.equal(isElevenLabsSttEnabled(), true);
  });
});

describe("normalizeAssessmentSpeechLanguage", () => {
  it("maps ar variants", () => {
    assert.equal(normalizeAssessmentSpeechLanguage("ar"), "ar");
    assert.equal(normalizeAssessmentSpeechLanguage("ar-SA"), "ar");
  });

  it("defaults to en", () => {
    assert.equal(normalizeAssessmentSpeechLanguage("en"), "en");
    assert.equal(normalizeAssessmentSpeechLanguage(null), "en");
  });
});

describe("mapAssessmentLanguageToElevenLabsCode", () => {
  it("maps en and ar", () => {
    assert.equal(mapAssessmentLanguageToElevenLabsCode("en"), "en");
    assert.equal(mapAssessmentLanguageToElevenLabsCode("ar"), "ar");
  });
});

describe("validateAssessmentAudioUpload", () => {
  it("rejects empty and tiny blobs", () => {
    assert.match(validateAssessmentAudioUpload(0) ?? "", /Missing/);
    assert.match(validateAssessmentAudioUpload(32) ?? "", /No speech/);
  });

  it("rejects oversize uploads", () => {
    assert.match(
      validateAssessmentAudioUpload(ELEVENLABS_MAX_AUDIO_BYTES + 1) ?? "",
      /too long/i,
    );
  });

  it("accepts valid size", () => {
    assert.equal(validateAssessmentAudioUpload(4096), null);
  });
});

describe("isAllowedAssessmentAudioMime", () => {
  it("allows common browser capture types", () => {
    assert.equal(isAllowedAssessmentAudioMime("audio/webm"), true);
    assert.equal(isAllowedAssessmentAudioMime("audio/webm;codecs=opus"), true);
  });

  it("rejects unknown types", () => {
    assert.equal(isAllowedAssessmentAudioMime("application/pdf"), false);
  });
});

describe("extractElevenLabsTranscriptText", () => {
  it("reads top-level text", () => {
    assert.equal(extractElevenLabsTranscriptText({ text: "  hello  " }), "hello");
  });

  it("joins transcripts array", () => {
    assert.equal(
      extractElevenLabsTranscriptText({ transcripts: [{ text: "line one" }, { text: "line two" }] }),
      "line one\nline two",
    );
  });

  it("returns null when empty", () => {
    assert.equal(extractElevenLabsTranscriptText({ text: "   " }), null);
    assert.equal(extractElevenLabsTranscriptText(null), null);
  });
});
