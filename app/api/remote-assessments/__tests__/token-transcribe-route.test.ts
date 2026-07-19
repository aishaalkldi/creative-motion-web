/**
 * Run: npx tsx --experimental-test-module-mocks --test app/api/remote-assessments/__tests__/token-transcribe-route.test.ts
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const REMOTE_REQUEST = {
  id: "req-11111111-1111-1111-1111-111111111111",
  patient_id: "pat-22222222-2222-2222-2222-222222222222",
  provider_id: "pro-33333333-3333-3333-3333-333333333333",
  status: "pending",
};

type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

let transcribeResult: TranscribeResult = { ok: true, text: "patient answer" };
let elevenLabsEnabled = true;
let sessionInsertFails = false;
let sessionCompletionUpdateFails = false;
let remoteRequestData: typeof REMOTE_REQUEST | null = REMOTE_REQUEST;
let transcribeCallCount = 0;

function thenableChain<T>(result: T) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    gt: () => chain,
    is: () => chain,
    then: (resolve: (v: T) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function createRouteSupabaseMock() {
  const sessionInserts: unknown[] = [];
  const sessionUpdates: unknown[] = [];

  const client = {
    from: (table: string) => {
      if (table === "remote_assessment_requests") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: async () => ({ data: remoteRequestData, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "speech_transcription_sessions") {
        return {
          insert: (row: unknown) => {
            sessionInserts.push(row);
            return {
              select: () => ({
                single: async () =>
                  sessionInsertFails
                    ? { data: null, error: { message: "insert failed" } }
                    : { data: { id: "sess-route-1" }, error: null },
              }),
            };
          },
          update: (patch: unknown) => {
            sessionUpdates.push(patch);
            const isCompleted = (patch as { status?: string }).status === "completed";
            if (sessionCompletionUpdateFails && isCompleted) {
              return thenableChain({ error: { message: "update failed" } });
            }
            return thenableChain({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, sessionInserts, sessionUpdates };
}

function makeAudioRequest(token: string, ip?: string): NextRequest {
  const blob = new Blob([new Uint8Array(256).fill(1)], { type: "audio/webm" });
  const form = new FormData();
  form.append("audio", blob, "assessment-answer.webm");
  form.append("language", "en");

  return new NextRequest(
    `http://localhost/api/remote-assessments/${encodeURIComponent(token)}/transcribe`,
    {
      method: "POST",
      headers: {
        "x-forwarded-for": ip ?? `10.3.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: form,
    },
  );
}

function resetRouteMockState() {
  remoteRequestData = REMOTE_REQUEST;
  sessionInsertFails = false;
  sessionCompletionUpdateFails = false;
  transcribeCallCount = 0;
  transcribeResult = { ok: true, text: "patient answer" };
}

describe("POST /api/remote-assessments/[token]/transcribe", { concurrency: 1 }, () => {
  let savedElevenFlag: string | undefined;
  let savedElevenKey: string | undefined;
  let POST: typeof import("../[token]/transcribe/route").POST;
  let setServiceRoleClient: typeof import("../[token]/transcribe/route").__setServiceRoleClientForTests;
  let routeMock: ReturnType<typeof createRouteSupabaseMock>;

  before(async () => {
    savedElevenFlag = process.env.ENABLE_ELEVENLABS_STT;
    savedElevenKey = process.env.ELEVENLABS_API_KEY;
    process.env.ENABLE_ELEVENLABS_STT = "true";
    process.env.ELEVENLABS_API_KEY = "test-eleven-key";

    resetRouteMockState();
    routeMock = createRouteSupabaseMock();
    elevenLabsEnabled = true;

    mock.module("@/app/lib/elevenlabs-server", {
      exports: {
        isElevenLabsSttEnabled: () => elevenLabsEnabled,
        isAllowedAssessmentAudioMime: () => true,
        normalizeAssessmentSpeechLanguage: (value: string | null | undefined) =>
          value?.trim().toLowerCase().startsWith("ar") ? "ar" : "en",
        validateAssessmentAudioUpload: () => null,
        transcribeAssessmentAudio: async () => {
          transcribeCallCount += 1;
          return transcribeResult;
        },
      },
    });

    ({ POST, __setServiceRoleClientForTests: setServiceRoleClient } = await import(
      "../[token]/transcribe/route"
    ));
    setServiceRoleClient(routeMock.client);
  });

  after(() => {
    setServiceRoleClient(null);
    mock.restoreAll();
    if (savedElevenFlag === undefined) delete process.env.ENABLE_ELEVENLABS_STT;
    else process.env.ENABLE_ELEVENLABS_STT = savedElevenFlag;
    if (savedElevenKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = savedElevenKey;
  });

  it("returns 404 for an empty token", async () => {
    const res = await POST(makeAudioRequest(""), { params: Promise.resolve({ token: "" }) });
    assert.equal(res.status, 404);
  });

  it("returns 503 when ElevenLabs is disabled", async () => {
    elevenLabsEnabled = false;
    try {
      const res = await POST(makeAudioRequest(crypto.randomUUID()), {
        params: Promise.resolve({ token: crypto.randomUUID() }),
      });
      assert.equal(res.status, 503);
    } finally {
      elevenLabsEnabled = true;
    }
  });

  it("returns transcript and persists session on success", async () => {
    resetRouteMockState();
    routeMock.sessionInserts.length = 0;
    routeMock.sessionUpdates.length = 0;

    const token = crypto.randomUUID();
    const res = await POST(makeAudioRequest(token), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { text: string };
    assert.equal(body.text, "patient answer");
    assert.equal(routeMock.sessionInserts.length, 1);
    assert.equal(routeMock.sessionUpdates.length, 1);
    assert.equal(
      (routeMock.sessionInserts[0] as { remote_request_id: string }).remote_request_id,
      REMOTE_REQUEST.id,
    );
    assert.equal(
      (routeMock.sessionUpdates[0] as { status: string; transcript_text: string }).status,
      "completed",
    );
  });

  it("returns transcript when persistence insert fails (fail-open)", async () => {
    resetRouteMockState();
    sessionInsertFails = true;
    transcribeResult = { ok: true, text: "still returned" };
    routeMock.sessionInserts.length = 0;
    routeMock.sessionUpdates.length = 0;

    const token = crypto.randomUUID();
    const res = await POST(makeAudioRequest(token), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { text: string };
    assert.equal(body.text, "still returned");
    assert.equal(routeMock.sessionUpdates.length, 0);
  });

  it("returns 502 and marks failed when upstream transcription fails", async () => {
    resetRouteMockState();
    transcribeResult = { ok: false, error: "Transcription request failed." };
    routeMock.sessionInserts.length = 0;
    routeMock.sessionUpdates.length = 0;

    const token = crypto.randomUUID();
    const res = await POST(makeAudioRequest(token), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 502);
    const body = (await res.json()) as { fallback?: string };
    assert.equal(body.fallback, "manual");
    assert.equal(routeMock.sessionInserts.length, 1);
    assert.equal((routeMock.sessionUpdates[0] as { status: string }).status, "failed");
  });

  it("returns 200 with transcript when completion persistence fails (fail-open)", async () => {
    resetRouteMockState();
    sessionCompletionUpdateFails = true;
    const transcript = "knee pain when walking upstairs";
    transcribeResult = { ok: true, text: transcript };
    routeMock.sessionInserts.length = 0;
    routeMock.sessionUpdates.length = 0;

    const token = crypto.randomUUID();
    const warnLogs: unknown[][] = [];
    const errorLogs: unknown[][] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args: unknown[]) => {
      warnLogs.push(args);
    };
    console.error = (...args: unknown[]) => {
      errorLogs.push(args);
    };

    try {
      const res = await POST(makeAudioRequest(token), { params: Promise.resolve({ token }) });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { text: string };
      assert.equal(body.text, transcript);
      assert.equal(routeMock.sessionInserts.length, 1);
      assert.equal(routeMock.sessionUpdates.length, 1);
      assert.equal(
        (routeMock.sessionUpdates[0] as { status: string }).status,
        "completed",
      );

      const loggedText = [...warnLogs, ...errorLogs]
        .flat()
        .filter((arg): arg is string => typeof arg === "string")
        .join("\n");
      assert.doesNotMatch(loggedText, /knee pain when walking upstairs/);
      assert.doesNotMatch(loggedText, new RegExp(token));
      assert.doesNotMatch(loggedText, /pat-22222222-2222-2222-2222-222222222222/);
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  it("returns rejection without session insert or ElevenLabs when no eligible request", async () => {
    resetRouteMockState();
    remoteRequestData = null;
    routeMock.sessionInserts.length = 0;
    routeMock.sessionUpdates.length = 0;

    const token = crypto.randomUUID();
    const res = await POST(makeAudioRequest(token), { params: Promise.resolve({ token }) });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid or expired link");
    assert.equal(routeMock.sessionInserts.length, 0);
    assert.equal(routeMock.sessionUpdates.length, 0);
    assert.equal(transcribeCallCount, 0);
  });
});
