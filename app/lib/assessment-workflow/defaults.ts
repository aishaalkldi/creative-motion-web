import type {
  AssessmentWorkflowDraft,
  FunctionalCvRow,
  ObjectiveCvRow,
  OutcomeInstrumentDraft,
} from "./types";
import { WORKFLOW_STORAGE_VERSION } from "./types";

function emptyOutcome(): OutcomeInstrumentDraft {
  return { rawNotes: "", computedSummary: "" };
}

function emptyFunctionalRow(): FunctionalCvRow {
  return { status: "not_started", result: "", clinicalNotes: "" };
}

function emptyObjectiveRow(): ObjectiveCvRow {
  return {
    status: "not_started",
    cameraCvAvailable: true,
    result: "",
    clinicalNotes: "",
  };
}

export function createEmptyWorkflowDraft(): AssessmentWorkflowDraft {
  return {
    version: WORKFLOW_STORAGE_VERSION,
    subjective: {
      chiefComplaint: "",
      painLocation: "",
      nprs: "",
      onset: "",
      aggravating: "",
      easing: "",
      functionalLimitations: "",
      patientGoals: "",
      redFlags: "",
    },
    outcomes: {
      nprs: emptyOutcome(),
      psfs: emptyOutcome(),
      lefs: emptyOutcome(),
      quickdash: emptyOutcome(),
      odi: emptyOutcome(),
      ndi: emptyOutcome(),
    },
    functionalCv: {
      five_x_sts: emptyFunctionalRow(),
      tug: emptyFunctionalRow(),
      gait_speed: emptyFunctionalRow(),
      single_leg_balance: emptyFunctionalRow(),
      squat: emptyFunctionalRow(),
      step_down: emptyFunctionalRow(),
    },
    functionalPatientReportedNote: "",
    fimOptionalNote: "",
    objectiveCv: {
      posture: emptyObjectiveRow(),
      rom: emptyObjectiveRow(),
      squat: emptyObjectiveRow(),
      gait: emptyObjectiveRow(),
      balance: emptyObjectiveRow(),
      sit_to_stand: emptyObjectiveRow(),
    },
    ai: {
      clinicalImpressionSuggestion: "",
      supportingFindings: "",
      findingsAgainst: "",
      missingTests: "",
      severity: "",
      irritability: "",
      prognosis: "",
      redFlagNotes: "",
      confidenceLevel: "",
    },
    therapist: {
      decision: "",
      finalDiagnosis: "",
      treatmentPriority: "",
      approvalStatus: "Pending therapist review",
      auditNote: "",
    },
    soap: {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
    },
    updatedAt: new Date().toISOString(),
  };
}
