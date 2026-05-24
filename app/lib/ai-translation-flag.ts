export const AI_TRANSLATION_SETUP_NOTICE =
  "AI English translation is currently under setup. Original Arabic answers are available for clinician review.";

export function isAiTranslationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AI_TRANSLATION === "true";
}
