import type { GeneralAssessmentDraft } from "./types";
import { GENERAL_ASSESSMENT_VERSION } from "./types";
import { createEmptySpecialTests } from "./special-tests-catalog";

function emptyOutcome() {
  return { rawNotes: "", clinicianDocumented: "" };
}

function emptyFunctional(): GeneralAssessmentDraft["functional"]["five_x_sts"] {
  return { status: "not_started", result: "", notes: "" };
}

function emptyObjective(): GeneralAssessmentDraft["objective"]["posture"] {
  return { status: "not_started", cameraCv: true, result: "", notes: "" };
}

export function createEmptyGeneralAssessmentDraft(): GeneralAssessmentDraft {
  return {
    version: GENERAL_ASSESSMENT_VERSION,
    subjective: {
      chiefComplaint: "",
      painLocation: "",
      nprs: "",
      aggravating: "",
      easing: "",
      functionalLimitations: "",
      goals: "",
      redFlags: "",
    },
    outcomes: {
      nprs: emptyOutcome(),
      psfs: emptyOutcome(),
      lefs: emptyOutcome(),
      quickdash: emptyOutcome(),
      oswestry: emptyOutcome(),
      ndi: emptyOutcome(),
    },
    functional: {
      five_x_sts: emptyFunctional(),
      tug: emptyFunctional(),
      gait_speed: emptyFunctional(),
      single_leg_balance: emptyFunctional(),
      squat: emptyFunctional(),
      step_down: emptyFunctional(),
    },
    objective: {
      posture: emptyObjective(),
      rom: emptyObjective(),
      squat: emptyObjective(),
      gait: emptyObjective(),
      balance: emptyObjective(),
      sit_to_stand: emptyObjective(),
    },
    ai: {
      clinicalImpression: "",
      supportingFindings: "",
      missingTests: "",
      confidenceLevel: "",
      safetyNotes: "",
    },
    therapist: {
      decision: "",
      finalDiagnosis: "",
      treatmentPriorities: "",
    },
    soap: {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
    },
    specialTests: createEmptySpecialTests(),
    /** Empty until first save/load — avoids SSR/client timestamp mismatch on initial state. */
    updatedAt: "",
  };
}
