/**
 * PR117 + PR118 — Rule-based assessment interpretation draft from patient-reported answers.
 * Therapist review prompts only. No diagnosis, pathology labels, or treatment advice.
 */
import type {
  PatientAssessmentDraft,
  PatientSectionId,
} from "@/app/lib/api/remote-assessments";
import { inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";
import {
  matchBiomechanicalRules,
  type BiomechanicalRegionTag,
} from "@/app/lib/reports/biomechanical-review-rules";

export type BodyRegionBucket = BiomechanicalRegionTag;

export type AssessmentInterpretationDraft = {
  bodyRegionBucket: BodyRegionBucket | null;
  bodyRegionBuckets: BodyRegionBucket[];
  sufficientDetail: boolean;
  hasBiomechanicalPrompts: boolean;
  functionalLimitations: string[];
  movementComponents: string[];
  musclePerformanceAreas: string[];
  suggestedObjectiveAssessments: string[];
  confirmationNote: string;
  matchedRuleIds: string[];
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
  "fall risk prediction",
  "pathology",
  "osteoarthritis",
  "meniscus",
  "meniscus injury",
  "impingement",
  "radiculopathy",
  "grade 3 weakness",
  "mmt +3",
  "mmt grade",
  "limited rom",
  "rom loss",
  "weakness confirmed",
  "weakness grade",
] as const;

const FUNCTIONAL_LIMITATION_PREFIX = "Patient-reported limitation:";
const MOVEMENT_PREFIX = "Movement component for review:";
const MUSCLE_PREFIX = "Possible muscle performance area for therapist review:";
const OBJECTIVE_PREFIX = "Suggested objective PT assessment item:";

const MAX_MOVEMENT_ITEMS = 6;
const MAX_MUSCLE_ITEMS = 4;
const MAX_OBJECTIVE_ITEMS = 4;

const ACTIVITY_LIMITATION_RULES: { pattern: RegExp; phrase: string }[] = [
  { pattern: /\b(overhead|above\s*head|reach(?:ing)?\s*(?:up|over))\b/i, phrase: "difficulty with overhead reaching" },
  { pattern: /\b(comb\s*(?:my\s*)?hair|wash\s*(?:my\s*)?hair|groom)\b/i, phrase: "difficulty with grooming or hair care tasks" },
  { pattern: /\b(behind\s*(?:the\s*)?back|bra\s*clasp|do\s*(?:my\s*)?bra)\b/i, phrase: "difficulty with hand-behind-back or dressing tasks" },
  { pattern: /\b(stairs?|step(?:s)?\s*up|climb)\b/i, phrase: "difficulty with stair climbing" },
  { pattern: /\b(walk|walking|gait|march)\b/i, phrase: "difficulty with walking tolerance" },
  { pattern: /\b(squat|sit\s*to\s*stand|stand\s*from\s*chair|getting\s*up)\b/i, phrase: "difficulty with sit-to-stand or rising tasks" },
  { pattern: /\b(sitting|prolonged\s*sit)\b/i, phrase: "difficulty with prolonged sitting or rising from seated" },
  { pattern: /\b(balance|unsteady)\b/i, phrase: "difficulty with balance during daily tasks" },
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

function inferRegionBucketsFromCorpus(corpus: string): BodyRegionBucket[] {
  const buckets: BodyRegionBucket[] = [];
  const add = (bucket: BodyRegionBucket | null) => {
    if (!bucket || buckets.includes(bucket)) return;
    buckets.push(bucket);
  };

  const segments = corpus.split(/\n+/);
  for (const segment of segments) {
    add(bucketPainLocation(segment));
  }
  add(bucketPainLocation(corpus));

  return buckets;
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
  return FORBIDDEN_INTERPRETATION_TERMS.some((term) => normalized.includes(term.trim()));
}

function sanitizeItem(text: string): string | null {
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
      .map((item) => sanitizeItem(item))
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

function collectBiomechanicalItems(
  matchedRules: ReturnType<typeof matchBiomechanicalRules>,
): {
  movement: string[];
  muscle: string[];
  objective: string[];
  regionTags: BodyRegionBucket[];
  matchedRuleIds: string[];
} {
  const movement: string[] = [];
  const muscle: string[] = [];
  const objective: string[] = [];
  const regionTags: BodyRegionBucket[] = [];
  const matchedRuleIds: string[] = [];

  for (const rule of matchedRules) {
    matchedRuleIds.push(rule.id);
    movement.push(...rule.movementForReview);
    muscle.push(...rule.muscleForReview);
    objective.push(...rule.objectiveForReview);
    for (const tag of rule.regionTags ?? []) {
      if (!regionTags.includes(tag)) regionTags.push(tag);
    }
  }

  return {
    movement: dedupe(movement),
    muscle: dedupe(muscle),
    objective: dedupe(objective),
    regionTags,
    matchedRuleIds,
  };
}

export function buildAssessmentInterpretationDraft(
  input: BuildAssessmentInterpretationDraftInput,
): AssessmentInterpretationDraft {
  const { draft, submissionMeta = null } = input;
  const includedSections = input.includedSections ?? inferIncludedSections(draft);
  const corpus = collectTextCorpus(draft, submissionMeta);

  const painLocation = readField(draft, submissionMeta, "painLocation", draft.pain?.painLocation);
  const locationBucket = bucketPainLocation(painLocation);
  const corpusBuckets = inferRegionBucketsFromCorpus(corpus);

  const matchedRules = matchBiomechanicalRules(corpus);
  const biomechanical = collectBiomechanicalItems(matchedRules);

  const bodyRegionBuckets = dedupe([
    ...biomechanical.regionTags,
    ...(locationBucket ? [locationBucket] : []),
    ...corpusBuckets,
  ]) as BodyRegionBucket[];

  const functionalLimitations = buildFunctionalLimitations(draft, submissionMeta, corpus);

  const movementComponents = prefixLines(
    MOVEMENT_PREFIX,
    biomechanical.movement.slice(0, MAX_MOVEMENT_ITEMS),
  );
  const musclePerformanceAreas = prefixLines(
    MUSCLE_PREFIX,
    biomechanical.muscle.slice(0, MAX_MUSCLE_ITEMS),
  );
  const suggestedObjectiveAssessments = prefixLines(
    OBJECTIVE_PREFIX,
    biomechanical.objective.slice(0, MAX_OBJECTIVE_ITEMS),
  );

  const hasBiomechanicalPrompts =
    movementComponents.length > 0 ||
    musclePerformanceAreas.length > 0 ||
    suggestedObjectiveAssessments.length > 0;

  const hasPatientText = corpus.trim().length >= 12;
  const sufficientDetail =
    includedSections.length > 0 &&
    (functionalLimitations.length > 0 || hasBiomechanicalPrompts || hasPatientText);

  let confirmationNote = "Draft only — therapist confirmation required.";
  if (!sufficientDetail) {
    confirmationNote =
      "Insufficient patient-reported detail for structured prompts. Draft only — therapist confirmation required.";
  } else if (!hasBiomechanicalPrompts && functionalLimitations.length > 0) {
    confirmationNote =
      "No biomechanical review prompts matched patient-reported tasks. Draft only — therapist confirmation required.";
  }

  return {
    bodyRegionBucket: bodyRegionBuckets[0] ?? locationBucket,
    bodyRegionBuckets,
    sufficientDetail,
    hasBiomechanicalPrompts,
    functionalLimitations,
    movementComponents,
    musclePerformanceAreas,
    suggestedObjectiveAssessments,
    confirmationNote,
    matchedRuleIds: biomechanical.matchedRuleIds,
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
      if (normalizeText(line).includes(term.trim())) {
        hits.push(term);
      }
    }
  }
  return dedupe(hits);
}

/** Whether the interpretation section should render at all. */
export function shouldShowAssessmentInterpretationDraft(
  draft: AssessmentInterpretationDraft,
): boolean {
  if (!draft.sufficientDetail) return false;
  return (
    draft.functionalLimitations.length > 0 ||
    draft.hasBiomechanicalPrompts
  );
}
