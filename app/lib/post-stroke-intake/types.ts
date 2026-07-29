/**
 * Post-stroke intake — Stage 2 types (respondent identification + urgent-symptom
 * stop gate only). Deliberately separate from PatientAssessmentDraft/PatientSectionId —
 * this is a distinct assessment kind (assessments.type = "post_stroke_intake"),
 * not an extension of the six-section MSK questionnaire.
 */

export type PostStrokeRespondentType =
  | "patient"
  | "patient_with_caregiver_assistance"
  | "caregiver_proxy";

export const POST_STROKE_RESPONDENT_TYPES: readonly PostStrokeRespondentType[] = [
  "patient",
  "patient_with_caregiver_assistance",
  "caregiver_proxy",
];

/** Closed-enum guard — the server never trusts a client-supplied respondent type without this check. */
export function isValidPostStrokeRespondentType(value: unknown): value is PostStrokeRespondentType {
  return (
    typeof value === "string" &&
    (POST_STROKE_RESPONDENT_TYPES as readonly string[]).includes(value)
  );
}

export type PostStrokeAssistanceType =
  | "technology_support"
  | "question_clarification"
  | "communication_support"
  | "caregiver_answered_for_patient"
  | "other";

export const POST_STROKE_ASSISTANCE_TYPES: readonly PostStrokeAssistanceType[] = [
  "technology_support",
  "question_clarification",
  "communication_support",
  "caregiver_answered_for_patient",
  "other",
];

/** Closed-enum guard — the server never trusts a client-supplied assistance type without this check. */
export function isValidPostStrokeAssistanceType(value: unknown): value is PostStrokeAssistanceType {
  return (
    typeof value === "string" &&
    (POST_STROKE_ASSISTANCE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Assistance-type choices shown when a caregiver is involved (either
 * assisting the patient or reporting as proxy). "caregiver_answered_for_patient"
 * is deliberately excluded from both cases: for patient_with_caregiver_assistance
 * the patient remains the source of the answers, and for caregiver_proxy the
 * fact that the caregiver is the source is already established by the
 * respondent type itself — restating it as an "assistance type" would be
 * redundant and could blur the respondent-source distinction.
 */
export const HELPER_INVOLVED_ASSISTANCE_TYPES: readonly PostStrokeAssistanceType[] = [
  "technology_support",
  "question_clarification",
  "communication_support",
  "other",
];

/**
 * The assistance-type options visible for a given respondent type.
 * "patient" (answering alone) never shows the assistance-type section at all.
 */
export function getVisibleAssistanceTypes(
  respondentType: PostStrokeRespondentType | null,
): readonly PostStrokeAssistanceType[] {
  if (respondentType === null || respondentType === "patient") return [];
  return HELPER_INVOLVED_ASSISTANCE_TYPES;
}

/** True if the assistance-type section should render at all for this respondent type. */
export function shouldShowAssistanceTypeSection(
  respondentType: PostStrokeRespondentType | null,
): boolean {
  return getVisibleAssistanceTypes(respondentType).length > 0;
}

/** True if a previously-selected assistance type is still valid for the (possibly new) respondent type. */
export function isAssistanceTypeValidForRespondent(
  assistanceType: PostStrokeAssistanceType | undefined,
  respondentType: PostStrokeRespondentType | null,
): boolean {
  if (assistanceType === undefined) return true;
  return getVisibleAssistanceTypes(respondentType).includes(assistanceType);
}

export type PostStrokeUrgentSymptom =
  | "new_weakness_or_numbness"
  | "new_speech_or_understanding_change"
  | "new_severe_dizziness_balance_or_coordination"
  | "sudden_visual_change"
  | "sudden_severe_headache"
  | "chest_pain_or_shortness_of_breath"
  | "loss_of_consciousness"
  | "fall_with_injury"
  | "other_sudden_deterioration"
  | "no_new_urgent_symptoms";

/**
 * Factual operational states only — never a clinical safety verdict
 * (no "safe" / "unsafe" / "cleared for remote assessment").
 * Stage 2 only ever produces this subset; later stages add more.
 */
export type PostStrokeOperationalFlag =
  | "urgent_symptoms_reported"
  | "intake_stopped"
  | "clinician_review_required";

export type PostStrokeRespondent = {
  type: PostStrokeRespondentType;
  assistanceType?: PostStrokeAssistanceType;
};

export type PostStrokeUrgentGateResult = {
  /** Exactly what the respondent selected — never inferred or added to. */
  symptoms: PostStrokeUrgentSymptom[];
  recordedAt: string;
  stopped: boolean;
  flags: PostStrokeOperationalFlag[];
};

/** Stage 2 slice of the eventual full post-stroke intake structured_data shape. */
export type PostStrokeIntakeDraft = {
  respondent?: PostStrokeRespondent;
  urgentGate?: PostStrokeUrgentGateResult;
};
