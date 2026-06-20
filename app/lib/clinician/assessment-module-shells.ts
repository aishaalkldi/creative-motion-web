export type PlannedAssessmentMetric = {
  label: string;
  note: string;
};

export type AssessmentModuleShellConfig = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  safetyDetail: string;
  observationsSectionTitle: string;
  observationsSectionLead: string;
  emptyStateTitle: string;
  emptyStateBody: string;
  plannedMetricsIntro: string;
  plannedMetrics: readonly PlannedAssessmentMetric[];
  reviewGuidance: readonly string[];
  footerNote: string;
};

export const SINGLE_LEG_STANCE_SHELL: AssessmentModuleShellConfig = {
  id: "single-leg-stance",
  eyebrow: "RASQ · Single Leg Stance assessment",
  title: "Single Leg Stance Assessment",
  description:
    "Camera-assisted single-leg stance functional assessment task for movement observation and therapist review. Assistive observations only — not a clinical balance test.",
  safetyDetail:
    "This module will provide movement observations from a bounded single-leg stance task to support therapist review. It is not diagnostic, does not assign balance scores, and does not replace clinical examination.",
  observationsSectionTitle: "Recorded stance observations",
  observationsSectionLead:
    "Saved movement observations will appear here when single-leg stance capture is enabled in a future release.",
  emptyStateTitle: "Coming next — no live capture yet",
  emptyStateBody:
    "When bounded single-leg stance capture is available, saved sessions will appear here for therapist review. Live capture is not enabled in this release.",
  plannedMetricsIntro:
    "Structured stance metrics will populate after live capture is enabled. All values will remain assistive movement observations for therapist review only.",
  plannedMetrics: [
    {
      label: "Hold duration observed",
      note: "Assistive estimate of single-leg hold time during the functional assessment task.",
    },
    {
      label: "Stance side identified",
      note: "Whether left or right stance was observable during capture.",
    },
    {
      label: "Balance interruption observed",
      note: "Whether foot-down or support touch was observed during the task.",
    },
    {
      label: "Pelvis and trunk visibility",
      note: "Whether trunk and hip landmarks remained visible during the hold.",
    },
    {
      label: "Tracking quality",
      note: "Camera and pose tracking reliability for the stance task.",
    },
    {
      label: "Task completion observed",
      note: "Whether the prescribed functional assessment task was attempted end-to-end.",
    },
    {
      label: "Retest recommendation",
      note: "Whether a repeat capture may help therapist review.",
    },
    {
      label: "Therapist review required",
      note: "All stance observations require clinician review before use in care planning.",
    },
  ],
  reviewGuidance: [
    "Use stance observations together with your clinical examination.",
    "Repeat capture when tracking quality or visibility is limited.",
    "Do not use this module alone for progression or care decisions.",
  ],
  footerNote:
    "Patient portal exercise modules are unchanged. Single-leg stance capture will connect to this review surface in a future update.",
};

