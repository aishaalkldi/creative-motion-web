/**
 * PR117 — Rule-based assessment interpretation draft from patient-reported answers.
 * Therapist review prompts only. No diagnosis, pathology labels, or treatment advice.
 */
import type {
  PatientAssessmentDraft,
  PatientSectionId,
} from "@/app/lib/api/remote-assessments";
import { inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";

export type BodyRegionBucket =
  | "Knee"
  | "Shoulder"
  | "Neck"
  | "Ankle / foot"
  | "Hip"
  | "Balance and gait"
  | "Upper limb"
  | "Low back"
  | "General MSK";

export type AssessmentInterpretationDraft = {
  bodyRegionBucket: BodyRegionBucket | null;
  sufficientDetail: boolean;
  functionalLimitations: string[];
  movementComponents: string[];
  musclePerformanceAreas: string[];
  suggestedObjectiveAssessments: string[];
  confirmationNote: string;
};

export type BuildAssessmentInterpretationDraftInput = {
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
  submissionMeta?: Record<string, unknown> | null;
};

/** Exported for unit tests — output must never contain these. */
export const FORBIDDEN_INTERPRETATION_TERMS = [
  "diagnosis",
  "rotator cuff tear",
  "frozen shoulder",
  "neurological disorder",
  "deltoid weakness",
  "treatment recommendation",
  "will improve",
  "clinical improvement",
  "fall risk",
  "pathology",
] as const;

const FUNCTIONAL_LIMITATION_PREFIX = "Patient-reported limitation:";
const MOVEMENT_PREFIX = "Movement component that may be relevant to assess:";
const MUSCLE_PREFIX = "Possible muscle performance area for therapist review:";
const OBJECTIVE_PREFIX = "Suggested therapist assessment:";

const REGION_MOVEMENT: Record<BodyRegionBucket, string[]> = {
  Shoulder: [
    "shoulder flexion",
    "shoulder abduction",
    "shoulder external rotation",
    "shoulder internal rotation",
  ],
  Knee: ["knee flexion", "knee extension", "squatting", "stair negotiation"],
  "Low back": ["lumbar flexion", "lumbar extension", "trunk rotation", "sit-to-stand transition"],
  Neck: ["cervical rotation", "cervical flexion", "cervical extension"],
  Hip: ["hip flexion", "hip extension", "hip abduction", "single-leg loading"],
  "Ankle / foot": ["ankle dorsiflexion", "ankle plantarflexion", "foot clearance during gait"],
  "Upper limb": ["elbow flexion", "wrist movement", "grip-related functional tasks"],
  "Balance and gait": ["walking tolerance", "turning", "single-leg stance", "step length symmetry"],
  "General MSK": ["functional reaching", "transfers", "weight-bearing tolerance"],
};

const REGION_MUSCLE: Record<BodyRegionBucket, string[]> = {
  Shoulder: ["deltoid", "rotator cuff", "scapular stabilizers"],
  Knee: ["quadriceps", "hamstrings", "hip abductors"],
  "Low back": ["lumbar extensors", "core stabilizers", "hip extensors"],
  Neck: ["deep neck flexors", "scapular stabilizers", "upper trapezius context"],
  Hip: ["gluteus medius", "gluteus maximus", "hip flexors"],
  "Ankle / foot": ["calf complex", "ankle invertors and evertors", "intrinsic foot muscles"],
  "Upper limb": ["forearm flexors and extensors", "grip-related muscle groups", "shoulder girdle stabilizers"],
  "Balance and gait": ["quadriceps", "gluteus medius", "calf complex"],
  "General MSK": ["regional stabilizers relevant to reported tasks"],
};

const REGION_OBJECTIVE: Record<BodyRegionBucket, string[]> = {
  Shoulder: [
    "active range of motion (AROM)",
    "passive range of motion (PROM)",
    "manual muscle testing (MMT) — therapist observation only",
    "painful arc observation",
  ],
  Knee: [
    "active range of motion (AROM)",
    "passive range of motion (PROM)",
    "manual muscle testing (MMT) — therapist observation only",
    "step-up or stair negotiation observation",
  ],
  "Low back": [
    "active range of motion (AROM)",
    "repeated flexion or extension observation",
    "sit-to-stand observation",
    "functional task tolerance observation",
  ],
  Neck: [
    "active range of motion (AROM)",
    "passive range of motion (PROM)",
    "cervical movement observation during functional tasks",
  ],
  Hip: [
    "active range of motion (AROM)",
    "passive range of motion (PROM)",
    "manual muscle testing (MMT) — therapist observation only",
    "single-leg stance observation",
  ],
  "Ankle / foot": [
    "active range of motion (AROM)",
    "weight-bearing tolerance observation",
    "gait observation",
  ],
  "Upper limb": [
    "active range of motion (AROM)",
    "passive range of motion (PROM)",
    "functional grip or reach observation",
  ],
  "Balance and gait": [
    "timed walking observation",
    "turning observation",
    "single-leg stance observation",
    "assistive device use observation",
  ],
  "General MSK": [
    "active range of motion (AROM)",
    "passive range of motion (PROM)",
    "functional task observation",
  ],
};

const ACTIVITY_LIMITATION_RULES: { pattern: RegExp; phrase: string }[] = [
  { pattern: /\b(overhead|above\s*head|reach(?:ing)?\s*(?:up|over))\b/i, phrase: "difficulty with overhead reaching" },
  { pattern: /\b(groom|dress|shirt|hair|comb)\b/i, phrase: "difficulty with grooming or dressing tasks" },
  { pattern: /\b(stair|step(?:s)?\s*up|climb)\b/i, phrase: "difficulty with stair climbing" },
  { pattern: /\b(walk|walking|gait|march)\b/i, phrase: "difficulty with walking tolerance" },
  { pattern: /\b(squat|sit\s*to\s*stand|stand\s*from\s*chair)\b/i, phrase: "difficulty with sit-to-stand or squatting tasks" },
  { pattern: /\b(balance|unsteady|steady)\b/i, phrase: "difficulty with balance during daily tasks" },
  { pattern: /\b(lift|carry|grocer|object)\b/i, phrase: "difficulty lifting or carrying objects" },
  { pattern: /\b(sleep|night|rest)\b/i, phrase: "sleep or rest disruption related to reported symptoms" },
  { pattern: /\b(work|job|desk|office)\b/i, phrase: "difficulty with work-related tasks" },
  { pattern: /\b(sport|run|jog|tennis|football|exercise)\b/i, phrase: "difficulty returning to sport or exercise tasks" },
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function bucketPainLocation(text: string): BodyRegionBucket | null {
  const t = normalizeText(text);
  if (!t) return null;

  if (/\b(knee|patella|patellar|ركبة)\b/.test(t)) return "Knee";
  if (/\b(shoulder|rotator|كتف)\b/.test(t)) return "Shoulder";
  if (/\b(neck|cervical|رقبة)\b/.test(t)) return "Neck";
  if (/\b(ankle|foot|feet|heel|كاحل|قدم)\b/.test(t)) return "Ankle / foot";
  if (/\b(hip|groin|ورك)\b/.test(t)) return "Hip";
  if (/\b(gait|balance|walking|walk|march|توازن|مشي)\b/.test(t)) return "Balance and gait";
  if (/\b(upper\s*limb|arm|elbow|wrist|hand|ذراع|معصم)\b/.test(t)) return "Upper limb";
  if (/\b(back|lumbar|spine|spinal|lower\s*back|ظهر|قطني)\b/.test(t)) return "Low back";
  if (/\b(full\s*body|general|multiple|عام)\b/.test(t)) return "General MSK";

  return null;
}

function readMetaTranslation(
  submissionMeta: Record<string, unknown> | null | undefined,
  fieldKey: string,
): string | null {
  const value = submissionMeta?.[`${fieldKey}_en`];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readField(
  draft: PatientAssessmentDraft,
  submissionMeta: Record<string, unknown> | null | undefined,
  fieldKey: string,
  raw: string | undefined,
): string {
  const translated = readMetaTranslation(submissionMeta, fieldKey);
  if (translated) return translated;
  return raw?.trim() ?? "";
}

function collectTextCorpus(
  draft: PatientAssessmentDraft,
  submissionMeta: Record<string, unknown> | null | undefined,
): string {
  const parts: string[] = [];

  const pain = draft.pain;
  if (pain) {
    parts.push(
      readField(draft, submissionMeta, "chiefComplaint", pain.chiefComplaint),
      readField(draft, submissionMeta, "painLocation", pain.painLocation),
      readField(draft, submissionMeta, "aggravating", pain.aggravating),
      readField(draft, submissionMeta, "easing", pain.easing),
      readField(draft, submissionMeta, "dailyImpact", pain.dailyImpact),
      readField(draft, submissionMeta, "goals", pain.goals),
    );
  }

  const rom = draft.rom;
  if (rom) {
    parts.push(
      readField(draft, submissionMeta, "limitations", rom.limitations),
      readField(draft, submissionMeta, "worseWith", rom.worseWith),
    );
  }

  const strength = draft.strength;
  if (strength) {
    parts.push(
      readField(draft, submissionMeta, "weaknessDescription", strength.weaknessDescription),
      readField(draft, submissionMeta, "activitiesAffected", strength.activitiesAffected),
    );
  }

  const balance = draft.balance;
  if (balance) {
    parts.push(
      readField(draft, submissionMeta, "difficultyDescription", balance.difficultyDescription),
      readField(draft, submissionMeta, "fallHistory", balance.fallHistory),
    );
  }

  const gait = draft.gait;
  if (gait) {
    parts.push(
      readField(draft, submissionMeta, "walkingDescription", gait.walkingDescription),
      readField(draft, submissionMeta, "aids", gait.aids),
    );
  }

  const functional = draft.functional;
  if (functional) {
    parts.push(
      readField(draft, submissionMeta, "standingDuration", functional.standingDuration),
      readField(draft, submissionMeta, "walkingDistance", functional.walkingDistance),
      readField(draft, submissionMeta, "stairsAbility", functional.stairsAbility),
      readField(draft, submissionMeta, "otherNotes", functional.otherNotes),
    );
  }

  return parts.filter(Boolean).join("\n");
}

function containsForbiddenTerm(text: string): boolean {
  const normalized = normalizeText(text);
  return FORBIDDEN_INTERPRETATION_TERMS.some((term) => normalized.includes(term));
}

function sanitizeLine(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || containsForbiddenTerm(trimmed)) return null;
  return trimmed;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function prefixLines(prefix: string, items: string[]): string[] {
  return dedupe(
    items
      .map((item) => sanitizeLine(item))
      .filter((item): item is string => Boolean(item))
      .map((item) => `${prefix} ${item}`),
  );
}

function inferActivityLimitations(corpus: string): string[] {
  const matches: string[] = [];
  for (const rule of ACTIVITY_LIMITATION_RULES) {
    if (rule.pattern.test(corpus)) {
      matches.push(rule.phrase);
    }
  }
  return dedupe(matches);
}

function inferDirectLimitationSnippets(
  draft: PatientAssessmentDraft,
  submissionMeta: Record<string, unknown> | null | undefined,
): string[] {
  const snippets: string[] = [];
  const candidates = [
    { key: "dailyImpact", value: draft.pain?.dailyImpact },
    { key: "limitations", value: draft.rom?.limitations },
    { key: "chiefComplaint", value: draft.pain?.chiefComplaint },
    { key: "stairsAbility", value: draft.functional?.stairsAbility },
    { key: "walkingDistance", value: draft.functional?.walkingDistance },
    { key: "weaknessDescription", value: draft.strength?.weaknessDescription },
    { key: "difficultyDescription", value: draft.balance?.difficultyDescription },
    { key: "walkingDescription", value: draft.gait?.walkingDescription },
  ];

  for (const candidate of candidates) {
    const text = readField(draft, submissionMeta, candidate.key, candidate.value);
    if (!text || text.length < 8) continue;
    if (containsForbiddenTerm(text)) continue;
    const shortened = text.length > 160 ? `${text.slice(0, 157).trim()}…` : text;
    snippets.push(shortened);
  }

  return dedupe(snippets).slice(0, 3);
}

function buildFunctionalLimitations(
  draft: PatientAssessmentDraft,
  submissionMeta: Record<string, unknown> | null | undefined,
  corpus: string,
): string[] {
  const activityLines = inferActivityLimitations(corpus);
  const directLines = inferDirectLimitationSnippets(draft, submissionMeta);

  const combined = dedupe([...activityLines, ...directLines]);
  if (combined.length === 0) return [];

  return prefixLines(FUNCTIONAL_LIMITATION_PREFIX, combined);
}

function inferRegionBucket(
  draft: PatientAssessmentDraft,
  submissionMeta: Record<string, unknown> | null | undefined,
  corpus: string,
): BodyRegionBucket | null {
  const painLocation = readField(draft, submissionMeta, "painLocation", draft.pain?.painLocation);
  const fromLocation = bucketPainLocation(painLocation);
  if (fromLocation) return fromLocation;

  return bucketPainLocation(corpus);
}

function regionOrGeneral(region: BodyRegionBucket | null): BodyRegionBucket {
  return region ?? "General MSK";
}

export function buildAssessmentInterpretationDraft(
  input: BuildAssessmentInterpretationDraftInput,
): AssessmentInterpretationDraft {
  const { draft, submissionMeta = null } = input;
  const includedSections = input.includedSections ?? inferIncludedSections(draft);
  const corpus = collectTextCorpus(draft, submissionMeta);
  const bodyRegionBucket = inferRegionBucket(draft, submissionMeta, corpus);
  const region = regionOrGeneral(bodyRegionBucket);

  const functionalLimitations = buildFunctionalLimitations(draft, submissionMeta, corpus);

  const movementComponents = prefixLines(
    MOVEMENT_PREFIX,
    REGION_MOVEMENT[region].slice(0, 4),
  );

  const musclePerformanceAreas = prefixLines(
    MUSCLE_PREFIX,
    REGION_MUSCLE[region].slice(0, 3),
  );

  const suggestedObjectiveAssessments = prefixLines(
    OBJECTIVE_PREFIX,
    REGION_OBJECTIVE[region].slice(0, 4),
  );

  const hasPatientText = corpus.trim().length >= 12;
  const sufficientDetail =
    includedSections.length > 0 &&
    (functionalLimitations.length > 0 || hasPatientText);

  const confirmationNote = sufficientDetail
    ? "Draft only — therapist confirmation required."
    : "Insufficient patient-reported detail for structured prompts. Draft only — therapist confirmation required.";

  return {
    bodyRegionBucket,
    sufficientDetail,
    functionalLimitations,
    movementComponents,
    musclePerformanceAreas,
    suggestedObjectiveAssessments,
    confirmationNote,
  };
}

/** Test helper — assert no forbidden terms appear in draft output. */
export function draftOutputContainsForbiddenTerms(draft: AssessmentInterpretationDraft): string[] {
  const lines = [
    ...draft.functionalLimitations,
    ...draft.movementComponents,
    ...draft.musclePerformanceAreas,
    ...draft.suggestedObjectiveAssessments,
    draft.confirmationNote,
  ];
  const hits: string[] = [];
  for (const line of lines) {
    for (const term of FORBIDDEN_INTERPRETATION_TERMS) {
      if (normalizeText(line).includes(term)) {
        hits.push(term);
      }
    }
  }
  return dedupe(hits);
}
