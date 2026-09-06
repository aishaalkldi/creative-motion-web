import {
  STROKE_QUESTIONS,
  type StrokeQuestionDefinition,
  type StrokeResponse,
  type StrokeSafetyState,
  type StrokeSectionId,
} from "./stroke-questionnaire-schema";

function scalar(response: StrokeResponse | undefined): string {
  if (!response) return "";
  return Array.isArray(response.rawValue) ? response.rawValue.join(",") : response.rawValue;
}

function isYes(responses: Record<string, StrokeResponse>, id: string): boolean {
  return scalar(responses[id]) === "yes";
}

export function resolveStrokeSafetyState(
  responses: Record<string, StrokeResponse>,
): StrokeSafetyState {
  if (
    isYes(responses, "sg_sudden_new_neurological_change") ||
    isYes(responses, "sg_chest_pain_or_severe_breathlessness") ||
    isYes(responses, "sg_recent_fall_with_injury")
  ) {
    return "URGENT_ESCALATION";
  }
  if (
    isYes(responses, "sg_gradual_functional_worsening") ||
    scalar(responses.sg_other_safety_concern).trim()
  ) {
    return "REQUIRES_CLINICIAN_REVIEW";
  }
  const requiredSafetyQuestions = [
    "sg_sudden_new_neurological_change",
    "sg_chest_pain_or_severe_breathlessness",
    "sg_recent_fall_with_injury",
    "sg_gradual_functional_worsening",
  ];
  if (
    requiredSafetyQuestions.some(
      (id) => scalar(responses[id]) !== "no",
    )
  ) {
    return "REQUIRES_CLINICIAN_REVIEW";
  }
  return "PASS";
}

export function isNonambulatory(responses: Record<string, StrokeResponse>): boolean {
  return scalar(responses.mb_current_walking_status) === "nonambulatory";
}

export function shouldShowUpperLimb(
  responses: Record<string, StrokeResponse>,
): boolean {
  const explicitInvolvement = scalar(responses.sc_upper_limb_involvement);
  if (explicitInvolvement === "yes" || explicitInvolvement === "unsure") return true;

  const goalCorpus = [
    scalar(responses.goal_primary),
    scalar(responses.goal_second),
    scalar(responses.goal_third),
    scalar(responses.goal_most_important_change),
  ].join(" ").toLowerCase();
  const relevantGoal = /\b(arm|hand|reach|grasp|hold|release|write|dress|eat|groom|phone)\b/.test(goalCorpus);
  const relevantSymptom = [
    "ul_stiffness_tightness",
    "ul_movement_control",
    "ul_movement_accuracy",
    "ul_unintended_movement",
    "ul_pain",
    "ul_swelling_sensitivity",
  ].some((id) => isYes(responses, id));
  return relevantGoal || relevantSymptom;
}

export function visibleStrokeSections(
  responses: Record<string, StrokeResponse>,
): StrokeSectionId[] {
  const sections: StrokeSectionId[] = ["safety_gate", "stroke_context"];
  if (shouldShowUpperLimb(responses)) sections.push("upper_limb_hand");
  sections.push(
    "mobility_balance_falls",
    "sensation_fatigue_pain",
    "adl_participation_support",
    "patient_goals",
  );
  return sections;
}

export function isStrokeQuestionVisible(
  question: StrokeQuestionDefinition,
  responses: Record<string, StrokeResponse>,
): boolean {
  if (question.sectionId === "upper_limb_hand" && !shouldShowUpperLimb(responses)) return false;
  if (question.id === "mb_fall_details") return isYes(responses, "mb_fall_reported");
  if (question.id === "sfp_pain_location_description") return isYes(responses, "sfp_pain_present");
  if (
    [
      "mb_walking_turning_difficulty",
      "mb_foot_catching_dragging",
      "mb_walking_aid_use",
      "mb_integrated_rise_walk_turn_sit",
    ].includes(question.id)
  ) {
    return !isNonambulatory(responses);
  }
  return true;
}

export function visibleStrokeQuestions(
  sectionId: StrokeSectionId,
  responses: Record<string, StrokeResponse>,
): StrokeQuestionDefinition[] {
  return STROKE_QUESTIONS.filter(
    (question) =>
      question.sectionId === sectionId && isStrokeQuestionVisible(question, responses),
  );
}

export function buildStrokeBranchTrace(
  responses: Record<string, StrokeResponse>,
): string[] {
  const trace: string[] = [`SAFETY_${resolveStrokeSafetyState(responses)}`];
  if (!shouldShowUpperLimb(responses)) trace.push("UPPER_LIMB_SKIPPED");
  if (isNonambulatory(responses)) trace.push("NONAMBULATORY_WALKING_BRANCH_SKIPPED");
  if (isYes(responses, "mb_fall_reported")) trace.push("FALL_DETAILS_OPENED");
  if (!isYes(responses, "sfp_pain_present")) trace.push("PAIN_DETAILS_SKIPPED");
  if (isYes(responses, "sc_communication_support_needed")) {
    trace.push("COMMUNICATION_SUPPORT_RECOMMENDED");
  }
  return trace;
}
