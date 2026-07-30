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

/**
 * Stage 3 — minimal functional intake, reachable only after the urgent gate
 * clears (urgentGate.stopped === false). Patient/caregiver-reported only —
 * deliberately no diagnosis, severity, fall-risk score, or safety verdict.
 */
export type PostStrokeMoreAffectedSide = "left" | "right" | "both" | "unsure";

export const POST_STROKE_MORE_AFFECTED_SIDE_VALUES: readonly PostStrokeMoreAffectedSide[] = [
  "left",
  "right",
  "both",
  "unsure",
];

export function isValidPostStrokeMoreAffectedSide(value: unknown): value is PostStrokeMoreAffectedSide {
  return (
    typeof value === "string" &&
    (POST_STROKE_MORE_AFFECTED_SIDE_VALUES as readonly string[]).includes(value)
  );
}

/** Shared by sittingAbility and standingAbility — walkingAbility has its own enum (adds with_assistive_device). */
export type PostStrokeFunctionalAbility =
  | "independent"
  | "requires_supervision"
  | "requires_physical_assistance"
  | "unable";

export const POST_STROKE_FUNCTIONAL_ABILITY_VALUES: readonly PostStrokeFunctionalAbility[] = [
  "independent",
  "requires_supervision",
  "requires_physical_assistance",
  "unable",
];

export function isValidPostStrokeFunctionalAbility(value: unknown): value is PostStrokeFunctionalAbility {
  return (
    typeof value === "string" &&
    (POST_STROKE_FUNCTIONAL_ABILITY_VALUES as readonly string[]).includes(value)
  );
}

export type PostStrokeWalkingAbility =
  | "independent"
  | "with_assistive_device"
  | "requires_supervision"
  | "requires_physical_assistance"
  | "unable";

export const POST_STROKE_WALKING_ABILITY_VALUES: readonly PostStrokeWalkingAbility[] = [
  "independent",
  "with_assistive_device",
  "requires_supervision",
  "requires_physical_assistance",
  "unable",
];

export function isValidPostStrokeWalkingAbility(value: unknown): value is PostStrokeWalkingAbility {
  return (
    typeof value === "string" &&
    (POST_STROKE_WALKING_ABILITY_VALUES as readonly string[]).includes(value)
  );
}

export type PostStrokeAssistiveDevice = "none" | "cane" | "walker" | "wheelchair" | "other";

export const POST_STROKE_ASSISTIVE_DEVICE_VALUES: readonly PostStrokeAssistiveDevice[] = [
  "none",
  "cane",
  "walker",
  "wheelchair",
  "other",
];

export function isValidPostStrokeAssistiveDevice(value: unknown): value is PostStrokeAssistiveDevice {
  return (
    typeof value === "string" &&
    (POST_STROKE_ASSISTIVE_DEVICE_VALUES as readonly string[]).includes(value)
  );
}

export type PostStrokeFallsOrNearFalls =
  | "none"
  | "near_fall"
  | "fall_without_injury"
  | "fall_with_injury_already_reported";

export const POST_STROKE_FALLS_OR_NEAR_FALLS_VALUES: readonly PostStrokeFallsOrNearFalls[] = [
  "none",
  "near_fall",
  "fall_without_injury",
  "fall_with_injury_already_reported",
];

export function isValidPostStrokeFallsOrNearFalls(value: unknown): value is PostStrokeFallsOrNearFalls {
  return (
    typeof value === "string" &&
    (POST_STROKE_FALLS_OR_NEAR_FALLS_VALUES as readonly string[]).includes(value)
  );
}

export type PostStrokeUpperLimbUse =
  | "functional_use"
  | "limited_use"
  | "minimal_use"
  | "no_functional_use"
  | "unsure";

export const POST_STROKE_UPPER_LIMB_USE_VALUES: readonly PostStrokeUpperLimbUse[] = [
  "functional_use",
  "limited_use",
  "minimal_use",
  "no_functional_use",
  "unsure",
];

export function isValidPostStrokeUpperLimbUse(value: unknown): value is PostStrokeUpperLimbUse {
  return (
    typeof value === "string" &&
    (POST_STROKE_UPPER_LIMB_USE_VALUES as readonly string[]).includes(value)
  );
}

