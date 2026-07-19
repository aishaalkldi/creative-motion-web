/**
 * Run: npx tsx --test app/api/remote-assessments/__tests__/token-submit-backfill-route.test.ts
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  POST,
  __setServiceRoleClientForTests,
} from "../[token]/submit/route";

function makeRequest(body: unknown): NextRequest {
  const bodyText = JSON.stringify(body);
  return new NextRequest("http://localhost/api/remote-assessments/x/submit", {
    method: "POST",
    headers: {
      "content-length": String(Buffer.byteLength(bodyText)),
      "x-forwarded-for": `10.4.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
    body: bodyText,
  });
}

function paramsFor(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("POST /api/remote-assessments/[token]/submit — assessment backfill", { concurrency: 1 }, () => {
  let backfillUpdates: unknown[] = [];
  let backfillFails = false;

  function thenableChain<T>(result: T) {
    const chain: Record<string, unknown> = {
      eq: () => chain,
      is: () => chain,
      then: (resolve: (v: T) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  }

  before(() => {
    const requestRow = {
      id: "req-11111111-1111-1111-1111-111111111111",
      patient_id: "pat-22222222-2222-2222-2222-222222222222",
      provider_id: "pro-33333333-3333-3333-3333-333333333333",
      status: "pending",
      assessment_id: null,
      submitted_at: null,
    };

    const client = {
      from: (table: string) => {
        if (table === "remote_assessment_requests") {
          return {
            select: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: async () => ({ data: requestRow, error: null }),
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === "assessments") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: "assessment-999", created_at: new Date().toISOString() },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "speech_transcription_sessions") {
          return {
            update: (patch: unknown) => {
              backfillUpdates.push(patch);
              return thenableChain(
                backfillFails ? { error: { message: "backfill failed" } } : { error: null },
              );
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    __setServiceRoleClientForTests(client);
  });

  after(() => {
    __setServiceRoleClientForTests(null);
  });

  it("backfills assessment_id on successful submit", async () => {
    backfillUpdates = [];
    backfillFails = false;

    const token = crypto.randomUUID();
    const req = makeRequest({ structuredData: { pain: { chiefComplaint: "test" } } });
    const res = await POST(req, paramsFor(token));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { assessmentId: string };
    assert.equal(body.assessmentId, "assessment-999");
    assert.equal(backfillUpdates.length, 1);
    assert.deepEqual(backfillUpdates[0], { assessment_id: "assessment-999" });
  });

  it("still succeeds when assessment_id backfill fails", async () => {
    backfillUpdates = [];
    backfillFails = true;

    const token = crypto.randomUUID();
    const req = makeRequest({ structuredData: { pain: { chiefComplaint: "test" } } });
    const res = await POST(req, paramsFor(token));
    assert.equal(res.status, 200);
    assert.equal(backfillUpdates.length, 1);
  });
});
