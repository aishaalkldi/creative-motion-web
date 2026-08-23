import type { NextRequest } from "next/server";
import { VOLUNTEER_REPETITION_MAX_JSON_BYTES } from "./volunteer-repetition-validation";

export type ReadVolunteerRepetitionBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 413 | 400 };

function isContentLengthOverLimit(contentLengthHeader: string | null, maxBytes: number): boolean {
  if (!contentLengthHeader) return false;
  const n = Number(contentLengthHeader);
  if (!Number.isFinite(n) || n < 0) return false;
  return n > maxBytes;
}

/**
 * Read and parse a volunteer repetition JSON body with a hard byte ceiling.
 * Rejects before buffering unbounded payloads when Content-Length is trustworthy,
 * and aborts stream reads once the limit is exceeded.
 */
export async function readVolunteerRepetitionJsonBody(
  req: NextRequest,
  maxBytes: number = VOLUNTEER_REPETITION_MAX_JSON_BYTES,
): Promise<ReadVolunteerRepetitionBodyResult> {
  if (isContentLengthOverLimit(req.headers.get("content-length"), maxBytes)) {
    return { ok: false, status: 413 };
  }

  if (!req.body) {
    return { ok: false, status: 400 };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    return { ok: false, status: 400 };
  }

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
