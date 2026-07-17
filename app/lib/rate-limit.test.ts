/**
 * Run: npx tsx --test app/lib/rate-limit.test.ts
 *
 * consumeRateLimit() uses a module-level in-memory Map keyed by the string
 * passed in. Tests use crypto.randomUUID()-derived keys (via unique tokens)
 * so buckets never collide across test cases within this process.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  REMOTE_ASSESSMENT_RATE_LIMIT,
  checkRemoteAssessmentLimit,
  consumeRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "./rate-limit";

function reqWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/test", { headers });
}

describe("getClientIp", () => {
  it("uses the first entry of x-forwarded-for", () => {
    const req = reqWithHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = reqWithHeaders({ "x-real-ip": "9.9.9.9" });
    assert.equal(getClientIp(req), "9.9.9.9");
  });

  it("falls back to \"unknown\" when neither header is present", () => {
    const req = reqWithHeaders({});
    assert.equal(getClientIp(req), "unknown");
  });
});

describe("consumeRateLimit", () => {
  it("allows requests up to the configured max", () => {
    const key = `test:${crypto.randomUUID()}`;
    const config = { max: 3, windowMs: 60_000 };
    assert.equal(consumeRateLimit(key, config).allowed, true);
    assert.equal(consumeRateLimit(key, config).allowed, true);
    assert.equal(consumeRateLimit(key, config).allowed, true);
  });

  it("rejects the request that exceeds the configured max", () => {
    const key = `test:${crypto.randomUUID()}`;
    const config = { max: 2, windowMs: 60_000 };
    assert.equal(consumeRateLimit(key, config).allowed, true);
    assert.equal(consumeRateLimit(key, config).allowed, true);
    const third = consumeRateLimit(key, config);
    assert.equal(third.allowed, false);
    if (!third.allowed) assert.ok(third.retryAfterSec > 0);
  });

  it("tracks independent buckets per key", () => {
    const config = { max: 1, windowMs: 60_000 };
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;
    assert.equal(consumeRateLimit(keyA, config).allowed, true);
    // keyA is now exhausted, but keyB is untouched and independent.
    assert.equal(consumeRateLimit(keyA, config).allowed, false);
    assert.equal(consumeRateLimit(keyB, config).allowed, true);
  });
});

describe("checkRemoteAssessmentLimit", () => {
  it(`allows exactly ${REMOTE_ASSESSMENT_RATE_LIMIT.max} requests then rejects the next`, () => {
    const token = crypto.randomUUID();
    const req = reqWithHeaders({ "x-forwarded-for": "10.0.0.1" });

    for (let i = 0; i < REMOTE_ASSESSMENT_RATE_LIMIT.max; i++) {
      const result = checkRemoteAssessmentLimit(req, token, "submit");
      assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
    }

    const overLimit = checkRemoteAssessmentLimit(req, token, "submit");
    assert.equal(overLimit.allowed, false);
    if (!overLimit.allowed) assert.ok(overLimit.retryAfterSec > 0);
  });

  it("buckets independently per route label for the same token/IP", () => {
    const token = crypto.randomUUID();
    const req = reqWithHeaders({ "x-forwarded-for": "10.0.0.2" });

    for (let i = 0; i < REMOTE_ASSESSMENT_RATE_LIMIT.max; i++) {
      checkRemoteAssessmentLimit(req, token, "get");
    }
    // "get" bucket is now exhausted for this token/IP; "submit" is a
    // separate bucket and should still be fresh.
    assert.equal(checkRemoteAssessmentLimit(req, token, "get").allowed, false);
    assert.equal(checkRemoteAssessmentLimit(req, token, "submit").allowed, true);
  });

  it("buckets independently per token for the same IP/route", () => {
    const req = reqWithHeaders({ "x-forwarded-for": "10.0.0.3" });
    const tokenA = crypto.randomUUID();
    const tokenB = crypto.randomUUID();

    for (let i = 0; i < REMOTE_ASSESSMENT_RATE_LIMIT.max; i++) {
      checkRemoteAssessmentLimit(req, tokenA, "submit-bucket-test");
    }
    assert.equal(checkRemoteAssessmentLimit(req, tokenA, "submit-bucket-test").allowed, false);
    assert.equal(checkRemoteAssessmentLimit(req, tokenB, "submit-bucket-test").allowed, true);
  });
});

describe("rateLimitExceededResponse", () => {
  it("returns a 429 with a Retry-After header when a value is given", async () => {
    const res = rateLimitExceededResponse(42);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "42");
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Too many requests. Please try again later.");
  });

  it("omits the Retry-After header when no value is given", () => {
    const res = rateLimitExceededResponse();
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), null);
  });
});
