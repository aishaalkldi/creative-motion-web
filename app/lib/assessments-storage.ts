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

function readAssessments(): StoredAssessment[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAssessment[];
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

export function saveAssessmentToStorage(assessment: StoredAssessment) {
  const items = readAssessments();
  const existingIndex = items.findIndex((item) => item.id === assessment.id);

  if (existingIndex >= 0) {
    items[existingIndex] = assessment;
  } else {
    items.push(assessment);
  }

  writeAssessments(items);
}

export function getLatestAssessmentForPatient(
  patientId: string
): StoredAssessment | null {
  const items = getAssessmentsByPatientId(patientId);
  return items.length > 0 ? items[0] : null;
}

export function createAssessmentId() {
  return `AS-${Math.floor(10000 + Math.random() * 90000)}`;
}