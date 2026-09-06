/**
 * Patient Arabic → English clinical translation helpers (client-safe).
 */

export const NON_TRANSLATABLE_FIELD_KEYS = new Set(["painScore"]);

export function isTranslatablePatientFieldKey(fieldKey: string | undefined): boolean {
  return !!fieldKey && !NON_TRANSLATABLE_FIELD_KEYS.has(fieldKey);
}

export function readStoredClinicalTranslation(
  submissionMeta: Record<string, unknown> | null | undefined,
  fieldKey: string,
): string {
  if (!isTranslatablePatientFieldKey(fieldKey)) return "";
  const value = submissionMeta?.[`${fieldKey}_en`];
  return typeof value === "string" ? value.trim() : "";
}

export function readAiClinicalTranslation(
  submissionMeta: Record<string, unknown> | null | undefined,
  fieldKey: string,
): string {
  if (!isTranslatablePatientFieldKey(fieldKey)) return "";
  const aiValue = submissionMeta?.[`${fieldKey}_en_ai`];
  if (typeof aiValue === "string" && aiValue.trim()) return aiValue.trim();
  return readStoredClinicalTranslation(submissionMeta, fieldKey);
}

export function hasPersistedClinicalEnglish(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  return Object.keys(extractTranslationMeta(meta).translations).length > 0;
}

export function extractTranslationMeta(meta: Record<string, unknown> | null | undefined): {
  translations: Record<string, string>;
  aiTranslations: Record<string, string>;
  generatedAt: Record<string, string>;
  editedAt: Record<string, string>;
} {
  const translations: Record<string, string> = {};
  const aiTranslations: Record<string, string> = {};
  const generatedAt: Record<string, string> = {};
  const editedAt: Record<string, string> = {};
  if (!meta) return { translations, aiTranslations, generatedAt, editedAt };

  for (const [key, value] of Object.entries(meta)) {
    if (!key.endsWith("_en") || key.endsWith("_en_generated_at") || key.endsWith("_en_reviewed")) {
      continue;
    }
    if (key.endsWith("_en_ai") || key.endsWith("_en_edited_at")) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    translations[key] = value.trim();
    const baseKey = key.replace(/_en$/, "");
    const atValue = meta[`${baseKey}_en_generated_at`];
    if (typeof atValue === "string" && atValue.trim()) {
      generatedAt[baseKey] = atValue.trim();
    }
    const editedValue = meta[`${baseKey}_en_edited_at`];
    if (typeof editedValue === "string" && editedValue.trim()) {
      editedAt[baseKey] = editedValue.trim();
    }
    const aiValue = meta[`${baseKey}_en_ai`];
    if (typeof aiValue === "string" && aiValue.trim()) {
      aiTranslations[`${baseKey}_en_ai`] = aiValue.trim();
    }
  }
  return { translations, aiTranslations, generatedAt, editedAt };
}

export function applyClinicalEnglishFieldEdit(
  structuredData: Record<string, unknown>,
  fieldKey: string,
  clinicalEnglish: string,
): Record<string, unknown> {
  const next = { ...structuredData };
  const trimmed = clinicalEnglish.trim();
  const existing = readStoredClinicalTranslation(next, fieldKey);
  if (existing && !next[`${fieldKey}_en_ai`]) {
    next[`${fieldKey}_en_ai`] = existing;
  }
  next[`${fieldKey}_en`] = trimmed;
  next[`${fieldKey}_en_edited_at`] = new Date().toISOString();
  next[`${fieldKey}_en_reviewed`] = false;
  return next;
}
