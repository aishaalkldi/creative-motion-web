/**
 * Run: npx tsx --test app/lib/speech-ai/__tests__/transcription-session-persistence.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SPEECH_TRANSCRIPTION_PROVIDER_ELEVENLABS,
  SPEECH_TRANSCRIPTION_SESSION_SCHEMA_VERSION,
  SPEECH_TRANSCRIPTION_SOURCE_PATIENT_REMOTE,
  SPEECH_TRANSCRIPTION_STATUS_COMPLETED,
  SPEECH_TRANSCRIPTION_STATUS_FAILED,
  SPEECH_TRANSCRIPTION_STATUS_PENDING,
} from "../transcription-session-constants";
import {
  backfillTranscriptionSessionAssessmentId,
  buildPatientRemotePendingInsert,
  createPendingPatientRemoteSession,
  markTranscriptionSessionCompleted,
  markTranscriptionSessionFailed,
} from "../transcription-session-persistence";

const REMOTE_REQUEST = {
  id: "req-11111111-1111-1111-1111-111111111111",
  patient_id: "pat-22222222-2222-2222-2222-222222222222",
  provider_id: "pro-33333333-3333-3333-3333-333333333333",
};

function thenableChain<T>(result: T) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    is: () => chain,
    then: (resolve: (v: T) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function createMockAdmin(handlers: {
  insert?: { data?: { id: string } | null; error?: { message: string } | null };
  update?: { error?: { message: string } | null };
}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];

  const client = {
    from: (table: string) => {
      if (table !== "speech_transcription_sessions") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        insert: (row: unknown) => {
          inserts.push(row);
          return {
            select: () => ({
              single: async () =>
                handlers.insert ?? { data: { id: "sess-abc" }, error: null },
            }),
          };
        },
        update: (patch: unknown) => {
          updates.push(patch);
          return thenableChain(handlers.update ?? { error: null });
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, inserts, updates };
}

describe("buildPatientRemotePendingInsert", () => {
  it("derives ids only from the validated remote request row", () => {
    const row = buildPatientRemotePendingInsert({
      remoteRequest: REMOTE_REQUEST,
      languageCode: "en",
      byteSize: 4096,
    });

    assert.equal(row.source, SPEECH_TRANSCRIPTION_SOURCE_PATIENT_REMOTE);
    assert.equal(row.provider_name, SPEECH_TRANSCRIPTION_PROVIDER_ELEVENLABS);
    assert.equal(row.remote_request_id, REMOTE_REQUEST.id);
    assert.equal(row.patient_id, REMOTE_REQUEST.patient_id);
    assert.equal(row.provider_id, REMOTE_REQUEST.provider_id);
    assert.equal(row.language_code, "en");
    assert.equal(row.status, SPEECH_TRANSCRIPTION_STATUS_PENDING);
    assert.equal(row.byte_size, 4096);
    assert.equal(row.schema_version, SPEECH_TRANSCRIPTION_SESSION_SCHEMA_VERSION);
    assert.equal(row.external_job_id, undefined);
  });
});

describe("createPendingPatientRemoteSession", () => {
  it("returns session id on successful insert", async () => {
    const { client, inserts } = createMockAdmin({});
    const id = await createPendingPatientRemoteSession(client, {
      remoteRequest: REMOTE_REQUEST,
      languageCode: "ar",
      byteSize: 128,
    });
    assert.equal(id, "sess-abc");
    assert.equal(inserts.length, 1);
  });

  it("returns null on insert failure without throwing", async () => {
    const { client } = createMockAdmin({
      insert: { data: null, error: { message: "insert failed" } },
    });
    const id = await createPendingPatientRemoteSession(client, {
      remoteRequest: REMOTE_REQUEST,
      languageCode: "en",
      byteSize: 128,
    });
    assert.equal(id, null);
  });

  it("returns null for invalid byte size", async () => {
    const { client } = createMockAdmin({});
    const id = await createPendingPatientRemoteSession(client, {
      remoteRequest: REMOTE_REQUEST,
      languageCode: "en",
      byteSize: 0,
    });
    assert.equal(id, null);
  });
});

describe("markTranscriptionSessionCompleted", () => {
  it("updates status, transcript, and completed_at", async () => {
    const { client, updates } = createMockAdmin({});
    const ok = await markTranscriptionSessionCompleted(client, "sess-abc", "  hello world  ");
    assert.equal(ok, true);
    assert.equal(updates.length, 1);
    const patch = updates[0] as {
      status: string;
      transcript_text: string;
      completed_at: string;
    };
    assert.equal(patch.status, SPEECH_TRANSCRIPTION_STATUS_COMPLETED);
    assert.equal(patch.transcript_text, "hello world");
    assert.ok(patch.completed_at);
  });

  it("returns false for empty transcript", async () => {
    const { client, updates } = createMockAdmin({});
    const ok = await markTranscriptionSessionCompleted(client, "sess-abc", "   ");
    assert.equal(ok, false);
    assert.equal(updates.length, 0);
  });
});

describe("markTranscriptionSessionFailed", () => {
  it("updates status to failed", async () => {
    const { client, updates } = createMockAdmin({});
    const ok = await markTranscriptionSessionFailed(client, "sess-abc");
    assert.equal(ok, true);
    assert.equal((updates[0] as { status: string }).status, SPEECH_TRANSCRIPTION_STATUS_FAILED);
  });
});

describe("backfillTranscriptionSessionAssessmentId", () => {
  it("updates assessment_id by remote_request_id", async () => {
    const { client, updates } = createMockAdmin({});
    const ok = await backfillTranscriptionSessionAssessmentId(
      client,
      REMOTE_REQUEST.id,
      "assessment-999",
    );
    assert.equal(ok, true);
    assert.deepEqual(updates[0], { assessment_id: "assessment-999" });
  });
});
