import type { AssessmentLanguage } from "./assessment-payload";

export const ARABIC_READABILITY_NOTICE =
  "Patient answered in Arabic. Structured fields are shown with English labels. Free-text notes are shown as submitted. AI-assisted translation will be available in a future update.";

export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
}

export function valueTextDirection(text: string): "rtl" | "ltr" {
  return containsArabic(text) ? "rtl" : "ltr";
}

export function isArabicAssessmentContent(
  assessmentLanguage: AssessmentLanguage | null | undefined,
  values: string[],
): boolean {
  if (assessmentLanguage === "ar") return true;
  return values.some((value) => value.trim().length > 0 && containsArabic(value));
}
