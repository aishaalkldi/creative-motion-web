import type { PatientRecord } from "./domain-types";

export type { CreatePatientInput, PatientRecord, PatientStatus } from "./domain-types";

/** Alias kept for existing imports — identical to `PatientRecord`. */
export type StoredPatient = PatientRecord;

type PatientStore = {
  getAll(): PatientRecord[];
  getById(id: string): PatientRecord | null;
  save(patient: PatientRecord): void;
};

const STORAGE_KEY = "creative_motion_patients";

function normalizePatient(input: Partial<PatientRecord>): PatientRecord | null {
  if (!input.id || !input.fullName) return null;

  return {
    id: input.id,
    fullName: input.fullName,
    phone: input.phone || "",
    age: input.age || "",
    gender: input.gender || "",
    diagnosis: input.diagnosis || "",
    notes: input.notes || "",
    initialAssessment: input.initialAssessment || "",
    status: input.status || "new",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function readPatients(): PatientRecord[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizePatient(item))
      .filter((item): item is PatientRecord => item !== null);
  } catch {
    return [];
  }
}

function writePatients(data: PatientRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const localPatientStore: PatientStore = {
  getAll() {
    return readPatients();
  },
  getById(id: string) {
    return readPatients().find((item) => item.id === id) || null;
  },
  save(patient: PatientRecord) {
    const normalized = normalizePatient(patient);
    if (!normalized) {
      console.error("Failed to save patient: invalid payload");
      return;
    }

    const patients = readPatients();
    const existingIndex = patients.findIndex((p) => p.id === normalized.id);

    if (existingIndex !== -1) {
      const existing = patients[existingIndex];
      patients[existingIndex] = {
        ...existing,
        ...normalized,
        id: existing.id,
        createdAt: existing.createdAt || normalized.createdAt,
      };
      writePatients(patients);
      return;
    }

    writePatients([normalized, ...patients]);
  },
};

export function getStoredPatients(): PatientRecord[] {
  return localPatientStore.getAll();
}

export function getPatientById(id: string): PatientRecord | null {
  return localPatientStore.getById(id);
}

export function savePatientToStorage(patient: PatientRecord) {
  localPatientStore.save(patient);
}
