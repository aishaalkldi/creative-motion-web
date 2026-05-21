import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure patient portal access token.
 * 32 bytes entropy, base64url-encoded (URL-safe, no padding).
 */
export function generateSecurePatientToken(): string {
  return randomBytes(32).toString("base64url");
}
