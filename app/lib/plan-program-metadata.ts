/**
 * Program-level metadata stored in treatment_plans.structured_data (jsonb).
 * No schema migration — extends existing structured_data shape.
 */

import type { AssessmentLanguage } from "@/app/lib/assessment-payload";

export type PlanProgramMetadata = {
  programTemplateId?: string;
  programGoal?: string;
  patientFriendlyGoal?: string;
  expectedResponse?: string;
  reviewCriteria?: string;
  safetyNotes?: string;
};

/** Arabic patient-friendly goals keyed by pilot template id (static, not AI). */
const PATIENT_FRIENDLY_GOAL_AR: Record<string, string> = {
  "knee-rehab-beginner":
    "بناء قوة وثقة في ركبتك للجلوس والوقوف والمشي.",
  "low-back-beginner":
    "تحريك ظهرك براحة أكبر واستعادة الثقة في أنشطتك اليومية.",
  "shoulder-mobility-beginner":
    "تخفيف تيبّس الكتف والتحرك براحة أكبر للوصول والمهام اليومية.",
  "sports-knee-foundation":
    "بناء قوة الركبة وثقة الحركة للأنشطة اليومية والاستعداد للتدريب. معالجك يراجع تقدّمك — هذه الخطة لا تُخوّلك للعودة للرياضة.",
};

const GENERIC_REHAB_FOCUS_EN =
  "Follow your plan exercises to safely return to your daily activities.";
const GENERIC_REHAB_FOCUS_AR =
  "اتبع تمارين خطتك للعودة تدريجياً إلى نشاطك اليومي بأمان.";

export function extractPlanProgramMetadata(
  structuredData: unknown,
): PlanProgramMetadata {
  if (!structuredData || typeof structuredData !== "object") return {};
  const sd = structuredData as Record<string, unknown>;
  const pick = (key: keyof PlanProgramMetadata): string | undefined => {
    const v = sd[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return {
    programTemplateId: pick("programTemplateId") ?? pickProgramTemplateIdFromLegacy(sd),
    programGoal: pick("programGoal"),
    patientFriendlyGoal: pick("patientFriendlyGoal"),
    expectedResponse: pick("expectedResponse"),
    reviewCriteria: pick("reviewCriteria"),
    safetyNotes: pick("safetyNotes"),
  };
}

/** Pilot templates before Sprint 10 stored template id in programId. */
function pickProgramTemplateIdFromLegacy(
  sd: Record<string, unknown>,
): string | undefined {
  const programId = sd.programId;
  if (typeof programId !== "string" || !programId.trim()) return undefined;
  const id = programId.trim();
  if (id === "custom" || id.startsWith("phase-")) return undefined;
  return id;
}

export function buildPlanProgramMetadata(input: {
  programTemplateId?: string;
  programGoal?: string;
  patientFriendlyGoal?: string;
  expectedResponse?: string;
  reviewCriteria?: string;
  safetyNotes?: string;
}): PlanProgramMetadata {
  const meta: PlanProgramMetadata = {};
  if (input.programTemplateId?.trim()) {
    meta.programTemplateId = input.programTemplateId.trim();
  }
  if (input.programGoal?.trim()) meta.programGoal = input.programGoal.trim();
  if (input.patientFriendlyGoal?.trim()) {
    meta.patientFriendlyGoal = input.patientFriendlyGoal.trim();
  }
  if (input.expectedResponse?.trim()) {
    meta.expectedResponse = input.expectedResponse.trim();
  }
  if (input.reviewCriteria?.trim()) {
    meta.reviewCriteria = input.reviewCriteria.trim();
  }
  if (input.safetyNotes?.trim()) meta.safetyNotes = input.safetyNotes.trim();
  return meta;
}

/**
 * Patient-facing rehab focus for plan home.
 * English: patientFriendlyGoal → programGoal → phaseGoal → generic.
 * Arabic: template Arabic map → generic (does not auto-translate clinician text).
 */
export function resolvePatientRehabFocus(
  structuredData: unknown,
  phaseGoal: string | undefined | null,
  language: AssessmentLanguage,
): string {
  const meta = extractPlanProgramMetadata(structuredData);
  const templateId = meta.programTemplateId;

  if (language === "ar") {
    if (templateId && PATIENT_FRIENDLY_GOAL_AR[templateId]) {
      return PATIENT_FRIENDLY_GOAL_AR[templateId];
    }
    return GENERIC_REHAB_FOCUS_AR;
  }

  return (
    meta.patientFriendlyGoal ??
    meta.programGoal ??
    (phaseGoal?.trim() || undefined) ??
    GENERIC_REHAB_FOCUS_EN
  );
}
