/**
 * Client-side Arabic → English fallback when OpenAI translate API is unavailable.
 * Uses public MyMemory tier — assistive only; therapist must verify with patient.
 */

import { translateArabicToEnglish } from "@/app/clinician/assessment/voice-clinical-assistant";

export const OFFLINE_TRANSLATION_NOTE =
  "[Offline translation — verify meaning with the patient before clinical use.]";

export async function translateArabicToEnglishClinical(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const translated = await translateArabicToEnglish(trimmed);
  if (!translated?.trim()) return null;

  return `${translated.trim()}\n\n${OFFLINE_TRANSLATION_NOTE}`;
}
