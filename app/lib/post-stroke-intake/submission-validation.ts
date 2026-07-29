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
  isValidPostStrokeRespondentType,
  type PostStrokeRespondent,
} from "./types";
import {
  evaluateUrgentGate,
  isValidPostStrokeUrgentSymptom,
  NO_NEW_URGENT_SYMPTOMS,
} from "./urgent-gate";

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

  // stopped is guaranteed false by construction — the only accepted input is
  // the single exclusive "no new urgent symptoms" value.
  const urgentGate = evaluateUrgentGate(symptomsRaw);
  const assessmentLanguage = extractAssessmentLanguage(rawStructuredData);

  return {
    ok: true,
    structuredData: {
      postStrokeIntake: { respondent: respondentResult.respondent, urgentGate },
      ...(assessmentLanguage ? { assessmentLanguage } : {}),
    },
  };
}
