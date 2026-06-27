import type { AssessmentLanguage } from "./assessment-payload";

export const ARABIC_READABILITY_NOTICE =
  "Arabic patient answers are shown as originally submitted. Clinical English translations are generated automatically for clinician review when available. AI-assisted translation — verify meaning with the patient before clinical use.";

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
