/**
 * Patient assessment copy — bilingual config for patient link; English only on clinician UI.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "./api/remote-assessments";

export type LocalizedText = { en: string; ar: string };

/** Clinician-facing pages always use English. */
export function clinicianText(text: LocalizedText): string {
  return text.en;
}

export const PATIENT_SECTION_TITLES: Record<PatientSectionId, LocalizedText> = {
  pain:       { en: "Pain & Symptoms",       ar: "الألم والأعراض" },
  rom:        { en: "Movement Range",        ar: "مدى الحركة" },
  strength:   { en: "Strength & Activity",   ar: "القوة والنشاط" },
  balance:    { en: "Balance",               ar: "التوازن" },
  gait:       { en: "Walking & Gait",        ar: "المشي والخطوة" },
  functional: { en: "Daily Activities",      ar: "الأنشطة اليومية" },
};

/** English labels for patient portal (Arabic via .ar when patient locale is enabled). */
export const PATIENT_SECTION_LABELS_EN: Record<PatientSectionId, string> = Object.fromEntries(
  (Object.entries(PATIENT_SECTION_TITLES) as [PatientSectionId, LocalizedText][]).map(
    ([id, t]) => [id, t.en],
  ),
) as Record<PatientSectionId, string>;

type FieldKey =
  | "chiefComplaint" | "painLocation" | "painScore" | "aggravating" | "easing" | "dailyImpact" | "goals"
  | "limitations" | "worseWith"
  | "weaknessDescription" | "activitiesAffected"
  | "difficultyDescription" | "fallHistory"
  | "walkingDescription" | "aids"
  | "standingDuration" | "walkingDistance" | "stairsAbility" | "otherNotes";

const FIELD_LABELS: Record<FieldKey, LocalizedText> = {
  chiefComplaint:        { en: "Main complaint",         ar: "الشكوى الرئيسية" },
  painLocation:          { en: "Pain location",          ar: "موقع الألم" },
  painScore:             { en: "Pain score",             ar: "درجة الألم" },
  aggravating:           { en: "Makes it worse",         ar: "ما يزيد الألم" },
  easing:                { en: "Provides relief",        ar: "ما يخفف الألم" },
  dailyImpact:           { en: "Daily impact",           ar: "التأثير اليومي" },
  goals:                 { en: "Goals",                  ar: "الأهداف" },
  limitations:           { en: "Movement limitations", ar: "قيود الحركة" },
  worseWith:             { en: "Worsened by",            ar: "يزداد مع" },
  weaknessDescription:   { en: "Weakness",               ar: "الضعف" },
  activitiesAffected:    { en: "Affected activities",    ar: "الأنشطة المتأثرة" },
  difficultyDescription: { en: "Balance difficulty",     ar: "صعوبة التوازن" },
  fallHistory:           { en: "Fall history",           ar: "تاريخ السقوط" },
  walkingDescription:    { en: "Walking pattern",        ar: "نمط المشي" },
  aids:                  { en: "Walking aids",           ar: "وسائل المساعدة" },
  standingDuration:      { en: "Standing tolerance",     ar: "تحمل الوقوف" },
  walkingDistance:       { en: "Walking distance",       ar: "مسافة المشي" },
  stairsAbility:         { en: "Stairs",                 ar: "السلالم" },
  otherNotes:            { en: "Additional notes",       ar: "ملاحظات إضافية" },
};

export type PatientReviewEntry = { label: string; value: string };

function push(
  entries: PatientReviewEntry[],
  key: FieldKey,
  value: string | undefined,
  format?: (v: string) => string,
): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  entries.push({
    label: clinicianText(FIELD_LABELS[key]),
    value: format ? format(trimmed) : trimmed,
  });
}

/** Flatten patient draft into English clinician review rows. */
export function buildClinicianReviewEntries(
  section: PatientSectionId,
  draft: PatientAssessmentDraft,
): PatientReviewEntry[] {
  const entries: PatientReviewEntry[] = [];

  switch (section) {
    case "pain":
      if (draft.pain) {
        push(entries, "chiefComplaint", draft.pain.chiefComplaint);
        push(entries, "painLocation", draft.pain.painLocation);
        push(entries, "painScore", draft.pain.painScore, (v) => `${v} / 10`);
        push(entries, "aggravating", draft.pain.aggravating);
        push(entries, "easing", draft.pain.easing);
        push(entries, "dailyImpact", draft.pain.dailyImpact);
        push(entries, "goals", draft.pain.goals);
      }
      break;
    case "rom":
      if (draft.rom) {
        push(entries, "limitations", draft.rom.limitations);
        push(entries, "worseWith", draft.rom.worseWith);
      }
      break;
    case "strength":
      if (draft.strength) {
        push(entries, "weaknessDescription", draft.strength.weaknessDescription);
        push(entries, "activitiesAffected", draft.strength.activitiesAffected);
      }
      break;
    case "balance":
      if (draft.balance) {
        push(entries, "difficultyDescription", draft.balance.difficultyDescription);
        push(entries, "fallHistory", draft.balance.fallHistory);
      }
      break;
    case "gait":
      if (draft.gait) {
        push(entries, "walkingDescription", draft.gait.walkingDescription);
        push(entries, "aids", draft.gait.aids);
      }
      break;
    case "functional":
      if (draft.functional) {
        push(entries, "standingDuration", draft.functional.standingDuration);
        push(entries, "walkingDistance", draft.functional.walkingDistance);
        push(entries, "stairsAbility", draft.functional.stairsAbility);
        push(entries, "otherNotes", draft.functional.otherNotes);
      }
      break;
  }

  return entries;
}

/** All sections with answers for clinician review panel. */
export function buildFullClinicianReview(
  draft: PatientAssessmentDraft | undefined,
  includedSections: PatientSectionId[],
): { section: PatientSectionId; sectionTitle: string; entries: PatientReviewEntry[] }[] {
  if (!draft) return [];
  return includedSections
    .map((section) => ({
      section,
      sectionTitle: clinicianText(PATIENT_SECTION_TITLES[section]),
      entries: buildClinicianReviewEntries(section, draft),
    }))
    .filter((block) => block.entries.length > 0);
}
