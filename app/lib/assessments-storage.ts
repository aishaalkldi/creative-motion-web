export type AssessmentMode = "in_clinic" | "remote";
export type AssessmentStatus = "draft" | "completed" | "pending_review";

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
};

const STORAGE_KEY = "creative_motion_assessments";

export function createAssessmentId(): string {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `AS-${random}`;
}

export function getStoredAssessments(): StoredAssessment[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as StoredAssessment[];
  } catch {
    return [];
  }
}

export function saveAssessmentToStorage(
  assessment: StoredAssessment
): void {
  if (typeof window === "undefined") return;

  const assessments = getStoredAssessments();
  const existingIndex = assessments.findIndex((a) => a.id === assessment.id);

  if (existingIndex !== -1) {
    assessments[existingIndex] = assessment;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
    return;
  }

  const updated = [assessment, ...assessments];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getAssessmentsByPatientId(
  patientId: string
): StoredAssessment[] {
  return getStoredAssessments()
    .filter((a) => a.patientId === patientId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getAssessmentById(
  assessmentId: string
): StoredAssessment | null {
  return (
    getStoredAssessments().find((a) => a.id === assessmentId) || null
  );
}