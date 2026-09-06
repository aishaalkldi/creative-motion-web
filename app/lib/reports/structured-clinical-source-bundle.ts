/**
 * Structured approved Clinical English bundle grouped by clinical concept.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import { getAssessmentLanguage } from "@/app/lib/assessment-payload";
import { detectRedFlag, inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";
import { normalizeClinicalEnglishText } from "@/app/lib/reports/normalize-clinical-english";
import {
  getQuestionnaireFieldSpec,
  type ClinicalConcept,
  type QuestionnaireFieldSpec,
} from "@/app/lib/reports/questionnaire-clinical-field-registry";
import { readClinicalFieldForReport } from "@/app/lib/reports/remote-questionnaire-workflow";

export type StructuredClinicalSourceField = {
  fieldKey: string;
  label: string;
  sectionTitle: string;
  clinicalConcept: ClinicalConcept;
  valueType: string;
  clinicalEnglish: string;
  isVoiceTranscription: boolean;
};

export type StructuredClinicalSourceBundle = {
  sourceLanguage: "en" | "ar";
  painScore: string | null;
  hasRedFlag: boolean;
  presentation: StructuredClinicalSourceField[];
  symptomBehavior: StructuredClinicalSourceField[];
  functionalLimitations: StructuredClinicalSourceField[];
  activityParticipation: StructuredClinicalSourceField[];
  patientGoals: StructuredClinicalSourceField[];
  allFields: StructuredClinicalSourceField[];
};

function isVoiceField(structuredData: Record<string, unknown>, fieldKey: string): boolean {
  return structuredData[`${fieldKey}_method`] === "voice";
}

function readApprovedField(
  structuredData: Record<string, unknown>,
  draft: PatientAssessmentDraft,
  sectionId: PatientSectionId,
  fieldKey: string,
  spec: QuestionnaireFieldSpec,
): StructuredClinicalSourceField | null {
  const block = draft[sectionId];
  if (!block || typeof block !== "object") return null;
  const raw = (block as Record<string, string>)[fieldKey];
  if (typeof raw !== "string" || !raw.trim() || /^\d+$/.test(raw.trim())) return null;

  const clinicalEnglish = normalizeClinicalEnglishText(
    readClinicalFieldForReport(structuredData, fieldKey, raw),
  ).text;
  if (!clinicalEnglish) return null;

  return {
    fieldKey,
    label: spec.label,
    sectionTitle: spec.sectionTitle,
    clinicalConcept: spec.clinicalConcept,
    valueType: spec.valueType,
    clinicalEnglish,
    isVoiceTranscription: isVoiceField(structuredData, fieldKey),
  };
}

function bucketForConcept(concept: ClinicalConcept): keyof Pick<
  StructuredClinicalSourceBundle,
  "presentation" | "symptomBehavior" | "functionalLimitations" | "activityParticipation" | "patientGoals"
> {
  switch (concept) {
    case "primary_complaint":
    case "anatomical_region":
    case "additional_notes":
      return "presentation";
    case "aggravating_factor":
    case "relieving_factor":
    case "symptom_behavior_with_movement":
    case "fall_history":
      return "symptomBehavior";
    case "movement_limitation":
    case "weakness":
    case "strength_activity_impact":
    case "functional_daily_impact":
      return "functionalLimitations";
    case "balance_difficulty":
    case "gait_description":
    case "walking_aids":
    case "standing_tolerance":
    case "walking_tolerance":
    case "stairs_ability":
      return "activityParticipation";
    case "patient_goals":
      return "patientGoals";
  }
}

export function buildStructuredClinicalSourceBundle(input: {
  structuredData: Record<string, unknown>;
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
}): StructuredClinicalSourceBundle {
  const includedSections = input.includedSections ?? inferIncludedSections(input.draft);
  const bundle: StructuredClinicalSourceBundle = {
    sourceLanguage: getAssessmentLanguage(input.structuredData) === "ar" ? "ar" : "en",
    painScore: input.draft.pain?.painScore?.trim() || null,
    hasRedFlag: detectRedFlag(input.structuredData),
    presentation: [],
    symptomBehavior: [],
    functionalLimitations: [],
    activityParticipation: [],
    patientGoals: [],
    allFields: [],
  };

  for (const sectionId of includedSections) {
    const block = input.draft[sectionId];
    if (!block || typeof block !== "object") continue;
    for (const fieldKey of Object.keys(block as Record<string, string>)) {
      const spec = getQuestionnaireFieldSpec(fieldKey);
      if (!spec) continue;
      const field = readApprovedField(
        input.structuredData,
        input.draft,
        sectionId,
        fieldKey,
        spec,
      );
      if (!field) continue;
      bundle.allFields.push(field);
      bundle[bucketForConcept(field.clinicalConcept)].push(field);
    }
  }

  return bundle;
}

export function bundleToPromptText(bundle: StructuredClinicalSourceBundle): string {
  const sections: string[] = [
    `Source language: ${bundle.sourceLanguage}`,
    `Patient-reported pain score: ${bundle.painScore ?? "not documented"}`,
    `Red-flag indicator: ${bundle.hasRedFlag ? "yes — for therapist review" : "no specific red flag documented"}`,
  ];

  const renderGroup = (title: string, fields: StructuredClinicalSourceField[]) => {
    if (fields.length === 0) return;
    sections.push(
      `${title}:\n${fields
        .map(
          (field) =>
            `- [${field.clinicalConcept}] ${field.label} (${field.fieldKey}, ${field.valueType}): ${field.clinicalEnglish}`,
        )
        .join("\n")}`,
    );
  };

  renderGroup("Presentation", bundle.presentation);
  renderGroup("Symptom behavior", bundle.symptomBehavior);
  renderGroup("Functional limitations", bundle.functionalLimitations);
  renderGroup("Activity and participation", bundle.activityParticipation);
  renderGroup("Patient goals", bundle.patientGoals);

  return sections.join("\n\n");
}
