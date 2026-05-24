/** Server-only AssemblyAI helpers — disabled by default until ENABLE_ASSEMBLYAI=true. */

const TRANSCRIPT_TTL_MS = 30 * 60 * 1000;

type TranscriptEntry = { providerId: string; expiresAt: number };

const transcriptOwnership = new Map<string, TranscriptEntry>();

/** Feature flag — routes return 503 when false (default). */
export function isAssemblyAiEnabled(): boolean {
  return process.env.ENABLE_ASSEMBLYAI === "true";
}

export function registerTranscriptOwnership(transcriptId: string, providerId: string): void {
  transcriptOwnership.set(transcriptId, {
    providerId,
    expiresAt: Date.now() + TRANSCRIPT_TTL_MS,
  });
}

export function verifyTranscriptOwnership(transcriptId: string, providerId: string): boolean {
  const entry = transcriptOwnership.get(transcriptId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    transcriptOwnership.delete(transcriptId);
    return false;
  }
  return entry.providerId === providerId;
}

/** Max upload size for clinician audio (10 MB). */
export const ASSEMBLYAI_MAX_AUDIO_BYTES = 10 * 1024 * 1024;