export type PostStrokeCommunicationSupport =
  | "none"
  | "extra_time"
  | "simplified_questions"
  | "caregiver_support"
  | "alternative_communication"
  | "other";

export const POST_STROKE_COMMUNICATION_SUPPORT_VALUES: readonly PostStrokeCommunicationSupport[] = [
  "none",
  "extra_time",
  "simplified_questions",
  "caregiver_support",
  "alternative_communication",
  "other",
];

export function isValidPostStrokeCommunicationSupport(value: unknown): value is PostStrokeCommunicationSupport {
  return (
    typeof value === "string" &&
    (POST_STROKE_COMMUNICATION_SUPPORT_VALUES as readonly string[]).includes(value)
  );
}

export type PostStrokeFunctionalIntake = {
  moreAffectedSide?: PostStrokeMoreAffectedSide;
  sittingAbility?: PostStrokeFunctionalAbility;
  standingAbility?: PostStrokeFunctionalAbility;
  walkingAbility?: PostStrokeWalkingAbility;
  assistiveDevice?: PostStrokeAssistiveDevice;
  assistiveDeviceOtherText?: string;
  recentFalls?: PostStrokeFallsOrNearFalls;
  upperLimbUse?: PostStrokeUpperLimbUse;
  communicationSupport?: PostStrokeCommunicationSupport;
  communicationSupportOtherText?: string;
  functionalGoal?: string;
  recordedAt: string;
  /** Factual operational state only — see PostStrokeOperationalFlag. Never a clinical verdict. */
  flags: PostStrokeOperationalFlag[];
};

/** Screen 1 fields — "assistiveDeviceOtherText" is validated conditionally, not as its own screen field. */
export const FUNCTIONAL_INTAKE_SCREEN_1_FIELDS = [
  "moreAffectedSide",
  "sittingAbility",
  "standingAbility",
  "walkingAbility",
  "assistiveDevice",
  "recentFalls",
] as const;

/** Screen 2 fields — "communicationSupportOtherText" is validated conditionally, not as its own screen field. */
export const FUNCTIONAL_INTAKE_SCREEN_2_FIELDS = ["upperLimbUse", "communicationSupport"] as const;

export const FUNCTIONAL_INTAKE_SCREEN_3_FIELDS = ["functionalGoal"] as const;

function isScreenOneComplete(fi: Partial<PostStrokeFunctionalIntake>): boolean {
  return (
    FUNCTIONAL_INTAKE_SCREEN_1_FIELDS.every((key) => fi[key] !== undefined) &&
    (fi.assistiveDevice !== "other" || Boolean(fi.assistiveDeviceOtherText?.trim()))
  );
}

function isScreenTwoComplete(fi: Partial<PostStrokeFunctionalIntake>): boolean {
  return (
    FUNCTIONAL_INTAKE_SCREEN_2_FIELDS.every((key) => fi[key] !== undefined) &&
    (fi.communicationSupport !== "other" || Boolean(fi.communicationSupportOtherText?.trim()))
  );
}

function isScreenThreeComplete(fi: Partial<PostStrokeFunctionalIntake>): boolean {
  return Boolean(fi.functionalGoal?.trim());
}

/**
 * Which of the 3 Stage 3 screens the resumed patient/caregiver should land
 * on — the first one with missing or conditionally-incomplete answers.
 * Returns 3 (review) once everything is already filled in.
 */
export function firstIncompleteFunctionalIntakeScreen(
  functionalIntake: Partial<PostStrokeFunctionalIntake> | undefined,
): 1 | 2 | 3 {
  const fi = functionalIntake ?? {};
  if (!isScreenOneComplete(fi)) return 1;
  if (!isScreenTwoComplete(fi)) return 2;
  return 3;
}

/** True only once every Stage 3 field required for final submission is present and valid. */
export function isFunctionalIntakeComplete(functionalIntake: Partial<PostStrokeFunctionalIntake> | undefined): boolean {
  const fi = functionalIntake ?? {};
  return isScreenOneComplete(fi) && isScreenTwoComplete(fi) && isScreenThreeComplete(fi);
}

/** Stage 2 + Stage 3 slice of the full post-stroke intake structured_data shape. */
export type PostStrokeIntakeDraft = {
  respondent?: PostStrokeRespondent;
  urgentGate?: PostStrokeUrgentGateResult;
  functionalIntake?: PostStrokeFunctionalIntake;
};
