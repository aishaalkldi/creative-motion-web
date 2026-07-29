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
import { evaluateUrgentGate, isValidPostStrokeUrgentSymptom } from "./urgent-gate";

export type PostStrokeIntakeValidationResult =
  | { ok: true; structuredData: Record<string, unknown>; stopped: boolean }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

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

  const assessmentLanguage =
    rawStructuredData.assessmentLanguage === "ar" || rawStructuredData.assessmentLanguage === "en"
      ? rawStructuredData.assessmentLanguage
      : undefined;

  return {
    ok: true,
    stopped: urgentGate.stopped,
    structuredData: {
      postStrokeIntake: { respondent, urgentGate },
      ...(assessmentLanguage ? { assessmentLanguage } : {}),
    },
  };
}
