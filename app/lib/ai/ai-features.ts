function envEnabled(name: string): boolean {
  return process.env[name] === "true";
}

export const AI_TRANSLATION_SETUP_NOTICE =
  "AI English translation is currently under setup. Original Arabic answers are available for clinician review.";

/** Central AI feature flags — all default off unless explicitly enabled. */
export const AI_FEATURES = {
  translation: envEnabled("NEXT_PUBLIC_ENABLE_AI_TRANSLATION"),
  voiceWhisper: envEnabled("NEXT_PUBLIC_ENABLE_AI_VOICE_WHISPER"),
  clinicalSummary: envEnabled("NEXT_PUBLIC_ENABLE_AI_CLINICAL_SUMMARY"),
  soapDraft: envEnabled("NEXT_PUBLIC_ENABLE_AI_SOAP_DRAFT"),
  coPilot: envEnabled("NEXT_PUBLIC_ENABLE_AI_COPILOT"),
} as const;

export type AiFeatureKey = keyof typeof AI_FEATURES;

export function isAiFeatureEnabled(feature: AiFeatureKey): boolean {
  return AI_FEATURES[feature];
}

export function isAiTranslationEnabled(): boolean {
  return AI_FEATURES.translation;
}
