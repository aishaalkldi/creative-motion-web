/**
 * In-memory sliding-window rate limiter for MVP public endpoints.
 * Resets on server restart; suitable for single-instance / controlled pilot.
 * Not distributed — use Redis/Upstash before multi-region scale.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type RateLimitConfig = {
  /** Maximum requests allowed within the window */
  max: number;
  /** Window length in milliseconds (default 60_000) */
  windowMs?: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;

/** General patient portal API traffic per IP */
export const PATIENT_RATE_LIMIT_GENERAL: RateLimitConfig = {
  max: 30,
  windowMs: DEFAULT_WINDOW_MS,
};

/** Failed token lookups per IP (invalid / inactive / expired validation) */
export const PATIENT_RATE_LIMIT_FAILED: RateLimitConfig = {
  max: 10,
  windowMs: DEFAULT_WINDOW_MS,
};

/**
 * Extract client IP from proxy headers (Vercel, nginx, local dev).
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Consume one request against the named bucket.
 * Returns whether the request is within the limit.
 */
export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > config.max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

/**
 * Check general patient endpoint limit. Call at the start of each handler.
 */
export function checkPatientGeneralLimit(req: NextRequest, route: string): RateLimitResult {
  const ip = getClientIp(req);
  return consumeRateLimit(`patient:${route}:${ip}`, PATIENT_RATE_LIMIT_GENERAL);
}

/**
 * Check + consume failed token validation limit.
 * Call only when a token lookup fails (invalid / inactive / expired).
 */
export function checkPatientFailedTokenLimit(req: NextRequest): RateLimitResult {
  const ip = getClientIp(req);
  return consumeRateLimit(`patient:failed:${ip}`, PATIENT_RATE_LIMIT_FAILED);
}

/**
 * Apply failed-token bucket before returning invalid/inactive/expired.
 * Returns 429 when exceeded; otherwise null so the handler can respond normally.
 */
export function enforceFailedTokenRateLimit(req: NextRequest): NextResponse | null {
  const result = checkPatientFailedTokenLimit(req);
  if (!result.allowed) {
    return rateLimitExceededResponse(result.retryAfterSec);
  }
  return null;
}

/** Standard 429 response — no token or internal details. */
export function rateLimitExceededResponse(retryAfterSec?: number): NextResponse {
  const headers: Record<string, string> = {};
  if (retryAfterSec !== undefined) {
    headers["Retry-After"] = String(retryAfterSec);
  }
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers },
  );
}
