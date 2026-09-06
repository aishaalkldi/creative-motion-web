/**
 * Semantic registry for remote questionnaire fields.
 * Single source of truth for clinical concept, value type, and report placement.
 */
import type { PatientSectionId } from "@/app/lib/api/remote-assessments";
import { clinicianText, PATIENT_SECTION_QUESTIONS, PATIENT_SECTION_TITLES } from "@/app/lib/patient-assessment-questions";

export type ClinicalConcept =
  | "primary_complaint"
  | "anatomical_region"
  | "aggravating_factor"
  | "relieving_factor"
  | "symptom_behavior_with_movement"
  | "movement_limitation"
  | "weakness"
  | "strength_activity_impact"
  | "functional_daily_impact"
  | "balance_difficulty"
  | "fall_history"
  | "gait_description"
  | "walking_aids"
  | "standing_tolerance"
  | "walking_tolerance"
  | "stairs_ability"
  | "additional_notes"
  | "patient_goals";

export type ClinicalValueType =
  | "anatomical"
  | "symptom_behavior"
  | "functional"
  | "temporal"
  | "goal"
  | "general";

export type ReportSectionHint =
  | "presentation"
  | "primary_complaint"
  | "pain_symptom_behavior"
  | "functional_limitations"
  | "activity_participation"
  | "patient_goals";

export type QuestionnaireFieldSpec = {
  fieldKey: string;
  sectionId: PatientSectionId;
  label: string;
  sectionTitle: string;
  clinicalConcept: ClinicalConcept;
  valueType: ClinicalValueType;
  reportSectionHints: ReportSectionHint[];
};

const FIELD_SPECS: Record<string, Omit<QuestionnaireFieldSpec, "fieldKey" | "label" | "sectionTitle">> = {
  chiefComplaint: {
    sectionId: "pain",
    clinicalConcept: "primary_complaint",
    valueType: "symptom_behavior",
    reportSectionHints: ["presentation", "primary_complaint"],
  },
  painLocation: {
    sectionId: "pain",
    clinicalConcept: "anatomical_region",
    valueType: "anatomical",
    reportSectionHints: ["presentation"],
  },
  aggravating: {
    sectionId: "pain",
    clinicalConcept: "aggravating_factor",
    valueType: "symptom_behavior",
    reportSectionHints: ["pain_symptom_behavior"],
  },
  easing: {
    sectionId: "pain",
    clinicalConcept: "relieving_factor",
    valueType: "symptom_behavior",
    reportSectionHints: ["pain_symptom_behavior"],
  },
  dailyImpact: {
    sectionId: "pain",
    clinicalConcept: "functional_daily_impact",
    valueType: "functional",
    reportSectionHints: ["functional_limitations", "activity_participation"],
  },
  goals: {
    sectionId: "pain",
    clinicalConcept: "patient_goals",
    valueType: "goal",
    reportSectionHints: ["patient_goals"],
  },
  limitations: {
    sectionId: "rom",
    clinicalConcept: "movement_limitation",
    valueType: "functional",
    reportSectionHints: ["functional_limitations"],
  },
  worseWith: {
    sectionId: "rom",
    clinicalConcept: "symptom_behavior_with_movement",
    valueType: "symptom_behavior",
    reportSectionHints: ["pain_symptom_behavior"],
  },
  weaknessDescription: {
    sectionId: "strength",
    clinicalConcept: "weakness",
    valueType: "symptom_behavior",
    reportSectionHints: ["presentation", "functional_limitations"],
  },
  activitiesAffected: {
    sectionId: "strength",
    clinicalConcept: "strength_activity_impact",
    valueType: "functional",
    reportSectionHints: ["functional_limitations", "activity_participation"],
  },
  difficultyDescription: {
    sectionId: "balance",
    clinicalConcept: "balance_difficulty",
    valueType: "functional",
    reportSectionHints: ["activity_participation"],
  },
  fallHistory: {
    sectionId: "balance",
    clinicalConcept: "fall_history",
    valueType: "general",
    reportSectionHints: ["activity_participation", "pain_symptom_behavior"],
  },
  walkingDescription: {
    sectionId: "gait",
    clinicalConcept: "gait_description",
    valueType: "functional",
    reportSectionHints: ["activity_participation"],
  },
  aids: {
    sectionId: "gait",
    clinicalConcept: "walking_aids",
    valueType: "general",
    reportSectionHints: ["activity_participation"],
  },
  standingDuration: {
    sectionId: "functional",
    clinicalConcept: "standing_tolerance",
    valueType: "temporal",
    reportSectionHints: ["activity_participation"],
  },
  walkingDistance: {
    sectionId: "functional",
    clinicalConcept: "walking_tolerance",
    valueType: "temporal",
    reportSectionHints: ["activity_participation"],
  },
  stairsAbility: {
    sectionId: "functional",
    clinicalConcept: "stairs_ability",
    valueType: "functional",
    reportSectionHints: ["activity_participation"],
  },
  otherNotes: {
    sectionId: "functional",
    clinicalConcept: "additional_notes",
    valueType: "general",
    reportSectionHints: ["presentation", "activity_participation"],
  },
};

function buildRegistry(): Map<string, QuestionnaireFieldSpec> {
  const registry = new Map<string, QuestionnaireFieldSpec>();
  for (const sectionId of Object.keys(PATIENT_SECTION_QUESTIONS) as PatientSectionId[]) {
    for (const question of PATIENT_SECTION_QUESTIONS[sectionId]) {
      const spec = FIELD_SPECS[question.key];
      if (!spec) continue;
      registry.set(question.key, {
        fieldKey: question.key,
        label: clinicianText(question.text),
        sectionTitle: clinicianText(PATIENT_SECTION_TITLES[sectionId]),
        ...spec,
      });
    }
  }
  return registry;
}

const REGISTRY = buildRegistry();

export function getQuestionnaireFieldSpec(fieldKey: string): QuestionnaireFieldSpec | null {
  return REGISTRY.get(fieldKey) ?? null;
}

export function listQuestionnaireFieldSpecs(): QuestionnaireFieldSpec[] {
  return Array.from(REGISTRY.values());
}

export function conceptsMatchForDedup(a: ClinicalConcept, b: ClinicalConcept): boolean {
  return a === b;
}

export function reportSectionForConcept(concept: ClinicalConcept): ReportSectionHint {
  switch (concept) {
    case "primary_complaint":
      return "primary_complaint";
    case "anatomical_region":
      return "presentation";
    case "aggravating_factor":
    case "relieving_factor":
    case "symptom_behavior_with_movement":
      return "pain_symptom_behavior";
    case "movement_limitation":
    case "weakness":
    case "strength_activity_impact":
    case "functional_daily_impact":
      return "functional_limitations";
    case "balance_difficulty":
    case "fall_history":
    case "gait_description":
    case "walking_aids":
    case "standing_tolerance":
    case "walking_tolerance":
    case "stairs_ability":
    case "additional_notes":
      return "activity_participation";
    case "patient_goals":
      return "patient_goals";
  }
}
