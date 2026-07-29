/**
 * Post-stroke intake — urgent/new-symptom stop gate (Stage 2).
 *
 * This gate never diagnoses a cause. It only records what was selected and
 * decides, mechanically, whether the intake must stop. "no_new_urgent_symptoms"
 * is exclusive: any other symptom present — even alongside "no_new_urgent_symptoms" —
 * fails closed and stops the intake.
 */
import type { PostStrokeOperationalFlag, PostStrokeUrgentGateResult, PostStrokeUrgentSymptom } from "./types";

export const NO_NEW_URGENT_SYMPTOMS: PostStrokeUrgentSymptom = "no_new_urgent_symptoms";

export const URGENT_SYMPTOM_VALUES: readonly PostStrokeUrgentSymptom[] = [
  "new_weakness_or_numbness",
  "new_speech_or_understanding_change",
  "new_severe_dizziness_balance_or_coordination",
  "sudden_visual_change",
  "sudden_severe_headache",
  "chest_pain_or_shortness_of_breath",
  "loss_of_consciousness",
  "fall_with_injury",
  "other_sudden_deterioration",
  NO_NEW_URGENT_SYMPTOMS,
];

/** Closed-enum guard — the server never trusts a client-supplied symptom value without this check. */
export function isValidPostStrokeUrgentSymptom(value: unknown): value is PostStrokeUrgentSymptom {
  return (
    typeof value === "string" &&
    (URGENT_SYMPTOM_VALUES as readonly string[]).includes(value)
  );
}

/** True if any selected symptom is anything other than "no_new_urgent_symptoms". Fails closed. */
export function isUrgentGateStopped(symptoms: readonly PostStrokeUrgentSymptom[]): boolean {
  return symptoms.some((symptom) => symptom !== NO_NEW_URGENT_SYMPTOMS);
}

/**
 * Evaluates the urgent-symptom gate from exactly what the respondent selected.
 * Never invents, drops, or reorders symptoms. `clinician_review_required` is
 * always present — this gate never clears a patient for anything.
 */
export function evaluateUrgentGate(
  symptoms: readonly PostStrokeUrgentSymptom[],
  now: () => string = () => new Date().toISOString(),
): PostStrokeUrgentGateResult {
  const stopped = isUrgentGateStopped(symptoms);
  const flags: PostStrokeOperationalFlag[] = stopped
    ? ["urgent_symptoms_reported", "intake_stopped", "clinician_review_required"]
    : ["clinician_review_required"];

  return {
    symptoms: [...symptoms],
    recordedAt: now(),
    stopped,
    flags,
  };
}
