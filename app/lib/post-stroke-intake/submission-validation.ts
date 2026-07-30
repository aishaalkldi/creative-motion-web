/**
 * Post-stroke intake — server-side validation and normalization of a raw
 * submitted structured_data payload (Stage 2 fields only: respondent + urgent
 * gate).
 *
 * The server is authoritative: it never trusts a client-supplied `stopped`,
 * `flags`, or `recordedAt`. It validates the closed enums and recomputes the
 * urgent-gate result itself using the shared pure urgent-gate function, then
 * rebuilds structured_data entirely from validated inputs — nothing from the
 * raw client payload passes through unchecked.
 */
import {
  isValidPostStrokeAssistanceType,
  isValidPostStrokeAssistiveDevice,
  isValidPostStrokeCommunicationSupport,
  isValidPostStrokeFallsOrNearFalls,
  isValidPostStrokeFunctionalAbility,
  isValidPostStrokeMoreAffectedSide,
  isValidPostStrokeRespondentType,
  isValidPostStrokeUpperLimbUse,
  isValidPostStrokeWalkingAbility,
  type PostStrokeFunctionalIntake,
  type PostStrokeRespondent,
} from "./types";
import {
  evaluateUrgentGate,
  isValidPostStrokeUrgentSymptom,
  NO_NEW_URGENT_SYMPTOMS,
} from "./urgent-gate";

const FUNCTIONAL_GOAL_MIN_LENGTH = 2;
const FUNCTIONAL_GOAL_MAX_LENGTH = 500;
const OTHER_TEXT_MAX_LENGTH = 200;

/** Fields Stage 3 is allowed to persist. Anything else in the payload is rejected outright. */
const FUNCTIONAL_INTAKE_ALLOWED_KEYS = new Set([
  "moreAffectedSide",
  "sittingAbility",
  "standingAbility",
  "walkingAbility",
  "assistiveDevice",
  "assistiveDeviceOtherText",
  "recentFalls",
  "upperLimbUse",
  "communicationSupport",
  "communicationSupportOtherText",
  "functionalGoal",
  // Server-authoritative — accepted but always recomputed, never trusted from the client.
  "recordedAt",
  "flags",
]);

const FUNCTIONAL_INTAKE_REQUIRED_KEYS = [
  "moreAffectedSide",
  "sittingAbility",
  "standingAbility",
  "walkingAbility",
  "assistiveDevice",
  "recentFalls",
  "upperLimbUse",
  "communicationSupport",
  "functionalGoal",
] as const;

type FunctionalIntakeFields = Omit<PostStrokeFunctionalIntake, "recordedAt" | "flags">;

type FunctionalIntakeParseResult =
  | { ok: true; fields: FunctionalIntakeFields | undefined }
  | { ok: false; error: string };

function validateFunctionalGoalText(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Functional goal must be text." };
  }
  const trimmed = raw.trim();
  if (trimmed.length < FUNCTIONAL_GOAL_MIN_LENGTH) {
    return { ok: false, error: `Functional goal must be at least ${FUNCTIONAL_GOAL_MIN_LENGTH} characters.` };
  }
  if (trimmed.length > FUNCTIONAL_GOAL_MAX_LENGTH) {
    return { ok: false, error: `Functional goal must be at most ${FUNCTIONAL_GOAL_MAX_LENGTH} characters.` };
  }
  return { ok: true, value: trimmed };
}

/**
 * Parses and validates the Stage 3 functionalIntake sub-object.
 *
 * mode "partial" (save-draft): the object may be entirely absent, or contain
 * any subset of fields — but every field that IS present must be valid, and
 * any unrecognized key fails the whole request closed (never silently
 * dropped). mode "complete" (final submit): every required field must be
 * present in addition to being valid.
 *
 * Conditional other-text pairing (assistiveDevice/communicationSupport
 * "other") is checked against whatever is present in this call — the client
 * always resends the full known functionalIntake state, the same
 * rebuild-from-input contract already used for respondent/urgentGate, so a
 * field entered on an earlier screen is never silently dropped by omission.
 */
