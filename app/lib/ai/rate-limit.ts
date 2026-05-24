const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 20;

const callTimestampsByProvider = new Map<string, number[]>();

/** Pilot-scale in-memory rate limit — per provider, 20 AI calls per minute. */
export function checkAiRateLimit(providerId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = (callTimestampsByProvider.get(providerId) ?? []).filter((t) => t > windowStart);

  if (recent.length >= MAX_CALLS_PER_WINDOW) {
    const oldestInWindow = recent[0] ?? now;
    return {
      allowed: false,
      retryAfterMs: Math.max(0, oldestInWindow + WINDOW_MS - now),
    };
  }

  recent.push(now);
  callTimestampsByProvider.set(providerId, recent);
  return { allowed: true, retryAfterMs: 0 };
}
