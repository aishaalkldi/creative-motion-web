import type { AssessmentLanguage } from "./assessment-payload";

export const ARABIC_READABILITY_NOTICE =
  "Arabic patient answers are shown as originally submitted. Use 'Generate English Translation' to create an AI-assisted English translation for clinician review. AI-assisted translation — clinician review required.";

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
