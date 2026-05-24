import { extractGeneralDraft, extractStructuredData } from "@/app/lib/assessment-payload";
import { buildRemoteQuestionnaireSummary } from "@/app/lib/remote-questionnaire-summary";

/** Prefer remote questionnaire, then general MSK, then structured wizard. */
const ASSESSMENT_TYPE_PRIORITY = [
  "remote_questionnaire",
  "general_msk",
  "structured",
  "questionnaire",
] as const;

export type AssessmentPickInput = {
  id: string;
  patient_id: string;
  type: string;
  created_at: string;
  structured_data?: unknown;
};

export type AssessmentSnapshot = {
  patientId: string;
  assessmentId: string;
  assessmentType: string;
  submittedAt: string;
  painAtRest?: string;
  painOnMovement?: string;
  bodyRegion?: string;
};

export function pickPreferredAssessment<T extends { type: string }>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  const newestByType = new Map<string, T>();
  for (const row of rows) {
    if (!newestByType.has(row.type)) {
      newestByType.set(row.type, row);
    }
  }
  for (const preferred of ASSESSMENT_TYPE_PRIORITY) {
    const match = newestByType.get(preferred);
    if (match) return match;
  }
  return rows[0] ?? null;
}

export function extractAssessmentSnapshot(row: AssessmentPickInput): AssessmentSnapshot {
  const base: AssessmentSnapshot = {
    patientId: row.patient_id,
    assessmentId: row.id,
    assessmentType: row.type,
    submittedAt: row.created_at,
  };

  if (row.type === "remote_questionnaire" && row.structured_data != null) {
    const summary = buildRemoteQuestionnaireSummary(row.structured_data, row.created_at);
    if (summary) {
      for (const metric of summary.metrics) {
        if (metric.label === "Pain at rest") base.painAtRest = metric.value;
        if (metric.label === "Pain on movement") base.painOnMovement = metric.value;
        if (metric.label === "Body region") base.bodyRegion = metric.value;
      }
    }
    return base;
  }

  const general = extractGeneralDraft(row.structured_data, row.type);
  if (general) {
    if (general.subjective.nprs.trim()) base.painAtRest = `${general.subjective.nprs}/10`;
    if (general.subjective.painLocation.trim()) base.bodyRegion = general.subjective.painLocation;
    return base;
  }

  const structured = extractStructuredData(row.structured_data);
  if (structured) {
    base.painAtRest = `${structured.painAtRest}/10`;
    base.painOnMovement = `${structured.painOnMovement}/10`;
    base.bodyRegion = structured.bodyRegion;
  }

  return base;
}

export function buildPatientAssessmentSnapshots(
  rows: AssessmentPickInput[],
): AssessmentSnapshot[] {
  const byPatient = new Map<string, AssessmentPickInput[]>();
  for (const row of rows) {
    const arr = byPatient.get(row.patient_id) ?? [];
    arr.push(row);
    byPatient.set(row.patient_id, arr);
  }

  const snapshots: AssessmentSnapshot[] = [];
  for (const patientRows of byPatient.values()) {
    const preferred = pickPreferredAssessment(patientRows);
    if (!preferred) continue;
    snapshots.push(extractAssessmentSnapshot(preferred));
  }
  return snapshots;
}
