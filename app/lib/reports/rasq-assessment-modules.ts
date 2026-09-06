/**
 * Canonical RASQ assessment modules available in the product.
 * PT report recommendations must reference only these modules.
 */
export type RasqAssessmentModule = {
  id: string;
  label: string;
  routeHint: string;
  regionSignals: string[];
  functionalSignals: string[];
};

export const RASQ_ASSESSMENT_MODULES: RasqAssessmentModule[] = [
  {
    id: "sit_to_stand",
    label: "Sit-to-Stand",
    routeHint: "/clinician/assessments/sit-to-stand",
    regionSignals: ["lower limb", "hip", "knee", "squat", "chair"],
    functionalSignals: ["sit to stand", "rising", "chair", "squat"],
  },
  {
    id: "mini_squat",
    label: "Mini Squat",
    routeHint: "/clinician/assessments/sit-to-stand",
    regionSignals: ["knee", "hip", "lower limb"],
    functionalSignals: ["squat", "sit to stand"],
  },
  {
    id: "single_leg_stance",
    label: "Single-Leg Stance",
    routeHint: "/clinician/assessments/single-leg-stance",
    regionSignals: ["balance", "ankle", "knee", "hip"],
    functionalSignals: ["balance", "unsteady", "standing", "single leg"],
  },
  {
    id: "functional_reach",
    label: "Functional Reach",
    routeHint: "/clinician/assessments/functional-reach",
    regionSignals: ["shoulder", "upper limb", "balance"],
    functionalSignals: ["reach", "overhead", "forward reach"],
  },
  {
    id: "timed_up_and_go",
    label: "Timed Up and Go",
    routeHint: "/clinician/assessments/timed-up-and-go",
    regionSignals: ["balance", "gait", "mobility"],
    functionalSignals: ["walking", "gait", "mobility", "turning", "stairs"],
  },
  {
    id: "gait_observation",
    label: "Gait Observation",
    routeHint: "/clinician/assessments/gait",
    regionSignals: ["gait", "walking", "ankle", "hip", "knee"],
    functionalSignals: ["walking", "gait", "limping", "mobility"],
  },
  {
    id: "upper_limb_motor_screen",
    label: "Upper-Limb Motor Screen",
    routeHint: "/clinician/assessments/upper-limb-motor-screen",
    regionSignals: ["shoulder", "upper limb", "elbow", "hand", "wrist"],
    functionalSignals: ["overhead", "reach", "grip", "hand", "arm", "weakness"],
  },
];

export function listRasqModuleLabels(): string[] {
  return RASQ_ASSESSMENT_MODULES.map((module) => module.label);
}

export function suggestRasqModulesFromCorpus(corpus: string): RasqAssessmentModule[] {
  const normalized = corpus.toLowerCase();
  const scored = RASQ_ASSESSMENT_MODULES.map((module) => {
    let score = 0;
    for (const signal of [...module.regionSignals, ...module.functionalSignals]) {
      if (normalized.includes(signal)) score += 1;
    }
    return { module, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 4).map((entry) => entry.module);
}

export function isAllowedRasqModuleLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return RASQ_ASSESSMENT_MODULES.some(
    (module) =>
      normalized.includes(module.label.toLowerCase()) ||
      normalized.includes(module.id.replace(/_/g, " ")),
  );
}
