export const AI_TRANSLATION_SETUP_NOTICE =
  "AI English translation is currently under setup. Original Arabic answers are available for clinician review.";

/**
 * Central AI feature flags — all default off unless explicitly enabled.
 *
 * Each NEXT_PUBLIC_* variable is read via a literal, static
 * `process.env.NEXT_PUBLIC_...` expression — required for Next.js to inline
 * its value into the client bundle at build time. A dynamic/computed lookup
 * such as `process.env[name]` is NOT statically analyzable and silently
 * evaluates to `undefined` in the browser regardless of the real .env value,
 * which previously kept every flag permanently "off" on the client.
 */
export const AI_FEATURES = {
  translation: process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION === "true",
  voiceWhisper: process.env.NEXT_PUBLIC_ENABLE_AI_VOICE_WHISPER === "true",
  clinicalSummary: process.env.NEXT_PUBLIC_ENABLE_AI_CLINICAL_SUMMARY === "true",
  soapDraft: process.env.NEXT_PUBLIC_ENABLE_AI_SOAP_DRAFT === "true",
  coPilot: process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT === "true",
} as const;

export type AiFeatureKey = keyof typeof AI_FEATURES;

export function isAiFeatureEnabled(feature: AiFeatureKey): boolean {
  return AI_FEATURES[feature];
}

export function isAiTranslationEnabled(): boolean {
  return AI_FEATURES.translation;
}
