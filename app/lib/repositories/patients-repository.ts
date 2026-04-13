import type { PatientRecord } from "../domain-types";
import {
  getPatientById,
  getStoredPatients,
  savePatientToStorage,
} from "../patients-storage";

/**
 * Patient data access boundary. Local implementation delegates to `patients-storage`;
 * a future Supabase adapter can implement the same surface.
 */
export type PatientsRepository = {
  getAll(): PatientRecord[];
  getById(id: string): PatientRecord | null;
  /** Inserts a new patient row (same semantics as storage save for new ids). */
  create(record: PatientRecord): void;
  /** Updates an existing patient row (same semantics as storage save for existing ids). */
  update(record: PatientRecord): void;
};

const localPatientsRepository: PatientsRepository = {
  getAll() {
    return getStoredPatients();
  },
  getById(id) {
    return getPatientById(id);
  },
  create(record) {
    savePatientToStorage(record);
  },
  update(record) {
    savePatientToStorage(record);
  },
};

export const patientsRepository: PatientsRepository = localPatientsRepository;
