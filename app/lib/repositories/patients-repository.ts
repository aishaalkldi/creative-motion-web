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
  /** Match `patient_code` (e.g. PT-1001) or stored `id`, with trim / case-insensitive id fallback. */
  getByPatientCodeOrId(key: string): PatientRecord | null;
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
  getByPatientCodeOrId(key) {
    const k = key.trim();
    if (!k) return null;
    const direct = getPatientById(k);
    if (direct) return direct;
    const lower = k.toLowerCase();
    for (const p of getStoredPatients()) {
      if (!p.id) continue;
      const idTrim = p.id.trim();
      if (idTrim === k || idTrim.toLowerCase() === lower) return p;
    }
    return null;
  },
  create(record) {
    savePatientToStorage(record);
  },
  update(record) {
    savePatientToStorage(record);
  },
};

export const patientsRepository: PatientsRepository = localPatientsRepository;
