import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a cryptographically secure opaque patient-access token.
 * Raw token is returned once to the clinician — never stored or logged.
 */
export function generatePatientAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic SHA-256 hash for DB lookup — raw token is never persisted. */
export function hashPatientAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