export const FUNCTIONAL_REACH_SHELL: AssessmentModuleShellConfig = {
  id: "functional-reach",
  eyebrow: "RASQ · Functional Reach assessment",
  title: "Functional Reach Assessment",
  description:
    "Camera-assisted forward reach functional assessment task for movement observation and therapist review. Assistive observations only — not a validated reach test score.",
  safetyDetail:
    "This module will provide movement observations from a bounded forward reach task to support therapist review. It is not diagnostic, does not classify movement quality, and does not replace clinical examination.",
  observationsSectionTitle: "Recorded reach observations",
  observationsSectionLead:
    "Saved movement observations will appear here when functional reach capture is enabled in a future release.",
  emptyStateTitle: "Coming next — no live capture yet",
  emptyStateBody:
    "When bounded functional reach capture is available, saved sessions will appear here for therapist review. Live capture is not enabled in this release.",
  plannedMetricsIntro:
    "Structured reach metrics will populate after live capture is enabled. All values will remain assistive movement observations for therapist review only.",
  plannedMetrics: [
    {
      label: "Reach cycles observed",
      note: "Count of forward reach attempts observed during the functional assessment task.",
    },
    {
      label: "Peak reach extent observed",
      note: "Assistive forward reach movement observation relative to baseline stance.",
    },
    {
      label: "Return-to-upright observed",
      note: "Whether controlled return after reach was observable during capture.",
    },
    {
      label: "Arm side context",
      note: "Which arm was used when identifiable during the task.",
    },
    {
      label: "Trunk stability observation",
      note: "Coarse trunk steadiness during reach — not an automated movement quality score.",
    },
    {
      label: "Tracking quality",
      note: "Camera and upper-body tracking reliability for the reach task.",
    },
    {
      label: "Rest between cycles",
      note: "Pause duration between reach attempts when observable.",
    },
    {
      label: "Retest recommendation",
      note: "Whether a repeat capture may help therapist review.",
    },
    {
      label: "Therapist review required",
      note: "All reach observations require clinician review before use in care planning.",
    },
  ],
  reviewGuidance: [
    "Use reach observations together with your clinical examination.",
    "Repeat capture when tracking quality or upper-body visibility is limited.",
    "Do not use this module alone for progression or care decisions.",
  ],
  footerNote:
    "Patient portal exercise modules are unchanged. Functional reach capture will connect to this review surface in a future update.",
};

export const TIMED_UP_AND_GO_SHELL: AssessmentModuleShellConfig = {
  id: "timed-up-and-go",
  eyebrow: "RASQ · Timed Up and Go assessment",
  title: "Timed Up and Go Assessment",
  description:
    "Camera-assisted timed functional assessment task for movement observation and therapist review. Assistive task-duration observations only — not a mobility impairment score.",
  safetyDetail:
    "This module will provide movement observations from a bounded timed up and go task to support therapist review. It is not diagnostic, does not predict outcomes, and does not replace clinical examination.",
  observationsSectionTitle: "Recorded task observations",
  observationsSectionLead:
    "Saved movement observations will appear here when timed up and go capture is enabled in a future release.",
  emptyStateTitle: "Coming next — no live capture yet",
  emptyStateBody:
    "When bounded timed up and go capture is available, saved sessions will appear here for therapist review. Live capture is not enabled in this release.",
  plannedMetricsIntro:
    "Structured task metrics will populate after live capture is enabled. All values will remain assistive movement observations for therapist review only.",
  plannedMetrics: [
    {
      label: "Task duration observed",
      note: "Assistive elapsed time for the functional assessment task when fully observable.",
    },
    {
      label: "Sit-to-stand transition observed",
      note: "Whether rise from seated position was captured during the task.",
    },
    {
      label: "Walking pass observed",
      note: "Whether the walking segment was captured during the task.",
    },
    {
      label: "Turn observed",
      note: "Whether the turn segment was observable during capture.",
    },
    {
      label: "Return-to-seat observed",
      note: "Whether return to seated position was captured during the task.",
    },
    {
      label: "Movement continuity",
      note: "Whether the full functional assessment task flow was observable end-to-end.",
    },
    {
      label: "Tracking quality",
      note: "Camera and pose tracking reliability across task phases.",
    },
    {
      label: "Retest recommendation",
      note: "Whether a repeat capture may help therapist review.",
    },
    {
      label: "Therapist review required",
      note: "All task observations require clinician review before use in care planning.",
    },
  ],
  reviewGuidance: [
    "Use task observations together with your clinical examination.",
    "Repeat capture when tracking quality or task visibility is limited.",
    "Do not use this module alone for progression or care decisions.",
  ],
  footerNote:
    "Manual in-clinic documentation remains available elsewhere. Timed up and go capture will connect to this review surface in a future update.",
};

export const ASSESSMENT_MODULE_SHELLS = {
  "single-leg-stance": SINGLE_LEG_STANCE_SHELL,
  "functional-reach": FUNCTIONAL_REACH_SHELL,
  "timed-up-and-go": TIMED_UP_AND_GO_SHELL,
} as const;

export type AssessmentModuleShellId = keyof typeof ASSESSMENT_MODULE_SHELLS;
