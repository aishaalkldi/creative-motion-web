/**
 * Server-safe parser for stored chief-complaint AI extraction payloads.
 * No React, browser APIs, or "use client" — safe for API routes and lib code.
 */

export type StructuredExtraction = {
  body_region: string;
  side: string;
  primary_symptom: string;
  aggravating_factor: string | null;
  language: string;
  confidence: number;
};

/**
 * Reads exactly the six whitelisted fields from an untrusted value. Any
 * other key present on the input (diagnosis, treatment_recommendation, or
 * anything unrecognized) is never read and never forwarded to the caller.
 */
export function parseStoredExtraction(value: unknown): StructuredExtraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  const { body_region, side, primary_symptom, aggravating_factor, language, confidence } = record;

  if (typeof body_region !== "string" || !body_region.trim()) return null;
  if (typeof side !== "string" || !side.trim()) return null;
  if (typeof primary_symptom !== "string" || !primary_symptom.trim()) return null;
  if (aggravating_factor !== null && typeof aggravating_factor !== "string") return null;
  if (typeof language !== "string" || !language.trim()) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return null;

  return {
    body_region,
    side,
    primary_symptom,
    aggravating_factor,
    language,
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}
