import type { PatientPlanData, PatientSession } from "@/app/api/patient/plan/route";
import { resolveCatalogSessionDisplay } from "@/app/lib/interactive-shoulder/resolve-catalog-session-display";
import type { ProgramSessionEstimatedDurationMinutes } from "@/app/lib/rehab-programs/rehab-program-types";
import {
  formatSessionDisplayTitle,
  type PatientPortalLanguage,
} from "@/app/lib/patient-portal-ui";

/** Known catalog / template program titles for Arabic home display (presentation only). */
const PATIENT_HOME_PROGRAM_TITLE_AR: Record<string, string> = {
  "stroke-upper-limb-recovery-foundation-v1": "أساسيات تعافي الطرف العلوي",
  "knee-rehab-beginner": "تأهيل الركبة — المستوى المبتدئ",
  "low-back-beginner": "تأهيل أسفل الظهر — المستوى المبتدئ",
  "shoulder-mobility-beginner": "مرونة الكتف — المستوى المبتدئ",
  "sports-knee-foundation": "أساسيات ركبة الرياضيين",
};

export type PatientHomeSessionDisplay = {
  title: string;
  context: string | null;
  durationLabel: string | null;
};

export function resolvePatientHomeProgramTitle(
  plan: PatientPlanData,
  lang: PatientPortalLanguage,
): string {
  if (lang !== "ar") {
    return plan.planTitle?.trim() || plan.programName?.trim() || "";
  }

  const templateId = plan.programTemplateId?.trim();
  if (templateId && PATIENT_HOME_PROGRAM_TITLE_AR[templateId]) {
    return PATIENT_HOME_PROGRAM_TITLE_AR[templateId]!;
  }

  const catalogProgramId = plan.sessions.find((session) => session.catalogSession)?.catalogSession
    ?.programId;
  if (catalogProgramId && PATIENT_HOME_PROGRAM_TITLE_AR[catalogProgramId]) {
    return PATIENT_HOME_PROGRAM_TITLE_AR[catalogProgramId]!;
  }

  const rehabFocus = plan.patientRehabFocus?.trim();
  if (rehabFocus) return rehabFocus;

  return plan.planTitle?.trim() || plan.programName?.trim() || "";
}

export function formatPatientSessionDurationLabel(
  duration: ProgramSessionEstimatedDurationMinutes,
  lang: PatientPortalLanguage,
): string {
  if (duration.min === duration.max) {
    return lang === "ar" ? `${duration.min} دقيقة` : `${duration.min} min`;
  }
  return lang === "ar"
    ? `${duration.min}–${duration.max} دقيقة`
    : `${duration.min}–${duration.max} min`;
}

export function resolvePatientHomeSessionDisplay(
  session: PatientSession,
  plan: PatientPlanData,
  lang: PatientPortalLanguage,
): PatientHomeSessionDisplay {
  const catalog = session.catalogSession;
  const localized = resolveCatalogSessionDisplay(
    lang,
    catalog?.id,
    session.title,
    catalog?.goal ?? plan.patientFriendlyGoal ?? plan.patientRehabFocus,
  );

  const title =
    catalog != null
      ? localized.title
      : formatSessionDisplayTitle(session.sessionNumber, session.title, lang);

  const context =
    localized.goal ??
    plan.patientFriendlyGoal?.trim() ??
    plan.patientRehabFocus?.trim() ??
    null;

  const durationLabel = catalog
    ? formatPatientSessionDurationLabel(catalog.estimatedDurationMinutes, lang)
    : null;

  return { title, context, durationLabel };
}
