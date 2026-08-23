/**
 * Run: npx tsx --test app/lib/research/volunteer-repetition-request.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { readVolunteerRepetitionJsonBody } from "./volunteer-repetition-request";
import { VOLUNTEER_REPETITION_MAX_JSON_BYTES } from "./volunteer-repetition-validation";

function streamRequest(
  bytes: Uint8Array,
  headers: Record<string, string> = {},
): NextRequest {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new NextRequest("http://localhost/api/research/volunteer/repetitions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: stream,
    duplex: "half",
  } as RequestInit);
}

describe("readVolunteerRepetitionJsonBody", () => {
  it("rejects when Content-Length exceeds the cap before reading", async () => {
    const req = streamRequest(new Uint8Array([123, 125]), {
      "content-length": String(VOLUNTEER_REPETITION_MAX_JSON_BYTES + 1),
    });
    const result = await readVolunteerRepetitionJsonBody(req);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 413);
  });

  it("rejects oversized body when Content-Length is absent", async () => {
    const oversized = Buffer.alloc(VOLUNTEER_REPETITION_MAX_JSON_BYTES + 1, 0x41);
    const req = streamRequest(oversized);
    const result = await readVolunteerRepetitionJsonBody(req);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 413);
  });

  it("rejects oversized body when Content-Length is misleadingly small", async () => {
    const oversized = Buffer.alloc(VOLUNTEER_REPETITION_MAX_JSON_BYTES + 64, 0x42);
    const req = streamRequest(oversized, { "content-length": "16" });
    const result = await readVolunteerRepetitionJsonBody(req);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 413);
  });

  it("accepts valid JSON without Content-Length", async () => {
    const text = JSON.stringify({ ok: true });
    const req = streamRequest(Buffer.from(text, "utf8"));
    const result = await readVolunteerRepetitionJsonBody(req);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.body, { ok: true });
  });

  it("returns 400 for malformed JSON", async () => {
    const req = streamRequest(Buffer.from("{not-json", "utf8"));
    const result = await readVolunteerRepetitionJsonBody(req);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  it("returns 400 for empty body", async () => {
    const req = streamRequest(new Uint8Array());
    const result = await readVolunteerRepetitionJsonBody(req);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });
});
