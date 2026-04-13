export type AssessmentMode = "in_clinic" | "remote";
export type AssessmentStatus = "draft" | "completed";

export type StoredAssessment = {
  id: string;
  patientId: string;
  mode: AssessmentMode;
  selectedTests: string[];
  bodyRegion: string;
  side: string;
  visitType: string;
  sessionLabel: string;
  status: AssessmentStatus;
  createdAt: string;
  score?: number;
  durationSeconds?: number;
  reportSummary?: string;
  completedAt?: string;
};

const STORAGE_KEY = "creative-motion-assessments";

function normalizeAssessment(input: Partial<StoredAssessment>): StoredAssessment | null {
  if (!input.id || !input.patientId) return null;

  return {
    id: input.id,
    patientId: input.patientId,
    mode: input.mode === "remote" ? "remote" : "in_clinic",
    selectedTests: Array.isArray(input.selectedTests)
      ? input.selectedTests.filter((test): test is string => typeof test === "string")
      : [],
    bodyRegion: input.bodyRegion || "Full Body",
    side: input.side || "Not Applicable",
    visitType: input.visitType || "Follow-Up",
    sessionLabel: input.sessionLabel || "Assessment Session",
    status: input.status === "completed" ? "completed" : "draft",
    createdAt: input.createdAt || new Date().toISOString(),
    score: typeof input.score === "number" ? input.score : undefined,
    durationSeconds:
      typeof input.durationSeconds === "number" ? input.durationSeconds : undefined,
    reportSummary:
      typeof input.reportSummary === "string" ? input.reportSummary : undefined,
    completedAt: typeof input.completedAt === "string" ? input.completedAt : undefined,
  };
}

function readAssessments(): StoredAssessment[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeAssessment(item))
      .filter((item): item is StoredAssessment => item !== null);
  } catch (error) {
    console.error("Failed to read assessments from storage", error);
    return [];
  }
}

function writeAssessments(data: StoredAssessment[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to write assessments to storage", error);
  }
}

export function getAllAssessments(): StoredAssessment[] {
  return readAssessments();
}

export function getAssessmentById(id: string): StoredAssessment | null {
  const items = readAssessments();
  return items.find((item) => item.id === id) || null;
}

export function getAssessmentsByPatientId(
  patientId: string
): StoredAssessment[] {
  return readAssessments()
    .filter((item) => item.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getRecentAssessmentsForPatient(
  patientId: string,
  limit = 3
): StoredAssessment[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  if (safeLimit === 0) return [];
  return getAssessmentsByPatientId(patientId).slice(0, safeLimit);
}

export function saveAssessmentToStorage(assessment: StoredAssessment) {
  const normalized = normalizeAssessment(assessment);
  if (!normalized) {
    console.error("Failed to save assessment: invalid payload");
    return;
  }

  const items = readAssessments();
  const existingIndex = items.findIndex((item) => item.id === normalized.id);

  if (existingIndex >= 0) {
    const existing = items[existingIndex];

    // Protect session history integrity: the same assessment ID must remain tied
    // to the original patient record once created.
    if (existing.patientId !== normalized.patientId) {
      console.error(
        `Failed to save assessment ${normalized.id}: patientId mismatch`
      );
      return;
    }

    items[existingIndex] = {
      ...existing,
      ...normalized,
      id: existing.id,
      patientId: existing.patientId,
      createdAt: existing.createdAt || normalized.createdAt,
    };
  } else {
    items.push(normalized);
  }

  writeAssessments(items);
}

export function getLatestAssessmentForPatient(
  patientId: string
): StoredAssessment | null {
  const items = getRecentAssessmentsForPatient(patientId, 1);
  return items.length > 0 ? items[0] : null;
}

export function createAssessmentId() {
  return `AS-${Math.floor(10000 + Math.random() * 90000)}`;
}