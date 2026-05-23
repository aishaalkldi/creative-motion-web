import type {
  PatientAssessmentDraft,
  PatientSectionId,
} from "./api/remote-assessments";

const SECTION_IDS: PatientSectionId[] = [
  "pain",
  "rom",
  "strength",
  "balance",
  "gait",
  "functional",
];

const RED_FLAG_KEY_RE = /red\s*flags?|warning|safety/i;

export type RemoteQuestionnaireSummary = {
  title: string;
  submittedAt: string;
  metrics: { label: string; value: string }[];
  rows: { label: string; value: string }[];
  hasRedFlag: boolean;
  patientDraft: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumberString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asTrimmedString(value);
}

export function isPatientAssessmentDraft(data: unknown): data is PatientAssessmentDraft {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  return SECTION_IDS.some((section) => section in (data as object));
}

export function extractRemoteQuestionnaireDraft(
  structuredData: unknown,
  type: string,
): PatientAssessmentDraft | null {
  if (type !== "remote_questionnaire") return null;
  if (!isPatientAssessmentDraft(structuredData)) return null;
  return structuredData;
}

export function inferIncludedSections(draft: PatientAssessmentDraft): PatientSectionId[] {
  return SECTION_IDS.filter((section) => {
    const block = draft[section];
    if (!block || typeof block !== "object") return false;
    return Object.values(block).some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
  });
}

function readField(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asTrimmedString(data[key]) ?? asNumberString(data[key]);
    if (value) return value;
  }
  return null;
}

export function detectRedFlag(structuredData: unknown): boolean {
  function walk(value: unknown, depth: number): boolean {
    if (depth > 8 || value === null || value === undefined) return false;

    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().length > 0;

    if (Array.isArray(value)) {
      return value.some((item) => walk(item, depth + 1));
    }

    if (typeof value === "object") {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (RED_FLAG_KEY_RE.test(key) && walk(nested, depth + 1)) return true;
      }
    }

    return false;
  }

  return walk(structuredData, 0);
}

export function buildRemoteQuestionnaireSummary(
  structuredData: unknown,
  createdAt: string,
): RemoteQuestionnaireSummary | null {
  if (!isPatientAssessmentDraft(structuredData)) return null;

  const draft = structuredData;
  const pain = draft.pain;
  const root =
    typeof structuredData === "object" && structuredData !== null
      ? (structuredData as Record<string, unknown>)
      : {};

  const metrics: { label: string; value: string }[] = [];
  const painAtRest =
    readField(root, "painAtRest") ??
    (pain?.painScore ? `${pain.painScore}/10` : null);
  const painOnMovement = readField(root, "painOnMovement");
  const bodyRegion =
    readField(root, "bodyRegion") ?? asTrimmedString(pain?.painLocation);

  if (painAtRest) metrics.push({ label: "Pain at rest", value: painAtRest });
  if (painOnMovement) metrics.push({ label: "Pain on movement", value: painOnMovement });
  if (bodyRegion) metrics.push({ label: "Body region", value: bodyRegion });

  const rows: { label: string; value: string }[] = [];
  const mainComplaint = asTrimmedString(pain?.chiefComplaint);
  const aggravating = asTrimmedString(pain?.aggravating);
  const functionalGoal = asTrimmedString(pain?.goals);
  const rehabPhase = readField(root, "rehabilitationPhase", "rehabPhase");

  if (mainComplaint) rows.push({ label: "Main complaint", value: mainComplaint });
  if (aggravating) rows.push({ label: "Aggravating factors", value: aggravating });
  if (functionalGoal) rows.push({ label: "Functional goal", value: functionalGoal });
  if (rehabPhase) rows.push({ label: "Rehab phase", value: rehabPhase });

  return {
    title: "Remote Questionnaire Assessment",
    submittedAt: createdAt,
    metrics,
    rows,
    hasRedFlag: detectRedFlag(structuredData),
    patientDraft: draft,
    includedSections: inferIncludedSections(draft),
  };
}
