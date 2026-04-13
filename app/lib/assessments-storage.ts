import type {
  AssessmentRecord,
  CreateAssessmentInput,
  MotionMetrics,
} from "./domain-types";

export type {
  AssessmentMode,
  AssessmentRecord,
  AssessmentResult,
  AssessmentStatus,
  CreateAssessmentInput,
  MotionMetrics,
} from "./domain-types";

/** Alias kept for existing imports — identical to `AssessmentRecord`. */
export type StoredAssessment = AssessmentRecord;

const STORAGE_KEY = "creative-motion-assessments";

type AssessmentStore = {
  getAll(): AssessmentRecord[];
  getById(id: string): AssessmentRecord | null;
  getByPatientId(patientId: string): AssessmentRecord[];
  getRecentByPatientId(patientId: string, limit: number): AssessmentRecord[];
  getLatestByPatientId(patientId: string): AssessmentRecord | null;
  save(assessment: AssessmentRecord): void;
  createDraft(input: CreateAssessmentInput): AssessmentRecord;
};

function normalizeMotionMetrics(input: unknown): MotionMetrics | undefined {
  if (!input || typeof input !== "object") return undefined;
  return input as MotionMetrics;
}

function normalizeAssessment(input: Partial<AssessmentRecord>): AssessmentRecord | null {
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
    motionMetrics: normalizeMotionMetrics(input.motionMetrics),
  };
}

function readAssessments(): AssessmentRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeAssessment(item))
      .filter((item): item is AssessmentRecord => item !== null);
  } catch (error) {
    console.error("Failed to read assessments from storage", error);
    return [];
  }
}

function writeAssessments(data: AssessmentRecord[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to write assessments to storage", error);
  }
}

const localAssessmentStore: AssessmentStore = {
  getAll() {
    return readAssessments();
  },
  getById(id: string) {
    return readAssessments().find((item) => item.id === id) || null;
  },
  getByPatientId(patientId: string) {
    return readAssessments()
      .filter((item) => item.patientId === patientId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },
  getRecentByPatientId(patientId: string, limit: number) {
    const safeLimit = Number.isFinite(limit)
      ? Math.max(0, Math.floor(limit))
      : 3;
    if (safeLimit === 0) return [];
    return localAssessmentStore.getByPatientId(patientId).slice(0, safeLimit);
  },
  getLatestByPatientId(patientId: string) {
    const recent = localAssessmentStore.getRecentByPatientId(patientId, 1);
    return recent.length > 0 ? recent[0] : null;
  },
  save(assessment: AssessmentRecord) {
    const normalized = normalizeAssessment(assessment);
    if (!normalized) {
      console.error("Failed to save assessment: invalid payload");
      return;
    }

    const items = readAssessments();
    const existingIndex = items.findIndex((item) => item.id === normalized.id);

    if (existingIndex >= 0) {
      const existing = items[existingIndex];

      // Keep assessment session identity immutable once created.
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
  },
  createDraft(input: CreateAssessmentInput) {
    const draft = normalizeAssessment({
      ...input,
      selectedTests: input.selectedTests || [],
      bodyRegion: input.bodyRegion || "Full Body",
      side: input.side || "Not Applicable",
      visitType: input.visitType || "Follow-Up",
      sessionLabel: input.sessionLabel || "Assessment Session",
      status: "draft",
      createdAt: input.createdAt || new Date().toISOString(),
    });

    if (!draft) {
      throw new Error("Invalid draft assessment payload");
    }

    localAssessmentStore.save(draft);
    return draft;
  },
};

export function getAllAssessments(): AssessmentRecord[] {
  return localAssessmentStore.getAll();
}

export function getAssessmentById(id: string): AssessmentRecord | null {
  return localAssessmentStore.getById(id);
}

export function getAssessmentsByPatientId(patientId: string): AssessmentRecord[] {
  return localAssessmentStore.getByPatientId(patientId);
}

export function getRecentAssessmentsForPatient(
  patientId: string,
  limit = 3
): AssessmentRecord[] {
  return localAssessmentStore.getRecentByPatientId(patientId, limit);
}

export function saveAssessmentToStorage(assessment: AssessmentRecord) {
  localAssessmentStore.save(assessment);
}

export function createDraftAssessment(input: CreateAssessmentInput) {
  return localAssessmentStore.createDraft(input);
}

export function getLatestAssessmentForPatient(
  patientId: string
): AssessmentRecord | null {
  return localAssessmentStore.getLatestByPatientId(patientId);
}

export function createAssessmentId() {
  return `AS-${Math.floor(10000 + Math.random() * 90000)}`;
}
