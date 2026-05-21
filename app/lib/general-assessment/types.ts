/** General assessment draft keyed by patient chart ID (no encounter id required). */

export type CvRowStatus = "not_started" | "in_progress" | "completed";

// ── Special Tests ──────────────────────────────────────────────────────────────

export type SpecialTestResult = "not_tested" | "negative" | "positive" | "inconclusive";

export interface SpecialTestEntry {
  result: SpecialTestResult;
  notes: string;
}

/** Flat record: testId → entry. Test catalog lives in special-tests-catalog.ts. */
export type SpecialTestsData = Record<string, SpecialTestEntry>;

export type OutcomeKey = "nprs" | "psfs" | "lefs" | "quickdash" | "oswestry" | "ndi";

export type FunctionalKey =
  | "five_x_sts"
  | "tug"
  | "gait_speed"
  | "single_leg_balance"
  | "squat"
  | "step_down";

export type ObjectiveKey =
  | "posture"
  | "rom"
  | "squat"
  | "gait"
  | "balance"
  | "sit_to_stand";

export type GeneralAssessmentDraft = {
  version: 1;
  subjective: {
    chiefComplaint: string;
    painLocation: string;
    nprs: string;
    aggravating: string;
    easing: string;
    functionalLimitations: string;
    goals: string;
    redFlags: string;
  };
  outcomes: Record<OutcomeKey, { rawNotes: string; clinicianDocumented: string }>;
  functional: Record<
    FunctionalKey,
    { status: CvRowStatus; result: string; notes: string }
  >;
  objective: Record<
    ObjectiveKey,
    { status: CvRowStatus; cameraCv: boolean; result: string; notes: string }
  >;
  ai: {
    clinicalImpression: string;
    supportingFindings: string;
    missingTests: string;
    confidenceLevel: string;
    safetyNotes: string;
  };
  therapist: {
    decision: "" | "approve" | "edit" | "reject";
    finalDiagnosis: string;
    treatmentPriorities: string;
  };
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  /**
   * Clinician-entered special tests. Optional section — not required for submission.
   * Keyed by testId from SPECIAL_TESTS_CATALOG. Defaults to "not_tested".
   */
  specialTests: SpecialTestsData;
  updatedAt: string;
};

export const GENERAL_ASSESSMENT_VERSION = 1 as const;
