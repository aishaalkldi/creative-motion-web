/**
 * PR119 — Patient Arabic → English clinical translation helpers (client-safe).
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

export function extractTranslationMeta(meta: Record<string, unknown> | null | undefined): {
  translations: Record<string, string>;
  generatedAt: Record<string, string>;
} {
  const translations: Record<string, string> = {};
  const generatedAt: Record<string, string> = {};
  if (!meta) return { translations, generatedAt };

  for (const [key, value] of Object.entries(meta)) {
    if (!key.endsWith("_en") || key.endsWith("_en_generated_at") || key.endsWith("_en_reviewed")) {
      continue;
    }
    if (typeof value !== "string" || !value.trim()) continue;
    translations[key] = value.trim();
    const baseKey = key.replace(/_en$/, "");
    const atValue = meta[`${baseKey}_en_generated_at`];
    if (typeof atValue === "string" && atValue.trim()) {
      generatedAt[baseKey] = atValue.trim();
    }
  }
  return { translations, generatedAt };
}
