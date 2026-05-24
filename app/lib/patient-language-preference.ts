import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

export function patientLanguageStorageKey(token: string): string {
  return `rasq_patient_language_${token}`;
}

export function readStoredPatientLanguage(token: string): PatientExerciseLanguage | null {
  if (typeof window === "undefined" || !token) return null;
  try {
    const value = localStorage.getItem(patientLanguageStorageKey(token));
    if (value === "ar" || value === "en") return value;
  } catch {
    /* localStorage unavailable */
  }
  return null;
}

export function writeStoredPatientLanguage(
  token: string,
  language: PatientExerciseLanguage,
): void {
  if (!token) return;
  try {
    localStorage.setItem(patientLanguageStorageKey(token), language);
  } catch {
    /* localStorage unavailable */
  }
}

export function normalizeApiPatientLanguage(
  value: string | null | undefined,
): PatientExerciseLanguage {
  return value === "ar" ? "ar" : "en";
}
