/**
 * Draft state for the B2B clinical assessment workflow (client-side persistence).
 * No fabricated clinical values — empty fields mean "not recorded".
 */

export type WorkflowStepId =
  | "patient"
  | "subjective"
  | "outcomes"
  | "functional"
  | "objective"
  | "ai"
  | "review"
  | "soap"
  | "report";

export type CvTestStatus = "not_started" | "in_progress" | "completed";

export type SubjectiveDraft = {
  chiefComplaint: string;
  painLocation: string;
  nprs: string;
  onset: string;
  aggravating: string;
  easing: string;
  functionalLimitations: string;
  patientGoals: string;
  redFlags: string;
};

export type OutcomeInstrumentKey =
  | "nprs"
  | "psfs"
  | "lefs"
  | "quickdash"
  | "odi"
  | "ndi";

export type OutcomeInstrumentDraft = {
  /** Free-text or numeric raw entries — scoring pipeline not implemented */
  rawNotes: string;
  /** Populated only when clinician or future scorer commits; never auto-faked */
  computedSummary: string;
};

export type FunctionalCvTestKey =
  | "five_x_sts"
  | "tug"
  | "gait_speed"
  | "single_leg_balance"
  | "squat"
  | "step_down";

export type FunctionalCvRow = {
  status: CvTestStatus;
  result: string;
  clinicalNotes: string;
};

export type ObjectiveCvCardId =
  | "posture"
  | "rom"
  | "squat"
  | "gait"
  | "balance"
  | "sit_to_stand";

export type ObjectiveCvRow = {
  status: CvTestStatus;
  cameraCvAvailable: boolean;
  result: string;
  clinicalNotes: string;
};

export type AiReasoningDraft = {
  clinicalImpressionSuggestion: string;
  supportingFindings: string;
  findingsAgainst: string;
  missingTests: string;
  severity: string;
  irritability: string;
  prognosis: string;
  redFlagNotes: string;
  confidenceLevel: string;
};

export type TherapistDecision = "" | "approve" | "edit" | "reject";

export type TherapistReviewDraft = {
  decision: TherapistDecision;
  finalDiagnosis: string;
  treatmentPriority: string;
  approvalStatus: string;
  auditNote: string;
};

export type SoapDraft = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type AssessmentWorkflowDraft = {
  version: 1;
  subjective: SubjectiveDraft;
  outcomes: Record<OutcomeInstrumentKey, OutcomeInstrumentDraft>;
  functionalCv: Record<FunctionalCvTestKey, FunctionalCvRow>;
  functionalPatientReportedNote: string;
  fimOptionalNote: string;
  objectiveCv: Record<ObjectiveCvCardId, ObjectiveCvRow>;
  ai: AiReasoningDraft;
  therapist: TherapistReviewDraft;
  soap: SoapDraft;
  updatedAt: string;
};

export const WORKFLOW_STORAGE_VERSION = 1 as const;
