/** Speech AI S2 — speech_transcription_sessions constants (migration 012). */

export const SPEECH_TRANSCRIPTION_SESSION_SCHEMA_VERSION = "1";

export const SPEECH_TRANSCRIPTION_SOURCE_PATIENT_REMOTE = "patient_remote" as const;
export const SPEECH_TRANSCRIPTION_PROVIDER_ELEVENLABS = "elevenlabs" as const;

export const SPEECH_TRANSCRIPTION_STATUS_PENDING = "pending" as const;
export const SPEECH_TRANSCRIPTION_STATUS_COMPLETED = "completed" as const;
export const SPEECH_TRANSCRIPTION_STATUS_FAILED = "failed" as const;

export type SpeechTranscriptionSource = typeof SPEECH_TRANSCRIPTION_SOURCE_PATIENT_REMOTE;
export type SpeechTranscriptionProviderName = typeof SPEECH_TRANSCRIPTION_PROVIDER_ELEVENLABS;
export type SpeechTranscriptionStatus =
  | typeof SPEECH_TRANSCRIPTION_STATUS_PENDING
  | typeof SPEECH_TRANSCRIPTION_STATUS_COMPLETED
  | typeof SPEECH_TRANSCRIPTION_STATUS_FAILED;
