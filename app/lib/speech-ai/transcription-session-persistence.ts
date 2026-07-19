import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import {
  SPEECH_TRANSCRIPTION_PROVIDER_ELEVENLABS,
  SPEECH_TRANSCRIPTION_SESSION_SCHEMA_VERSION,
  SPEECH_TRANSCRIPTION_SOURCE_PATIENT_REMOTE,
  SPEECH_TRANSCRIPTION_STATUS_COMPLETED,
  SPEECH_TRANSCRIPTION_STATUS_FAILED,
  SPEECH_TRANSCRIPTION_STATUS_PENDING,
} from "./transcription-session-constants";

/** IDs derived from a validated remote_assessment_requests row — never from the client. */
export type ValidatedRemoteRequestRow = {
  id: string;
  patient_id: string;
  provider_id: string;
};

export type PatientRemotePendingSessionInput = {
  remoteRequest: ValidatedRemoteRequestRow;
  languageCode: string;
  byteSize: number;
};

export function buildPatientRemotePendingInsert(
  input: PatientRemotePendingSessionInput,
): Database["public"]["Tables"]["speech_transcription_sessions"]["Insert"] {
  return {
    source: SPEECH_TRANSCRIPTION_SOURCE_PATIENT_REMOTE,
    provider_name: SPEECH_TRANSCRIPTION_PROVIDER_ELEVENLABS,
    remote_request_id: input.remoteRequest.id,
    patient_id: input.remoteRequest.patient_id,
    provider_id: input.remoteRequest.provider_id,
    language_code: input.languageCode,
    status: SPEECH_TRANSCRIPTION_STATUS_PENDING,
    byte_size: input.byteSize,
    schema_version: SPEECH_TRANSCRIPTION_SESSION_SCHEMA_VERSION,
  };
}

/** Best-effort pending row — never throws; returns session id when saved. */
export async function createPendingPatientRemoteSession(
  adminClient: SupabaseClient,
  input: PatientRemotePendingSessionInput,
): Promise<string | null> {
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return null;
  }

  const row = buildPatientRemotePendingInsert(input);

  const { data, error } = await adminClient
    .from("speech_transcription_sessions")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.warn(
      "[createPendingPatientRemoteSession] insert failed:",
      error.message,
    );
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}

/** Best-effort completion — never throws; returns true when updated. */
export async function markTranscriptionSessionCompleted(
  adminClient: SupabaseClient,
  sessionId: string,
  transcriptText: string,
): Promise<boolean> {
  const text = transcriptText.trim();
  if (!text) return false;

  const { error } = await adminClient
    .from("speech_transcription_sessions")
    .update({
      status: SPEECH_TRANSCRIPTION_STATUS_COMPLETED,
      transcript_text: text,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.warn(
      "[markTranscriptionSessionCompleted] update failed:",
      error.message,
    );
    return false;
  }

  return true;
}

/** Best-effort failure marker — never throws; returns true when updated. */
export async function markTranscriptionSessionFailed(
  adminClient: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { error } = await adminClient
    .from("speech_transcription_sessions")
    .update({
      status: SPEECH_TRANSCRIPTION_STATUS_FAILED,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.warn(
      "[markTranscriptionSessionFailed] update failed:",
      error.message,
    );
    return false;
  }

  return true;
}

/** Best-effort backfill after assessment submit — never throws. */
export async function backfillTranscriptionSessionAssessmentId(
  adminClient: SupabaseClient,
  remoteRequestId: string,
  assessmentId: string,
): Promise<boolean> {
  const { error } = await adminClient
    .from("speech_transcription_sessions")
    .update({ assessment_id: assessmentId })
    .eq("remote_request_id", remoteRequestId)
    .is("assessment_id", null);

  if (error) {
    console.warn(
      "[backfillTranscriptionSessionAssessmentId] update failed:",
      error.message,
    );
    return false;
  }

  return true;
}
