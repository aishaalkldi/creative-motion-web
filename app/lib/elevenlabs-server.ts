/**
 * Server-only ElevenLabs Speech-to-Text helpers for patient assessment answers.
 * No emotion detection, diarization, or audio persistence.
 */

import {
  ELEVENLABS_MAX_AUDIO_BYTES,
  ELEVENLABS_MAX_DURATION_SEC,
} from "@/app/lib/elevenlabs-constants";

export { ELEVENLABS_MAX_AUDIO_BYTES, ELEVENLABS_MAX_DURATION_SEC };

export const ELEVENLABS_STT_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

export type AssessmentSpeechLanguage = "en" | "ar";

export type TranscribeAssessmentAudioInput = {
  audio: Buffer;
  mimeType: string;
  language: AssessmentSpeechLanguage;
};

export type TranscribeAssessmentAudioResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/** Feature flag — routes return 503 when false (default). */
export function isElevenLabsSttEnabled(): boolean {
  if (process.env.ENABLE_ELEVENLABS_STT !== "true") return false;
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function normalizeAssessmentSpeechLanguage(value: string | null | undefined): AssessmentSpeechLanguage {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "ar" || normalized.startsWith("ar")) return "ar";
  return "en";
}

export function mapAssessmentLanguageToElevenLabsCode(language: AssessmentSpeechLanguage): string {
  return language === "ar" ? "ar" : "en";
}

export function validateAssessmentAudioUpload(sizeBytes: number): string | null {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "Missing audio recording.";
  }
  if (sizeBytes < 64) {
    return "No speech captured. Please try again or type your answer.";
  }
  if (sizeBytes > ELEVENLABS_MAX_AUDIO_BYTES) {
    return "Recording is too long. Please record a shorter answer or type manually.";
  }
  return null;
}

const ALLOWED_AUDIO_MIME_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "video/webm",
];

export function isAllowedAssessmentAudioMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.trim().toLowerCase();
  return ALLOWED_AUDIO_MIME_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix};`),
  );
}

/** Parse ElevenLabs STT JSON — text field only; ignore diarization/events. */
export function extractElevenLabsTranscriptText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }

  const transcripts = record.transcripts;
  if (Array.isArray(transcripts)) {
    const parts = transcripts
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const text = (entry as Record<string, unknown>).text;
        return typeof text === "string" ? text.trim() : "";
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("\n").trim();
  }

  return null;
}

export async function transcribeAssessmentAudio(
  input: TranscribeAssessmentAudioInput,
): Promise<TranscribeAssessmentAudioResult> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key || !isElevenLabsSttEnabled()) {
    return { ok: false, error: "Speech transcription is not available." };
  }

  const sizeError = validateAssessmentAudioUpload(input.audio.length);
  if (sizeError) {
    return { ok: false, error: sizeError };
  }

  if (!isAllowedAssessmentAudioMime(input.mimeType)) {
    return { ok: false, error: "Unsupported audio format." };
  }

  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.audio)], { type: input.mimeType });
  form.append("file", blob, "assessment-answer.webm");
  form.append("model_id", "scribe_v2");
  form.append("language_code", mapAssessmentLanguageToElevenLabsCode(input.language));
  form.append("diarize", "false");

  let response: Response;
  try {
    response = await fetch(ELEVENLABS_STT_ENDPOINT, {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
  } catch {
    console.error("[elevenlabs-server] upstream request failed");
    return { ok: false, error: "Transcription request failed." };
  }

  if (!response.ok) {
    console.error("[elevenlabs-server] upstream returned error status");
    return { ok: false, error: "Transcription request failed." };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "Transcription response was invalid." };
  }

  const text = extractElevenLabsTranscriptText(payload);
  if (!text) {
    return { ok: false, error: "No speech detected. Please try again or type your answer manually." };
  }

  return { ok: true, text };
}
