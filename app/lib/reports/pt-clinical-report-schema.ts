/**
 * A–J PT Clinical Report section schema — predictable structure for AI output and tests.
 */
export const PT_CLINICAL_REPORT_TITLE = "PT Clinical Report";

export const PT_CLINICAL_REPORT_DISCLAIMER =
  "AI-generated draft for physiotherapist review. Not a diagnosis.";

export const PT_CLINICAL_REPORT_THERAPIST_NOTE =
  "Draft only — therapist confirmation required before clinical use.";

export const PT_REPORT_SECTION_SPECS = [
  { id: "presentation", letter: "A", title: "Patient-Reported Presentation" },
  { id: "primary_complaint", letter: "B", title: "Primary Complaint" },
  { id: "pain_symptom_behavior", letter: "C", title: "Pain & Symptom Behavior" },
  { id: "functional_limitations", letter: "D", title: "Functional Limitations" },
  { id: "activity_participation", letter: "E", title: "Activity & Participation Restrictions" },
  { id: "patient_goals", letter: "F", title: "Patient Goals" },
  { id: "pt_interpretation", letter: "G", title: "PT Clinical Interpretation" },
  { id: "safety", letter: "H", title: "Safety / Red Flags" },
  { id: "suggested_objective", letter: "I", title: "Suggested Objective Assessment" },
  {
    id: "suggested_rasq_modules",
    letter: "J",
    title: "Recommended RASQ Assessment Modules / Next Assessment",
  },
] as const;

export type PtReportSectionId = (typeof PT_REPORT_SECTION_SPECS)[number]["id"];

export type PtClinicalReportSection = {
  id: PtReportSectionId;
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type PtClinicalReportDraft = {
  schemaVersion: 1;
  title: string;
  disclaimer: string;
  therapistReviewNote: string;
  sections: PtClinicalReportSection[];
  generatedAt: string;
  sourceLanguage: "en" | "ar";
  source: "clinical_english" | "patient_english";
  generationMethod?: "ai" | "rule_fallback";
};

export type ApprovedClinicalEnglishField = {
  fieldKey: string;
  label: string;
  section: string;
  clinicalEnglish: string;
};

export type ApprovedClinicalEnglishPayload = {
  sourceLanguage: "en" | "ar";
  painScore: string | null;
  hasRedFlag: boolean;
  fields: ApprovedClinicalEnglishField[];
};

export function buildPtClinicalReportDraftFromSections(
  sections: PtClinicalReportSection[],
  input: {
    sourceLanguage: "en" | "ar";
    source: "clinical_english" | "patient_english";
    generatedAt?: string;
    generationMethod?: "ai" | "rule_fallback";
  },
): PtClinicalReportDraft {
  return {
    schemaVersion: 1,
    title: PT_CLINICAL_REPORT_TITLE,
    disclaimer: PT_CLINICAL_REPORT_DISCLAIMER,
    therapistReviewNote: PT_CLINICAL_REPORT_THERAPIST_NOTE,
    sections,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceLanguage: input.sourceLanguage,
    source: input.source,
    generationMethod: input.generationMethod,
  };
}