function parseFunctionalIntake(raw: unknown, mode: "partial" | "complete"): FunctionalIntakeParseResult {
  if (raw === undefined) {
    if (mode === "complete") {
      return { ok: false, error: "Functional intake is required." };
    }
    return { ok: true, fields: undefined };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Invalid functional intake data." };
  }

  for (const key of Object.keys(raw)) {
    if (!FUNCTIONAL_INTAKE_ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Unexpected functional intake field: ${key}.` };
    }
  }

  const fields: FunctionalIntakeFields = {};

  if (raw.moreAffectedSide !== undefined) {
    if (!isValidPostStrokeMoreAffectedSide(raw.moreAffectedSide)) {
      return { ok: false, error: "Invalid more-affected-side value." };
    }
    fields.moreAffectedSide = raw.moreAffectedSide;
  }
  if (raw.sittingAbility !== undefined) {
    if (!isValidPostStrokeFunctionalAbility(raw.sittingAbility)) {
      return { ok: false, error: "Invalid sitting-ability value." };
    }
    fields.sittingAbility = raw.sittingAbility;
  }
  if (raw.standingAbility !== undefined) {
    if (!isValidPostStrokeFunctionalAbility(raw.standingAbility)) {
      return { ok: false, error: "Invalid standing-ability value." };
    }
    fields.standingAbility = raw.standingAbility;
  }
  if (raw.walkingAbility !== undefined) {
    if (!isValidPostStrokeWalkingAbility(raw.walkingAbility)) {
      return { ok: false, error: "Invalid walking-ability value." };
    }
    fields.walkingAbility = raw.walkingAbility;
  }
  if (raw.assistiveDevice !== undefined) {
    if (!isValidPostStrokeAssistiveDevice(raw.assistiveDevice)) {
      return { ok: false, error: "Invalid assistive-device value." };
    }
    fields.assistiveDevice = raw.assistiveDevice;
  }
  if (raw.recentFalls !== undefined) {
    if (!isValidPostStrokeFallsOrNearFalls(raw.recentFalls)) {
      return { ok: false, error: "Invalid recent-falls value." };
    }
    fields.recentFalls = raw.recentFalls;
  }
  if (raw.upperLimbUse !== undefined) {
    if (!isValidPostStrokeUpperLimbUse(raw.upperLimbUse)) {
      return { ok: false, error: "Invalid upper-limb-use value." };
    }
    fields.upperLimbUse = raw.upperLimbUse;
  }
  if (raw.communicationSupport !== undefined) {
    if (!isValidPostStrokeCommunicationSupport(raw.communicationSupport)) {
      return { ok: false, error: "Invalid communication-support value." };
    }
    fields.communicationSupport = raw.communicationSupport;
  }
  if (raw.functionalGoal !== undefined) {
    const goal = validateFunctionalGoalText(raw.functionalGoal);
    if (!goal.ok) return goal;
    fields.functionalGoal = goal.value;
  }

  // Conditional "other" text — required only when its paired enum is "other".
  if (fields.assistiveDevice === "other") {
    if (typeof raw.assistiveDeviceOtherText !== "string" || raw.assistiveDeviceOtherText.trim().length === 0) {
      return { ok: false, error: "Assistive device details are required when 'other' is selected." };
    }
    fields.assistiveDeviceOtherText = raw.assistiveDeviceOtherText.trim().slice(0, OTHER_TEXT_MAX_LENGTH);
  } else if (raw.assistiveDeviceOtherText !== undefined) {
    if (typeof raw.assistiveDeviceOtherText !== "string") {
      return { ok: false, error: "Invalid assistive device details." };
    }
    fields.assistiveDeviceOtherText = raw.assistiveDeviceOtherText.trim().slice(0, OTHER_TEXT_MAX_LENGTH);
  }

  if (fields.communicationSupport === "other") {
    if (
      typeof raw.communicationSupportOtherText !== "string" ||
      raw.communicationSupportOtherText.trim().length === 0
    ) {
      return { ok: false, error: "Communication support details are required when 'other' is selected." };
    }
    fields.communicationSupportOtherText = raw.communicationSupportOtherText.trim().slice(0, OTHER_TEXT_MAX_LENGTH);
  } else if (raw.communicationSupportOtherText !== undefined) {
    if (typeof raw.communicationSupportOtherText !== "string") {
      return { ok: false, error: "Invalid communication support details." };
    }
    fields.communicationSupportOtherText = raw.communicationSupportOtherText.trim().slice(0, OTHER_TEXT_MAX_LENGTH);
  }

  if (mode === "complete") {
    for (const key of FUNCTIONAL_INTAKE_REQUIRED_KEYS) {
      if (fields[key] === undefined) {
        return { ok: false, error: `Missing required functional intake field: ${key}.` };
      }
    }
  }

  return { ok: true, fields };
}

export type PostStrokeIntakeValidationResult =
  | { ok: true; structuredData: Record<string, unknown>; stopped: boolean }
  | { ok: false; error: string };

export type PostStrokeIntakeDraftSaveResult =
  | { ok: true; structuredData: Record<string, unknown> }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validates only the respondent sub-object — shared by both the submit and draft-save validators. */
function validateRespondent(
  postStrokeIntake: Record<string, unknown>,
): { ok: true; respondent: PostStrokeRespondent } | { ok: false; error: string } {
  const respondentRaw = postStrokeIntake.respondent;
  if (!isPlainObject(respondentRaw) || !isValidPostStrokeRespondentType(respondentRaw.type)) {
    return { ok: false, error: "A valid respondent type is required." };
  }
  const respondent: PostStrokeRespondent = { type: respondentRaw.type };
  if (respondentRaw.assistanceType !== undefined) {
    if (!isValidPostStrokeAssistanceType(respondentRaw.assistanceType)) {
      return { ok: false, error: "Invalid assistance type." };
    }
    respondent.assistanceType = respondentRaw.assistanceType;
  }
  return { ok: true, respondent };
}

/** Extracts assessmentLanguage only if it is one of the two supported values — shared by both validators. */
function extractAssessmentLanguage(rawStructuredData: Record<string, unknown>): "en" | "ar" | undefined {
  return rawStructuredData.assessmentLanguage === "ar" || rawStructuredData.assessmentLanguage === "en"
    ? rawStructuredData.assessmentLanguage
    : undefined;
}

/**
 * Validates a terminal (urgent-stop) submission — used only by
 * POST /api/remote-assessments/[token]/submit. Requires at least one
 * urgent-symptom answer; any combination is accepted here (the caller is
 * responsible for rejecting a non-stopped result, since a cleared intake
 * must be saved through validatePostStrokeIntakeDraftSave instead).
 */
export function validatePostStrokeIntakeSubmission(
  rawStructuredData: unknown,
): PostStrokeIntakeValidationResult {
  if (!isPlainObject(rawStructuredData)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const postStrokeIntake = rawStructuredData.postStrokeIntake;
  if (!isPlainObject(postStrokeIntake)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const respondentResult = validateRespondent(postStrokeIntake);
  if (!respondentResult.ok) return respondentResult;

  const urgentGateRaw = postStrokeIntake.urgentGate;
  const symptomsRaw = isPlainObject(urgentGateRaw) ? urgentGateRaw.symptoms : undefined;
  if (!Array.isArray(symptomsRaw) || symptomsRaw.length === 0) {
    return { ok: false, error: "At least one urgent-symptom answer is required." };
  }
  if (!symptomsRaw.every(isValidPostStrokeUrgentSymptom)) {
    return { ok: false, error: "Invalid urgent-symptom value." };
  }

  // Authoritative — recomputed server-side, replacing any client-supplied
  // stopped/flags/recordedAt entirely. Fails closed by construction: any
  // symptom other than "no_new_urgent_symptoms" stops the intake even if
  // "no_new_urgent_symptoms" was also (spoofed to be) present.
  const urgentGate = evaluateUrgentGate(symptomsRaw);

  return {
    ok: true,
    stopped: urgentGate.stopped,
    structuredData: {
      postStrokeIntake: { respondent: respondentResult.respondent, urgentGate },
      ...(extractAssessmentLanguage(rawStructuredData)
        ? { assessmentLanguage: extractAssessmentLanguage(rawStructuredData) }
        : {}),
    },
  };
}

/**
 * Validates a partial, non-terminal draft save — used only by
 * POST /api/remote-assessments/[token]/save-draft. Accepts exactly
 * `urgentGate.symptoms = ["no_new_urgent_symptoms"]` and nothing else; any
 * real urgent symptom, any additional symptom, or an empty/missing list is
 * rejected here so a genuine urgent-stop can only ever be recorded through
 * the submit endpoint's terminal path.
 *
 * Stage 3: also accepts an optional `functionalIntake` sub-object (partial —
 * any subset of fields, each validated if present). respondent/urgentGate
 * keep the exact same rebuild-from-input contract they always had: the
 * client resends its full known state on every call, so a Stage 3 field
 * entered on an earlier screen is preserved by the client resending it
 * again, never by a server-side merge with previously stored data.
 */
export function validatePostStrokeIntakeDraftSave(
  rawStructuredData: unknown,
): PostStrokeIntakeDraftSaveResult {
  if (!isPlainObject(rawStructuredData)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const postStrokeIntake = rawStructuredData.postStrokeIntake;
  if (!isPlainObject(postStrokeIntake)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const respondentResult = validateRespondent(postStrokeIntake);
  if (!respondentResult.ok) return respondentResult;

  const urgentGateRaw = postStrokeIntake.urgentGate;
  const symptomsRaw = isPlainObject(urgentGateRaw) ? urgentGateRaw.symptoms : undefined;
  if (
    !Array.isArray(symptomsRaw) ||
    symptomsRaw.length !== 1 ||
    symptomsRaw[0] !== NO_NEW_URGENT_SYMPTOMS
  ) {
    return {
      ok: false,
      error: "This endpoint only accepts a no-new-urgent-symptoms draft save.",
    };
  }

  const functionalIntakeResult = parseFunctionalIntake(postStrokeIntake.functionalIntake, "partial");
  if (!functionalIntakeResult.ok) return functionalIntakeResult;

  // stopped is guaranteed false by construction — the only accepted input is
  // the single exclusive "no new urgent symptoms" value.
  const urgentGate = evaluateUrgentGate(symptomsRaw);
  const assessmentLanguage = extractAssessmentLanguage(rawStructuredData);

  return {
    ok: true,
    structuredData: {
      postStrokeIntake: {
        respondent: respondentResult.respondent,
        urgentGate,
        ...(functionalIntakeResult.fields
          ? {
              functionalIntake: {
                ...functionalIntakeResult.fields,
                recordedAt: new Date().toISOString(),
                flags: ["clinician_review_required"],
              },
            }
          : {}),
      },
      ...(assessmentLanguage ? { assessmentLanguage } : {}),
    },
  };
}

export type PostStrokeIntakeCompletionResult =
  | { ok: true; structuredData: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validates the final Stage 3 submission — used only by the
 * `complete_post_stroke_intake` action on
 * POST /api/remote-assessments/[token]/submit. Requires the Stage 2 urgent
 * gate to exist and be cleared (stopped === false — a stopped intake was
 * already finalized through the urgent-stop path and can never reach here),
 * plus the complete Stage 3 functionalIntake dataset. Every timestamp/flag is
 * server-recomputed; nothing client-supplied is trusted for those fields.
 */
export function validatePostStrokeIntakeCompletion(
  rawStructuredData: unknown,
): PostStrokeIntakeCompletionResult {
  if (!isPlainObject(rawStructuredData)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const postStrokeIntake = rawStructuredData.postStrokeIntake;
  if (!isPlainObject(postStrokeIntake)) {
    return { ok: false, error: "Invalid assessment data." };
  }

  const respondentResult = validateRespondent(postStrokeIntake);
  if (!respondentResult.ok) return respondentResult;

  const urgentGateRaw = postStrokeIntake.urgentGate;
  const symptomsRaw = isPlainObject(urgentGateRaw) ? urgentGateRaw.symptoms : undefined;
  if (
    !Array.isArray(symptomsRaw) ||
    symptomsRaw.length !== 1 ||
    symptomsRaw[0] !== NO_NEW_URGENT_SYMPTOMS
  ) {
    return {
      ok: false,
      error: "Final submission requires a cleared Stage 2 urgent gate (no new urgent symptoms).",
    };
  }

  const functionalIntakeResult = parseFunctionalIntake(postStrokeIntake.functionalIntake, "complete");
  if (!functionalIntakeResult.ok) return functionalIntakeResult;

  // stopped is guaranteed false by construction, same as validatePostStrokeIntakeDraftSave.
  const urgentGate = evaluateUrgentGate(symptomsRaw);
  const assessmentLanguage = extractAssessmentLanguage(rawStructuredData);

  return {
    ok: true,
    structuredData: {
      postStrokeIntake: {
        respondent: respondentResult.respondent,
        urgentGate,
        functionalIntake: {
          ...functionalIntakeResult.fields,
          recordedAt: new Date().toISOString(),
          flags: ["clinician_review_required"],
        },
      },
      ...(assessmentLanguage ? { assessmentLanguage } : {}),
    },
  };
}
